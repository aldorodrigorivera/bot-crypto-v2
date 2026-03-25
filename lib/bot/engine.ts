import { fetchCurrentPrice, fetchOHLCV, fetchOrderBook, fetchRecentTrades, fetchClosedOrders, isMockMode } from '../exchange/orders'
import type { ExchangeOrder } from '../types'
import { runLayer1Analysis } from '../analysis/layer1-risk'
import { runLayer2Analysis } from '../analysis/layer2-probability'
import { calculateSizeMultiplier } from '../analysis/positionSizer'
import { splitOrder } from './orderSplitter'
import { getOppositeOrderPrice, calculateCycleProfit, getGridMinMax } from './grid'
import { checkRiskRules, executeEmergencyStop, resetDailyCountersIfNeeded } from './risk'
import { saveTrade } from '../database/trades'
import { saveGridOrder, updateGridOrderStatus } from '../database/gridOrders'
import { saveBotState } from '../database/botState'
import { broadcastSSE } from '../sse'
import { logger } from '../logger'
import { getAppConfig } from '../config'
import { recordIncubationTrade } from '../incubation/manager'
import type { BotRuntime, GridLevel, TradeRecord } from '../types'


export interface CycleResult {
  tradesExecuted: number
  ordersSkipped: number
  currentPrice: number
  error?: string
}

