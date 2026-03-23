export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { stopBot } from '@/lib/bot/scheduler'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function POST() {
  logger.info('POST /api/bot/stop')
  try {
    await stopBot()
    logger.info('POST /api/bot/stop OK')
    return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Bot detenido' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error deteniendo bot'
    logger.error('POST /api/bot/stop ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
