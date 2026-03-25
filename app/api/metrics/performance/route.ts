export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runtime as botRuntime } from '@/lib/runtime'
import { getTradesSummary } from '@/lib/database/trades'
import { getIncubationStateInMemory } from '@/lib/incubation/manager'
import { getAppConfig } from '@/lib/config'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  try {
    const config = getAppConfig()
    const summary = await getTradesSummary(config.bot.pair)
    const backtestMetrics = botRuntime.lastBacktestMetrics
    const incubation = getIncubationStateInMemory()

    const realTrades = summary.totalTrades
    const MIN_TRADES_FOR_COMPARISON = 20

    if (realTrades < MIN_TRADES_FOR_COMPARISON) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          ready: false,
          realTrades,
          minTrades: MIN_TRADES_FOR_COMPARISON,
          message: `Esperando suficientes trades reales para la comparación... (${realTrades}/${MIN_TRADES_FOR_COMPARISON})`,
        },
      })
    }

    // Calcular win rate real desde trades
    const profitTrades = summary.totalTrades > 0
      ? Math.round((summary.totalProfitUSDC / summary.totalTrades) > 0 ? summary.totalTrades * 0.6 : summary.totalTrades * 0.4)
      : 0
    const realWinRate = incubation ? incubation.realWinRate : 0
    const realProfitFactor = incubation ? incubation.realProfitFactor : 0

    // Comparación con backtest
    const comparison = backtestMetrics ? {
      winRate: {
        backtest: backtestMetrics.winRate,
        real: Math.round(realWinRate * 10) / 10,
        divergencePct: backtestMetrics.winRate > 0
          ? Math.abs(realWinRate - backtestMetrics.winRate) / backtestMetrics.winRate * 100
          : 0,
      },
      profitFactor: {
        backtest: backtestMetrics.profitFactor,
        real: Math.round(realProfitFactor * 100) / 100,
        divergencePct: backtestMetrics.profitFactor > 0
          ? Math.abs(realProfitFactor - backtestMetrics.profitFactor) / backtestMetrics.profitFactor * 100
          : 0,
      },
      avgProfitPerCycle: {
        backtest: backtestMetrics.avgProfitPerCycle,
        real: summary.totalTrades > 0 ? summary.totalProfitUSDC / summary.totalTrades : 0,
        divergencePct: 0,
      },
    } : null

    const maxDivergence = comparison
      ? Math.max(comparison.winRate.divergencePct, comparison.profitFactor.divergencePct)
      : 0

    const alert = maxDivergence > 20
      ? '⚠️ El comportamiento real difiere significativamente del backtest. Considera re-analizar la configuración.'
      : null

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { ready: true, realTrades, comparison, maxDivergence: Math.round(maxDivergence), alert },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error calculando métricas de performance'
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
