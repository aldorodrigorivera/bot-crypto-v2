export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { runBacktest } from '@/lib/backtesting/engine'
import { runtime as botRuntime } from '@/lib/runtime'
import { logger } from '@/lib/logger'
import type { ApiResponse, GridConfigName } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const configName = body.configName as GridConfigName | undefined

    // Ejecutar en background — responder inmediatamente
    runBacktest(configName).then(result => {
      botRuntime.lastBacktestMetrics = result.metrics
      botRuntime.lastBacktestFailed = !result.metrics.passed
      logger.info('[backtest/run] Backtest completado', { score: result.metrics.score, passed: result.metrics.passed })
    }).catch(err => {
      logger.error('[backtest/run] Error en backtest:', err)
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: 'Backtest iniciado. Resultado llegará via SSE backtest_completed.' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error iniciando backtest'
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
