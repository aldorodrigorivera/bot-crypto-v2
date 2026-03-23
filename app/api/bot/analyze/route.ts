export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runMarketAnalysis } from '@/lib/analysis/market'
import { runtime as botRuntime } from '@/lib/runtime'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function POST() {
  logger.info('POST /api/bot/analyze — forzando re-análisis de mercado')
  try {
    const config = getAppConfig()
    const analysis = await runMarketAnalysis(config.bot.pair)
    botRuntime.lastAnalysis = analysis
    logger.info('POST /api/bot/analyze OK', {
      pair: analysis.pair,
      price: analysis.currentPrice,
      trend: analysis.trend,
      volatility: analysis.volatility24h.toFixed(2) + '%',
      recommendedConfig: analysis.recommendedConfig.name,
    })
    return NextResponse.json<ApiResponse>({ success: true, data: analysis })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error en análisis'
    logger.error('POST /api/bot/analyze ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
