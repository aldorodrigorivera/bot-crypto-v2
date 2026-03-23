export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { resumeBot } from '@/lib/bot/scheduler'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function POST() {
  logger.info('POST /api/bot/resume')
  try {
    await resumeBot()
    logger.info('POST /api/bot/resume OK')
    return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Bot reanudado' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error reanudando bot'
    logger.error('POST /api/bot/resume ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
