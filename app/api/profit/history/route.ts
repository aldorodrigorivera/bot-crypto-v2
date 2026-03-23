export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getDailyProfitHistory } from '@/lib/database/trades'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(Number(searchParams.get('days') ?? 30), 90)
  logger.debug('GET /api/profit/history', { days })
  try {
    const config = getAppConfig()
    const history = await getDailyProfitHistory(config.bot.pair, days)
    logger.debug('GET /api/profit/history OK', { days, returned: history.length })
    return NextResponse.json<ApiResponse>({ success: true, data: history })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo historial de profit'
    logger.error('GET /api/profit/history ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
