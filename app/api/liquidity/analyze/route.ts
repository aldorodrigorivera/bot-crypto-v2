export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runLiquidityAnalysis } from '@/lib/analysis/liquidityAnalyzer'
import { runtime as botRuntime } from '@/lib/runtime'
import { broadcastSSE } from '@/lib/sse'
import { getAppConfig } from '@/lib/config'
import { fetchCurrentPrice } from '@/lib/exchange/orders'
import type { ApiResponse } from '@/lib/types'

export async function POST() {
  try {
    const config = getAppConfig()
    const pair = config.bot.pair
    const totalLevels = botRuntime.currentConfig?.gridLevels ?? config.bot.gridLevels

    const currentPrice = botRuntime.botState
      ? (botRuntime.botState.gridMin + botRuntime.botState.gridMax) / 2
      : await fetchCurrentPrice(pair)

    const bias = await runLiquidityAnalysis(pair, currentPrice, totalLevels)

    botRuntime.lastGridBias = bias
    botRuntime.lastLiquidityAt = new Date()

    broadcastSSE('liquidity_analysis_completed', {
      direction: bias.direction,
      strength: bias.strength,
      confidence: bias.confidence,
      levelsAbove: bias.levelsAbove,
      levelsBelow: bias.levelsBelow,
      summary: bias.summary,
      overrideActive: bias.overrideActive,
      overrideReason: bias.overrideReason,
    })

    return NextResponse.json<ApiResponse>({ success: true, data: bias })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error ejecutando análisis de liquidez'
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
