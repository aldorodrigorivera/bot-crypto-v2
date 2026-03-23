export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getLatestMarketAnalysis } from '@/lib/database/marketAnalysis'
import { runtime as botRuntime } from '@/lib/runtime'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  logger.debug('GET /api/market/analysis')
  try {
    const config = getAppConfig()
    const source = botRuntime.lastAnalysis ? 'memory' : 'database'
    const analysis = botRuntime.lastAnalysis ?? await getLatestMarketAnalysis(config.bot.pair)
    logger.debug('GET /api/market/analysis OK', { source, pair: config.bot.pair })
    return NextResponse.json<ApiResponse>({ success: true, data: analysis })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo análisis'
    logger.error('GET /api/market/analysis ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
