import { cancelAllOrders } from '../exchange/orders'
import { markBotAsStopped } from '../database/botState'
import { broadcastSSE } from '../sse'
import { logger } from '../logger'
import { buildAndSaveSession } from './session'
import type { BotRuntime, BotStopReason } from '../types'

export interface RiskCheckResult {
  shouldStop: boolean
  shouldPause?: boolean
  reason?: BotStopReason
  warning?: string
}

export function checkRiskRules(
  runtime: BotRuntime,
  currentPrice: number,
  maxDailyTrades: number,
  stopLossPercent: number
): RiskCheckResult {
  const state = runtime.botState
  if (!state) return { shouldStop: false }

  // Regla 1: precio por debajo del grid mínimo
  if (currentPrice < state.gridMin) {
    return { shouldStop: true, reason: 'stop_loss_range' }
  }

  // Regla 2: caída global desde precio inicial
  if (state.initialPrice > 0) {
    const priceDrop = (state.initialPrice - currentPrice) / state.initialPrice * 100
    if (priceDrop >= stopLossPercent) {
      return { shouldStop: true, reason: 'stop_loss_global' }
    }
  }

  // Regla 3: límite de trades diarios
  if (runtime.dailyTradesCount >= maxDailyTrades) {
    return { shouldStop: true, reason: 'daily_limit' }
  }

  // Regla 4: profit target alcanzado
  const profitTarget = Number(process.env.PROFIT_TARGET_USDC ?? 5.0)
  if (profitTarget > 0 && (runtime.botState?.totalProfitUSDC ?? 0) >= profitTarget) {
    return { shouldStop: false, shouldPause: true, reason: 'profit_target_reached' }
  }

  // Regla 5: trailing stop sobre ganancia de sesión
  const profitLockThreshold = 2.0
  const sessionProfit = runtime.botState?.totalProfitUSDC ?? 0
  if (runtime.peakProfitUSDC > profitLockThreshold && sessionProfit < runtime.peakProfitUSDC * 0.80) {
    return { shouldStop: false, shouldPause: true, reason: 'trailing_stop_profit' }
  }

  // Warning: precio en zona de peligro (10% inferior del grid)
  const gridRange = state.gridMax - state.gridMin
  if (currentPrice < state.gridMin + 0.1 * gridRange) {
    return { shouldStop: false, warning: 'Precio en zona de peligro (10% inferior del grid)' }
  }

  return { shouldStop: false }
}

export async function executeEmergencyStop(
  runtime: BotRuntime,
  reason: BotStopReason,
  pair: string
): Promise<void> {
  logger.warn(`Emergency stop: ${reason}`)

  try {
    await cancelAllOrders(pair)
  } catch (err) {
    logger.error('Error cancelando órdenes en emergency stop:', err)
  }

  try {
    await markBotAsStopped(reason, pair)
  } catch (err) {
    logger.error('Error marcando bot como detenido:', err)
  }

  runtime.isRunning = false
  runtime.isPaused = false
  runtime.activeOrders.clear()

  if (runtime.mainLoopInterval) {
    clearInterval(runtime.mainLoopInterval)
    runtime.mainLoopInterval = null
  }

  const botState = runtime.botState
  const session = await buildAndSaveSession(runtime, pair, reason).catch(() => null)

  broadcastSSE('bot_status_change', {
    status: 'stopped',
    reason,
    totalProfitUSDC: botState?.totalProfitUSDC ?? 0,
    totalTrades: botState?.totalTrades ?? 0,
    session,
  })
}

export function resetDailyCountersIfNeeded(runtime: BotRuntime): void {
  const today = new Date().toISOString().slice(0, 10)
  if (runtime.dailyTradesDate !== today) {
    runtime.dailyTradesCount = 0
    runtime.ordersSkippedToday = 0
    runtime.dailyTradesDate = today
  }
}
