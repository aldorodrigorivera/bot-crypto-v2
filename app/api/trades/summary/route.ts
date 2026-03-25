export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getTradesSummary } from '@/lib/database/trades'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import { withCache } from '@/lib/cache'
import type { ApiResponse } from '@/lib/types'

const CACHE_TTL = 30_000

export async function GET() {
  logger.debug('GET /api/trades/summary')
  try {
    const config = getAppConfig()
    const summary = await withCache(`trades-summary:${config.bot.pair}`, CACHE_TTL, () =>
      getTradesSummary(config.bot.pair)
    )
    logger.debug('GET /api/trades/summary OK', {
      totalTrades: summary.totalTrades,
      todayTrades: summary.todayTrades,
      totalProfitUSDC: summary.totalProfitUSDC.toFixed(4),
    })
    return NextResponse.json<ApiResponse>({ success: true, data: summary })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo resumen'
    logger.error('GET /api/trades/summary ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
