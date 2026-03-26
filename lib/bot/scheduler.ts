import { runBotCycle } from './engine'
import { runLayer3Agent } from '../analysis/layer3-agent'
import { runMarketAnalysis } from '../analysis/market'
import { buildGridLevels, calculateAmountPerLevel, getGridMinMax } from './grid'
import { readAccountBalance, fetchCurrentPrice, cancelAllOrders, placeLimitOrder } from '../exchange/orders'
import { saveBotState, getBotState, markBotAsStopped } from '../database/botState'
import { getActiveGridOrders, saveGridOrder, updateGridOrderStatus } from '../database/gridOrders'
import { broadcastSSE } from '../sse'
import { logger } from '../logger'
import { getAppConfig, MAIN_LOOP_INTERVAL_MS, LAYER3_MIN_INTERVAL_MS, PRICE_BROADCAST_INTERVAL_MS } from '../config'
import { runtime } from '../runtime'
import { buildAndSaveSession } from './session'
import { runBacktest } from '../backtesting/engine'
import { loadIncubationState } from '../incubation/manager'
import type { GridLevel, GridOrder } from '../types'

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

  // ── v3: Backtest pre-arranque ──────────────────────────────────────────
  if (config.backtest.enabled) {
    try {
      broadcastSSE('backtest_started', {})
      const btResult = await runBacktest(gridConfig.name)
      console.log('\n' + btResult.formattedOutput + '\n')
      runtime.lastBacktestMetrics = btResult.metrics
      runtime.lastBacktestFailed = !btResult.metrics.passed
      broadcastSSE('backtest_completed', {
        ...btResult.metrics,
        configName: btResult.configName,
      })

      if (!btResult.metrics.passed) {
        logger.warn('[scheduler] Backtest NO aprobado', { reasons: btResult.metrics.failedReasons })
        // En Next.js no hay stdin interactivo — el arranque continúa pero
        // el flag lastBacktestFailed=true queda visible en /api/status y dashboard.
        // Para bloquear el arranque, el frontend puede llamar con forceStart=false
        // y este error será retornado por /api/bot/start antes de llegar aquí.
      }
    } catch (err) {
      logger.error('[scheduler] Error ejecutando backtest:', err)
      // No bloquear el arranque del bot si el backtest falla por error externo
    }
  }

  // ── v3: Cargar estado de incubación ───────────────────────────────────
  if (config.incubation.enabled) {
    await loadIncubationState().catch(err =>
      logger.warn('[scheduler] Error cargando incubación:', err)
    )
  }

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

  // Ajustar montos de sell para caber dentro del balance disponible de base currency
  // (el amountPerLevel se calcula desde USDT pero los sells necesitan XRP físico)
  const sellLevelsInGrid = gridLevels.filter(l => l.side === 'sell')
  if (sellLevelsInGrid.length > 0 && balance.freeBase > 0) {
    const xrpForSells = balance.freeBase * activePercent
    const maxSellAmountPerLevel = xrpForSells / sellLevelsInGrid.length
    if (maxSellAmountPerLevel < amountPerLevel) {
      const adjustedSellAmount = Math.max(maxSellAmountPerLevel, config.bot.sizingBaseAmount)
      gridLevels = gridLevels.map(l =>
        l.side === 'sell' ? { ...l, amount: adjustedSellAmount } : l
      )
      logger.info(
        `[scheduler] Sell amount ajustado: ${amountPerLevel.toFixed(4)} → ${adjustedSellAmount.toFixed(4)} XRP ` +
        `(${balance.freeBase.toFixed(2)} XRP libre × ${config.bot.activePercent}% / ${sellLevelsInGrid.length} niveles)`
      )
    }
  }

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
  if (!options.resume) {
    runtime.peakProfitUSDC = 0
    runtime.consecutiveLosses = 0
    runtime.pauseUntil = null
  }

  // Cargar órdenes activas de DB si es resume; si no, colocar órdenes iniciales del grid
  if (options.resume) {
    const activeOrders = await getActiveGridOrders()
    for (const order of activeOrders) {
      runtime.activeOrders.set(order.orderId, order)
    }
    logger.info(`Resume: ${activeOrders.length} órdenes cargadas de DB`)
  } else {
    const BINANCE_MIN_NOTIONAL = 1.0
    const [baseCurrency] = pair.split('/')
    const hasSellCapacity = balance.freeBase >= config.bot.sizingBaseAmount
    logger.info(
      `Colocando ${gridLevels.length} órdenes iniciales del grid... ` +
      `(balance: ${balance.freeUSDC.toFixed(2)} USDT libre, ${balance.freeBase.toFixed(4)} ${baseCurrency} libre` +
      `${!hasSellCapacity ? ` — sin ${baseCurrency}: órdenes sell omitidas hasta primer fill` : ''})`
    )
    if (!hasSellCapacity) {
      broadcastSSE('risk_alert', {
        message: `Sin ${baseCurrency} en cuenta: órdenes sell iniciales omitidas. El bot solo comprará hasta ejecutar el primer fill.`,
      })
    }
    let placed = 0
    const placeErrors: string[] = []
    for (const level of gridLevels) {
      // Sin XRP/base: omitir sells iniciales — se colocarán automáticamente al llenar una compra
      if (level.side === 'sell' && !hasSellCapacity) {
        continue
      }
      const notional = level.amount * level.price
      if (notional < BINANCE_MIN_NOTIONAL) {
        logger.warn(`Nivel ${level.level} omitido: notional $${notional.toFixed(4)} < mínimo $${BINANCE_MIN_NOTIONAL} (amount=${level.amount} price=${level.price.toFixed(4)})`)
        continue
      }
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
        const errMsg = err instanceof Error ? err.message : String(err)
        logger.warn(`Error colocando orden inicial nivel ${level.level} (${level.side} ${level.amount} @ ${level.price.toFixed(4)}): ${errMsg}`)
        if (!placeErrors.includes(errMsg)) placeErrors.push(errMsg)
      }
    }
    logger.info(`Órdenes iniciales colocadas: ${placed}/${gridLevels.length}`)
    if (placed === 0 && placeErrors.length > 0) {
      const errorSummary = placeErrors[0]
      logger.error(`[scheduler] Ninguna orden inicial fue aceptada por Binance. Primer error: ${errorSummary}`)
      broadcastSSE('risk_alert', {
        message: `Error: 0/${gridLevels.length} órdenes aceptadas por Binance`,
        detail: errorSummary,
      })
    }
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

  // Cancelar todas las órdenes en Binance (cancelAllOrders no depende de activeOrders en memoria)
  await cancelAllOrders(config.bot.pair).catch(err =>
    logger.warn('Error cancelando órdenes en Binance:', err)
  )

  // Marcar como canceladas en DB y limpiar memoria
  const openOrders = Array.from(runtime.activeOrders.values()).filter(o => o.status === 'open')
  for (const order of openOrders) {
    await updateGridOrderStatus(order.orderId, 'cancelled').catch(() => {})
  }
  runtime.activeOrders.clear()
  logger.info(`Órdenes canceladas (${openOrders.length} en memoria + todas las de Binance)`)

  await markBotAsStopped('manual', config.bot.pair)

  const session = await buildAndSaveSession(runtime, config.bot.pair, 'manual').catch(() => null)

  broadcastSSE('bot_status_change', {
    status: 'stopped',
    reason: 'manual',
    totalProfitUSDC: runtime.botState?.totalProfitUSDC ?? 0,
    totalTrades: runtime.botState?.totalTrades ?? 0,
    session,
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
    const action = response.grid_adjustment.action
    if (action === 'pause') {
      runtime.isPaused = true
      if (runtime.botState) {
        runtime.botState.isPaused = true
        await saveBotState(runtime.botState).catch(() => {})
      }
      broadcastSSE('bot_status_change', { status: 'paused' })
    } else if (action === 'rebuild') {
      await stopBot()
      await startBot({ gridLevels: response.grid_adjustment.new_levels })
    } else if (action === 'shift_up' || action === 'shift_down') {
      const shiftPct = (response.grid_adjustment.shift_percent ?? 1) / 100
      const direction = action === 'shift_up' ? 1 : -1
      if (runtime.botState) {
        runtime.botState.gridMin = runtime.botState.gridMin * (1 + direction * shiftPct)
        runtime.botState.gridMax = runtime.botState.gridMax * (1 + direction * shiftPct)
        await saveBotState(runtime.botState).catch(() => {})
        broadcastSSE('grid_rebuild', { pair: config.bot.pair, newConfig: runtime.botState.configName, reason: action })
        logger.info(`Capa 3: grid desplazado (${action}) ${response.grid_adjustment.shift_percent}%`)
      }
    } else if (action === 'widen' || action === 'narrow') {
      const newRangePercent = response.grid_adjustment.new_range_percent ?? 6
      if (runtime.botState && runtime.currentConfig) {
        const currentPrice = runtime.botState.gridMin + (runtime.botState.gridMax - runtime.botState.gridMin) / 2
        const half = currentPrice * (newRangePercent / 100) / 2
        runtime.botState.gridMin = currentPrice - half
        runtime.botState.gridMax = currentPrice + half
        runtime.botState.gridRangePercent = newRangePercent
        runtime.currentConfig.gridRangePercent = newRangePercent
        await saveBotState(runtime.botState).catch(() => {})
        broadcastSSE('grid_rebuild', { pair: config.bot.pair, newConfig: runtime.botState.configName, reason: action })
        logger.info(`Capa 3: grid ${action} a ${newRangePercent}% de rango`)
      }
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
