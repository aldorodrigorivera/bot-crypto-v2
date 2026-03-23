import { getTradesSince } from '../database/trades'
import { saveTradingSession } from '../database/tradingSessions'
import { generateSessionReport } from './sessionReport'
import { logger } from '../logger'
import type { BotRuntime, BotStopReason, TradingSession } from '../types'

/**
 * Calcula las métricas de la sesión desde startedAt, guarda en TradingSessions y retorna el objeto.
 * Falla silenciosamente si hay error de DB — retorna el objeto sin objectId.
 */
export async function buildAndSaveSession(
  runtime: BotRuntime,
  pair: string,
  stopReason: BotStopReason
): Promise<TradingSession | null> {
  const botState = runtime.botState
  if (!botState) return null

  const startedAt = botState.startedAt
  const stoppedAt = new Date()
  const durationMinutes = Math.round((stoppedAt.getTime() - startedAt.getTime()) / 60_000)

  const trades = await getTradesSince(pair, startedAt).catch(() => [])

  // Solo los sells representan ciclos cerrados (ganancia/pérdida real)
  const sellTrades = trades.filter(t => t.side === 'sell')
  const profitTrades = sellTrades.filter(t => t.profit > 0).length
  const lossTrades = sellTrades.filter(t => t.profit <= 0).length
  const totalProfitUSDC = trades.reduce((acc, t) => acc + (t.profit ?? 0), 0)
  const totalProfitBase = trades.reduce((acc, t) => acc + (t.profitBase ?? 0), 0)

  const session: Omit<TradingSession, 'objectId'> = {
    pair,
    startedAt,
    stoppedAt,
    durationMinutes,
    totalTrades: trades.length,
    profitTrades,
    lossTrades,
    totalProfitUSDC,
    totalProfitBase,
    stopReason,
    configName: botState.configName,
  }

  let saved: TradingSession
  try {
    saved = await saveTradingSession(session)
  } catch (err) {
    logger.error('Error guardando sesión de trading:', err)
    saved = { ...session }
  }

  // Generar reporte Markdown con análisis de Claude (fire-and-forget, no bloquea el stop)
  generateSessionReport(saved).catch(err =>
    logger.error('Error en generateSessionReport:', err)
  )

  return saved
}
