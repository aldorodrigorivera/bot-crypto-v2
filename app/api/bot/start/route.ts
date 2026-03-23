export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { startBot } from '@/lib/bot/scheduler'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  logger.info('POST /api/bot/start', { resume: body.resume, gridLevels: body.gridLevels, gridRangePercent: body.gridRangePercent })
  try {
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
