export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runMarketAnalysis } from '@/lib/analysis/market'
import { runLayer3Agent } from '@/lib/analysis/layer3-agent'
import { runtime as botRuntime } from '@/lib/runtime'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { ApiResponse, StartupPreview } from '@/lib/types'

export async function GET() {
  logger.info('GET /api/bot/preview — ejecutando análisis de mercado previo')
  try {
    const config = getAppConfig()
    const analysis = await runMarketAnalysis(config.bot.pair)
    logger.info('GET /api/bot/preview — análisis OK', {
      pair: analysis.pair,
      price: analysis.currentPrice,
      trend: analysis.trend,
      volatility: analysis.volatility24h.toFixed(2) + '%',
      recommendedConfig: analysis.recommendedConfig.name,
    })

    let claudeRecommendation: StartupPreview['claudeRecommendation'] = null
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        // Timeout corto: si Claude tarda más de 8s, el modal abre igual sin recomendación
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000))
        const raw = await Promise.race([
          runLayer3Agent(botRuntime, analysis, 'startup_analysis'),
          timeout,
        ])
        if (raw && !raw.reasoning.includes('no disponible')) {
          claudeRecommendation = raw
          logger.info('GET /api/bot/preview — Capa 3 OK', {
            bias: claudeRecommendation.market_bias,
            action: claudeRecommendation.grid_adjustment.action,
            confidence: claudeRecommendation.confidence,
          })
        }
      } catch (err) {
        logger.warn('GET /api/bot/preview — Capa 3 falló, continuando sin recomendación', { err })
      }
    }

    const data: StartupPreview = { analysis, claudeRecommendation }
    return NextResponse.json<ApiResponse>({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error en análisis previo'
    logger.error('GET /api/bot/preview ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
