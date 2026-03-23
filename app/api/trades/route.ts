export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getRecentTrades, getTodayTrades } from '@/lib/database/trades'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const today = searchParams.get('today') === 'true'
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 88)

  logger.debug('GET /api/trades', { today, limit })
  try {
    const config = getAppConfig()
    const trades = today
      ? await getTodayTrades(config.bot.pair, limit)
      : await getRecentTrades(config.bot.pair, limit)
    logger.debug('GET /api/trades OK', { returned: trades.length })
    return NextResponse.json<ApiResponse>({ success: true, data: trades })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo trades'
    logger.error('GET /api/trades ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
