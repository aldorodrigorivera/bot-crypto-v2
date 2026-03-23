import { runBotCycle } from './engine'
import { runLayer3Agent } from '../analysis/layer3-agent'
import { runMarketAnalysis } from '../analysis/market'
import { buildGridLevels, calculateAmountPerLevel, getGridMinMax } from './grid'
import { readAccountBalance, fetchCurrentPrice, cancelAllOrders, cancelOrder, placeLimitOrder } from '../exchange/orders'
import { saveBotState, getBotState, markBotAsStopped } from '../database/botState'
import { getActiveGridOrders, clearAllGridOrders, saveGridOrder, updateGridOrderStatus } from '../database/gridOrders'
import { broadcastSSE } from '../sse'
import { logger } from '../logger'
import { getAppConfig, GRID_CONFIGS, MAIN_LOOP_INTERVAL_MS, LAYER3_MIN_INTERVAL_MS, PRICE_BROADCAST_INTERVAL_MS } from '../config'
import { runtime } from '../runtime'
import type { GridLevel, GridOrder, BotStopReason } from '../types'

let gridLevels: GridLevel[] = []
let priceBroadcastInterval: ReturnType<typeof setInterval> | null = null

export async function startBot(options: {
  resume?: boolean
  gridLevels?: number
  gridRangePercent?: number
}): Promise<void> {
  if (runtime.isRunning) throw new Error('El bot ya está corriendo')

  const config = getAppConfig()
  const pair = config.bot.pair

  logger.info('Iniciando bot...', { pair, ...options })

  // Análisis de mercado
  const analysis = await runMarketAnalysis(pair)
  runtime.lastAnalysis = analysis

  const currentPrice = analysis.currentPrice

  // Seleccionar config del grid
  const gridConfig = options.gridLevels
    ? {
        ...analysis.recommendedConfig,
        gridLevels: options.gridLevels,
        gridRangePercent: options.gridRangePercent ?? config.bot.gridRangePercent,
      }
    : analysis.recommendedConfig

  runtime.currentConfig = gridConfig

  // Balance y capital
  const balance = await readAccountBalance(pair)
  const activePercent = config.bot.activePercent / 100
  const totalBase = balance.totalBase
  const activeBase = totalBase * activePercent
  const reserveBase = totalBase - activeBase
  const activeUSDC = balance.freeUSDC * 0.5

  // Construir grid
  const amountPerLevel = calculateAmountPerLevel(activeUSDC, gridConfig, currentPrice)
  gridLevels = buildGridLevels(currentPrice, gridConfig, amountPerLevel)

  const { min: gridMin, max: gridMax } = getGridMinMax(currentPrice, gridConfig)

  // Crear/actualizar estado en DB
  const existingState = options.resume ? await getBotState(pair) : null
  const botState = await saveBotState({
    ...(existingState ?? {}),
    isRunning: true,
    isPaused: false,
    totalBase,
    reserveBase,
    activeBase,
    activeUSDC,
    gridMin,
    gridMax,
    gridLevels: gridConfig.gridLevels,
    gridRangePercent: gridConfig.gridRangePercent,
    configName: gridConfig.name,
    totalProfitBase: existingState?.totalProfitBase ?? 0,
    totalProfitUSDC: existingState?.totalProfitUSDC ?? 0,
    totalTrades: existingState?.totalTrades ?? 0,
    startedAt: options.resume && existingState ? existingState.startedAt : new Date(),
    lastActiveAt: new Date(),
    pair,
    initialPrice: currentPrice,
  })

  runtime.botState = botState
  runtime.isRunning = true
  runtime.isPaused = false
  runtime.activeOrders = new Map()

  // Cargar órdenes activas de DB si es resume; si no, colocar órdenes iniciales del grid
  if (options.resume) {
    const activeOrders = await getActiveGridOrders()
    for (const order of activeOrders) {
      runtime.activeOrders.set(order.orderId, order)
    }
    logger.info(`Resume: ${activeOrders.length} órdenes cargadas de DB`)
  } else {
    logger.info(`Colocando ${gridLevels.length} órdenes iniciales del grid...`)
    let placed = 0
    for (const level of gridLevels) {
      try {
        const exchangeOrder = await placeLimitOrder(pair, level.side, level.amount, level.price)
        const gridOrder: GridOrder = {
          orderId: exchangeOrder.id,
          level: level.level,
          side: level.side,
          price: level.price,
          amount: level.amount,
          status: 'open',
        }
        runtime.activeOrders.set(exchangeOrder.id, gridOrder)
        await saveGridOrder(gridOrder).catch(() => {})
        placed++
      } catch (err) {
        logger.warn(`Error colocando orden inicial nivel ${level.level}:`, err)
      }
    }
    logger.info(`Órdenes iniciales colocadas: ${placed}/${gridLevels.length}`)
    broadcastSSE('grid_rebuild', { pair, newConfig: gridConfig.name, ordersPlaced: placed })
  }

  broadcastSSE('bot_status_change', { status: 'running', pair, configName: gridConfig.name })

  // Main loop
  runtime.mainLoopInterval = setInterval(async () => {
    if (!runtime.isRunning) return
    try {
      await runBotCycle(runtime, gridLevels)
      await checkLayer3Triggers()
    } catch (err) {
      logger.error('Error en ciclo del bot:', err)
    }
  }, MAIN_LOOP_INTERVAL_MS)

  // Broadcast precio
  if (!priceBroadcastInterval) {
    priceBroadcastInterval = setInterval(async () => {
      try {
        const price = await fetchCurrentPrice(pair)
        broadcastSSE('price_update', { price, pair })
      } catch {}
    }, PRICE_BROADCAST_INTERVAL_MS)
  }

  logger.info('Bot iniciado correctamente', { gridLevels: gridConfig.gridLevels, gridMin, gridMax })
}

