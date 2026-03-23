export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runMarketAnalysis } from '@/lib/analysis/market'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  logger.info('GET /api/bot/preview — ejecutando análisis de mercado previo')
  try {
    const config = getAppConfig()
    const analysis = await runMarketAnalysis(config.bot.pair)
    logger.info('GET /api/bot/preview OK', {
      pair: analysis.pair,
      price: analysis.currentPrice,
      trend: analysis.trend,
      volatility: analysis.volatility24h.toFixed(2) + '%',
      recommendedConfig: analysis.recommendedConfig.name,
    })
    return NextResponse.json<ApiResponse>({ success: true, data: analysis })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error en análisis previo'
    logger.error('GET /api/bot/preview ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
