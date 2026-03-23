export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { stopBot, startBot } from '@/lib/bot/scheduler'
import { runtime as botRuntime } from '@/lib/runtime'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function POST() {
  const config = botRuntime.currentConfig
  logger.info('POST /api/bot/rebalance', { gridLevels: config?.gridLevels, gridRangePercent: config?.gridRangePercent })
  try {
    await stopBot()
    await startBot({
      gridLevels: config?.gridLevels,
      gridRangePercent: config?.gridRangePercent,
    })
    logger.info('POST /api/bot/rebalance OK')
    return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Bot rebalanceado' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error rebalanceando bot'
    logger.error('POST /api/bot/rebalance ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
