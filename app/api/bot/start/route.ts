export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { startBot } from '@/lib/bot/scheduler'
import { runBacktest } from '@/lib/backtesting/engine'
import { getAppConfig } from '@/lib/config'
import { runtime as botRuntime } from '@/lib/runtime'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  logger.info('POST /api/bot/start', { resume: body.resume, gridLevels: body.gridLevels, forceStart: body.forceStart })

  try {
    const config = getAppConfig()

    // v3: Si BACKTEST_ENABLED y no es forceStart, validar backtest antes de arrancar
    if (config.backtest.enabled && !body.forceStart && !body.resume) {
      const btResult = await runBacktest()
      botRuntime.lastBacktestMetrics = btResult.metrics
      botRuntime.lastBacktestFailed = !btResult.metrics.passed

      if (!btResult.metrics.passed) {
        logger.warn('POST /api/bot/start — backtest no aprobado', { reasons: btResult.metrics.failedReasons })
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Backtest no aprobado. El bot no arrancará.',
          data: {
            backtestFailed: true,
            failedReasons: btResult.metrics.failedReasons,
            metrics: btResult.metrics,
            hint: 'Envía forceStart: true para arrancar de todas formas.',
          },
        } as ApiResponse, { status: 422 })
      }
    }

    await startBot({
      resume: body.resume ?? false,
      gridLevels: body.gridLevels,
      gridRangePercent: body.gridRangePercent,
    })
    logger.info('POST /api/bot/start OK')
    return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Bot iniciado' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error iniciando bot'
    logger.error('POST /api/bot/start ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