export async function runBotCycle(
  runtime: BotRuntime,
  gridLevels: GridLevel[]
): Promise<CycleResult> {
  const config = getAppConfig()
  const pair = config.bot.pair

  resetDailyCountersIfNeeded(runtime)

  // Verificar pausa temporal (e.g. por pérdidas consecutivas)
  if (runtime.pauseUntil && runtime.pauseUntil > new Date()) {
    logger.debug(`Bot en pausa temporal hasta ${runtime.pauseUntil.toISOString()}`)
    return { tradesExecuted: 0, ordersSkipped: 0, currentPrice: 0 }
  } else if (runtime.pauseUntil && runtime.pauseUntil <= new Date()) {
    runtime.pauseUntil = null
  }

  // Límites dinámicos basados en gridLevels
  // max=2× permite 1 buy + 1 sell por nivel (estado ideal del grid)
  // resume=1.25× banda estrecha para minimizar ciclos perdidos sin colocar órdenes opuestas
  const splitFactor = config.bot.splitEnabled ? config.bot.splitParts : 1
  const maxOpenOrders = Math.round((runtime.currentConfig?.gridLevels ?? 10) * 2.0 * splitFactor)
  const resumeOpenOrders = Math.round((runtime.currentConfig?.gridLevels ?? 10) * 1.5 * splitFactor)

  let currentPrice: number
  try {
    currentPrice = await fetchCurrentPrice(pair)
    broadcastSSE('price_update', { price: currentPrice, pair })
  } catch (err) {
    logger.error('Error obteniendo precio:', err)
    return { tradesExecuted: 0, ordersSkipped: 0, currentPrice: 0, error: 'price_fetch_failed' }
  }

  // Verificar reglas de riesgo
  const riskCheck = checkRiskRules(
    runtime,
    currentPrice,
    config.bot.maxDailyTrades,
    config.bot.stopLossPercent
  )

  if (riskCheck.warning) {
    broadcastSSE('risk_alert', { message: riskCheck.warning })
  }

  if (riskCheck.shouldStop && riskCheck.reason) {
    await executeEmergencyStop(runtime, riskCheck.reason, pair)
    return { tradesExecuted: 0, ordersSkipped: 0, currentPrice, error: riskCheck.reason }
  }

  if (riskCheck.shouldPause && riskCheck.reason) {
    runtime.isPaused = true
    if (runtime.botState) {
      runtime.botState.isPaused = true
    }
    broadcastSSE('bot_status_change', { status: 'paused', reason: riskCheck.reason })
    logger.warn(`Bot pausado por regla de riesgo: ${riskCheck.reason}`)
  }

  if (runtime.isPaused) {
    return { tradesExecuted: 0, ordersSkipped: 0, currentPrice }
  }

  // Obtener órdenes cerradas (reales o simuladas en mock mode)
  let closedOrders: ExchangeOrder[]
  if (isMockMode()) {
    // Simular fills: ~25% de órdenes abiertas se llenan por ciclo (mínimo 1 si hay órdenes)
    const openOrders = Array.from(runtime.activeOrders.values()).filter(o => o.status === 'open')
    const fillCount = Math.max(openOrders.length > 0 ? 1 : 0, Math.floor(openOrders.length * 0.25))
    const toFill = openOrders.sort(() => Math.random() - 0.5).slice(0, fillCount)
    closedOrders = toFill.map(o => ({
      id: o.orderId,
      side: o.side,
      price: o.price,
      amount: o.amount,
      filled: o.amount,
      remaining: 0,
      status: 'closed' as const,
      timestamp: Date.now(),
      symbol: pair,
    }))
    if (closedOrders.length > 0) {
      logger.debug(`Mock: simulando ${closedOrders.length} fills de ${openOrders.length} órdenes abiertas`)
    }
  } else {
    try {
      closedOrders = await fetchClosedOrders(pair)
    } catch (err) {
      logger.error('Error obteniendo órdenes cerradas:', err)
      return { tradesExecuted: 0, ordersSkipped: 0, currentPrice }
    }
  }

  // Filtrar las que están en nuestro mapa de órdenes activas y estaban abiertas
  const newlyFilled = closedOrders.filter(o =>
    runtime.activeOrders.has(o.id) &&
    runtime.activeOrders.get(o.id)!.status === 'open'
  )

  let tradesExecuted = 0
  let ordersSkipped = 0

  // Obtener datos de mercado para análisis
  const [ohlcv, orderBook, recentTrades] = await Promise.all([
    fetchOHLCV(pair, '1h', 100),
    fetchOrderBook(pair, 20),
    fetchRecentTrades(pair, 50),
  ])

  const gridMin = runtime.botState?.gridMin ?? 0
  const gridMax = runtime.botState?.gridMax ?? 0

  for (const filled of newlyFilled) {
    const gridOrder = runtime.activeOrders.get(filled.id)
    if (!gridOrder) continue

    // Marcar como filled
    gridOrder.status = 'filled'
    gridOrder.filledAt = new Date()
    await updateGridOrderStatus(filled.id, 'filled').catch(() => { })

    const filledSide = filled.side as 'buy' | 'sell'
    const pairedBuyPrice = filledSide === 'sell'
      ? runtime.activeOrders.get(gridOrder.pairedOrderId ?? '')?.price ?? 0
      : 0

    const profit = filledSide === 'sell' && pairedBuyPrice > 0
      ? calculateCycleProfit(pairedBuyPrice, filled.price, filled.amount)
      : 0

    // Determinar orden opuesta
    const oppositePrice = getOppositeOrderPrice(filled.price, filledSide, gridLevels)
    if (!oppositePrice) {
      ordersSkipped++
      runtime.ordersSkippedToday++
      continue
    }
    const oppositeSide = filledSide === 'buy' ? 'sell' : 'buy'

    // Capa 1
    const layer1 = runLayer1Analysis({
      orderSide: oppositeSide,
      orderPrice: oppositePrice,
      currentPrice,
      ohlcv,
      orderBook,
      recentTrades,
      gridRange: { min: gridMin, max: gridMax },
    })

    // saveLayerAnalysis deshabilitado — reducir requests a Back4App

    broadcastSSE('layer_analysis', {
      layer: 1,
      approved: layer1.approved,
      score: layer1.riskScore,
      reason: layer1.blockedReason,
    })

    if (!layer1.approved) {
      ordersSkipped++
      runtime.ordersSkippedToday++
      continue
    }

    // Capa 2
    const layer2 = runLayer2Analysis(ohlcv, orderBook, oppositeSide)

    // saveLayerAnalysis deshabilitado — reducir requests a Back4App

    broadcastSSE('layer_analysis', {
      layer: 2,
      approved: layer2.approved,
      score: layer2.probability,
      reason: layer2.skipReason,
    })

    if (!layer2.approved) {
      ordersSkipped++
      runtime.ordersSkippedToday++
      continue
    }

    // Position sizing
    const gridCenter = (gridMin + gridMax) / 2
    const isNearCenter = Math.abs(oppositePrice - gridCenter) < (gridMax - gridMin) * 0.2

    const multiplier = calculateSizeMultiplier({
      layer1,
      layer2,
      layer3Bias: runtime.layer3Bias,
      layer3SizingBias: 'normal',
      isNearCenter,
      centralLevelsPercent: config.bot.sizingCentralLevelsPercent,
    })

    const baseLevel = gridLevels.find(l => Math.abs(l.price - oppositePrice) < 0.0001)
    const baseAmount = baseLevel?.amount ?? config.bot.sizingBaseAmount
    const incubationMultiplier = runtime.incubationSizeMultiplier ?? 1.0
    const orderAmount = baseAmount * multiplier * incubationMultiplier

    // Verificar límite de órdenes abiertas (hysteresis: pause en 20, resume en 10)
    const currentOpenCount = Array.from(runtime.activeOrders.values())
      .filter(o => o.status === 'open').length

    if (currentOpenCount >= maxOpenOrders) {
      runtime.orderLimitReached = true
    } else if (currentOpenCount <= resumeOpenOrders) {
      runtime.orderLimitReached = false
    }

    if (runtime.orderLimitReached) {
      logger.warn(`Límite de ${maxOpenOrders} órdenes abiertas alcanzado (actual: ${currentOpenCount}). Esperando hasta ${resumeOpenOrders}.`)
      broadcastSSE('risk_alert', {
        message: `Límite de órdenes alcanzado`,
        openCount: currentOpenCount,
        maxOrders: maxOpenOrders,
        resumeAt: resumeOpenOrders,
      })
      ordersSkipped++
      runtime.ordersSkippedToday++
      continue
    }

    // Colocar orden (con split si está habilitado)
    try {
      const placedOrders = await splitOrder(pair, oppositeSide, orderAmount, oppositePrice)

      for (const placed of placedOrders) {
        const newGridOrder: import('../types').GridOrder = {
          orderId: placed.id,
          level: baseLevel?.level ?? 0,
          side: oppositeSide as import('../types').OrderSide,
          price: placed.price,
          amount: placed.amount,
          status: 'open' as const,
          pairedOrderId: filled.id,
        }

        runtime.activeOrders.set(placed.id, newGridOrder)
        await saveGridOrder(newGridOrder).catch(() => { })

        broadcastSSE('order_placed', {
          side: oppositeSide,
          price: placed.price,
          amount: placed.amount,
          orderId: placed.id,
        })
      }

      tradesExecuted++
      runtime.dailyTradesCount++
      runtime.lastTradeAt = new Date()

      // Guardar trade
      const trade: TradeRecord = {
        pair,
        side: filledSide,
        price: filled.price,
        targetPrice: oppositePrice,
        amount: filled.amount,
        usdcValue: filled.amount * filled.price,
        fee: filled.amount * filled.price * 0.001,
        profit,
        profitBase: filledSide === 'sell' ? profit / filled.price : 0,
        gridLevel: gridOrder.level,
        orderId: filled.id,
        pairedOrderId: gridOrder.pairedOrderId,
        executedAt: new Date(),
        configUsed: runtime.botState?.configName ?? 'balanced',
        status: 'filled',
        layer1Score: layer1.riskScore,
        layer2Probability: layer2.probability,
        sizeMultiplier: multiplier,
      }

      await saveTrade(trade).catch(() => { })
      broadcastSSE('trade_executed', {
        side: filledSide,
        price: filled.price,
        amount: filled.amount,
        profit,
        pair,
      })

      // Actualizar estado del bot
      if (runtime.botState && filledSide === 'sell') {
        runtime.botState.totalProfitUSDC += profit
        runtime.botState.totalTrades++
        runtime.botState.lastActiveAt = new Date()
        await saveBotState(runtime.botState).catch(() => { })
        // v3: incubación — registrar trade completado
        if (config.incubation.enabled) {
          await recordIncubationTrade(profit, profit > 0).catch(() => { })
        }
      }

      // Tracking de pérdidas consecutivas y peak profit
      if (filledSide === 'sell') {
        if (profit < 0) {
          runtime.consecutiveLosses++
          if (runtime.consecutiveLosses >= 3) {
            runtime.pauseUntil = new Date(Date.now() + 90_000)
            runtime.consecutiveLosses = 0
            broadcastSSE('risk_alert', { message: '3 pérdidas consecutivas — pausa de 90 segundos activada' })
            logger.warn('3 pérdidas consecutivas detectadas — pausa temporal de 90s')
          }
        } else if (profit > 0) {
          runtime.consecutiveLosses = 0
          const currentTotalProfit = runtime.botState?.totalProfitUSDC ?? 0
          if (currentTotalProfit > runtime.peakProfitUSDC) {
            runtime.peakProfitUSDC = currentTotalProfit
          }
        }
      }
    } catch (err) {
      logger.error('Error colocando orden opuesta:', err)
    }
  }

  return { tradesExecuted, ordersSkipped, currentPrice }
}