export async function stopBot(): Promise<void> {
  if (!runtime.isRunning) return

  const config = getAppConfig()
  logger.info('Deteniendo bot...')

  // Parar loops primero para que no abran nuevas órdenes
  if (runtime.mainLoopInterval) {
    clearInterval(runtime.mainLoopInterval)
    runtime.mainLoopInterval = null
  }
  if (priceBroadcastInterval) {
    clearInterval(priceBroadcastInterval)
    priceBroadcastInterval = null
  }

  runtime.isRunning = false
  runtime.isPaused = false

  // Cancelar todas las órdenes abiertas
  const openOrders = Array.from(runtime.activeOrders.values()).filter(o => o.status === 'open')
  if (openOrders.length > 0) {
    logger.info(`Cancelando ${openOrders.length} órdenes abiertas...`)
    for (const order of openOrders) {
      await cancelOrder(order.orderId, config.bot.pair).catch(err =>
        logger.warn(`Error cancelando orden ${order.orderId}:`, err)
      )
      await updateGridOrderStatus(order.orderId, 'cancelled').catch(() => {})
    }
    runtime.activeOrders.clear()
    logger.info('Órdenes canceladas correctamente')
  }

  await markBotAsStopped('manual', config.bot.pair)
  broadcastSSE('bot_status_change', {
    status: 'stopped',
    reason: 'manual',
    totalProfitUSDC: runtime.botState?.totalProfitUSDC ?? 0,
    totalTrades: runtime.botState?.totalTrades ?? 0,
  })

  logger.info('Bot detenido')
}

export async function resumeBot(): Promise<void> {
  if (!runtime.isPaused) throw new Error('El bot no está pausado')

  runtime.isPaused = false
  if (runtime.botState) {
    runtime.botState.isPaused = false
    await saveBotState(runtime.botState).catch(() => {})
  }

  broadcastSSE('bot_status_change', { status: 'running' })
  logger.info('Bot reanudado')
}

async function checkLayer3Triggers(): Promise<void> {
  if (!runtime.lastAnalysis) return

  const config = getAppConfig()
  const now = new Date()
  const minInterval = LAYER3_MIN_INTERVAL_MS
  const lastRun = runtime.lastLayer3At

  if (lastRun && now.getTime() - lastRun.getTime() < minInterval) return

  // Verificar triggers
  const volatilityTrigger = runtime.lastAnalysis.volatility24h > config.bot.layer3TriggerVolatility
  const idleMinutes = runtime.lastTradeAt
    ? (now.getTime() - runtime.lastTradeAt.getTime()) / 60_000
    : 9999
  const idleTrigger = idleMinutes > config.bot.layer3TriggerIdleMinutes

  // Re-análisis periódico
  const hoursSinceLastRun = lastRun
    ? (now.getTime() - lastRun.getTime()) / 3_600_000
    : 999
  const periodicTrigger = hoursSinceLastRun >= config.bot.layer3ReviewHours

  if (!volatilityTrigger && !idleTrigger && !periodicTrigger) return

  const trigger = volatilityTrigger ? 'high_volatility'
    : idleTrigger ? 'idle_timeout'
    : 'periodic_review'

  logger.info(`Activando Capa 3 (trigger: ${trigger})`)
  runtime.lastLayer3At = now

  try {
    const response = await runLayer3Agent(runtime, runtime.lastAnalysis, trigger)
    runtime.layer3Bias = response.market_bias
    runtime.layer3Action = response.grid_adjustment.action

    broadcastSSE('agent_response', response)

    if (response.risk_flags.length > 0) {
      broadcastSSE('risk_alert', { message: response.risk_flags.join(' | ') })
    }

    // Aplicar acción
    if (response.grid_adjustment.action === 'pause') {
      runtime.isPaused = true
      if (runtime.botState) {
        runtime.botState.isPaused = true
        await saveBotState(runtime.botState).catch(() => {})
      }
      broadcastSSE('bot_status_change', { status: 'paused' })
    } else if (response.grid_adjustment.action === 'rebuild') {
      await stopBot()
      await startBot({ gridLevels: response.grid_adjustment.new_levels })
    }

    // Actualizar bias en botState
    if (runtime.botState) {
      runtime.botState.agentBias = response.market_bias
      runtime.botState.lastAgentTrigger = trigger
      runtime.botState.lastAgentAt = now
      await saveBotState(runtime.botState).catch(() => {})
    }
  } catch (err) {
    logger.error('Error en Capa 3:', err)
  }
}
