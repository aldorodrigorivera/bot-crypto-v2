export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getLatestLiquiditySnapshot } from '@/lib/database/liquiditySnapshots'
import { runtime as botRuntime } from '@/lib/runtime'
import { getAppConfig } from '@/lib/config'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  try {
    const config = getAppConfig()
    // Preferir el bias en memoria (más fresco) sobre el snapshot de DB
    const memoryBias = botRuntime.lastGridBias
    if (memoryBias) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          source: 'memory',
          recordedAt: botRuntime.lastLiquidityAt,
          direction: memoryBias.direction,
          strength: memoryBias.strength,
          confidence: memoryBias.confidence,
          levelsAbove: memoryBias.levelsAbove,
          levelsBelow: memoryBias.levelsBelow,
          overrideActive: memoryBias.overrideActive,
          overrideReason: memoryBias.overrideReason,
          summary: memoryBias.summary,
          signals: {
            obi: { ratio: memoryBias.signals.obi.ratio, bias: memoryBias.signals.obi.bias, strength: memoryBias.signals.obi.strength },
            cvd: { delta: memoryBias.signals.cvd.delta, trend: memoryBias.signals.cvd.trend, strength: memoryBias.signals.cvd.strength, lowDataWarning: memoryBias.signals.cvd.lowDataWarning },
            fundingRate: { rate: memoryBias.signals.fundingRate.rate, interpretation: memoryBias.signals.fundingRate.interpretation, note: memoryBias.signals.fundingRate.note, unavailable: memoryBias.signals.fundingRate.unavailable },
          },
        },
      })
    }

    const snapshot = await getLatestLiquiditySnapshot(config.bot.pair)
    return NextResponse.json<ApiResponse>({ success: true, data: snapshot ? { source: 'db', ...snapshot } : null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo análisis de liquidez'
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
