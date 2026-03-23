export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getGridConfig } from '@/lib/database/config'
import { runtime as botRuntime } from '@/lib/runtime'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  logger.debug('GET /api/config/check')
  try {
    const config = getAppConfig()
    const dbConfig = await getGridConfig(config.bot.pair)
    const recommended = botRuntime.lastAnalysis?.recommendedConfig
    const needsUpdate = recommended && dbConfig
      ? dbConfig.gridLevels !== recommended.gridLevels || dbConfig.gridRangePercent !== recommended.gridRangePercent
      : false

    logger.debug('GET /api/config/check OK', { needsUpdate, currentLevels: dbConfig?.gridLevels, recommendedLevels: recommended?.gridLevels })
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        current: dbConfig,
        recommended: recommended ? { name: recommended.name, gridLevels: recommended.gridLevels, gridRangePercent: recommended.gridRangePercent } : null,
        needsUpdate,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error verificando config'
    logger.error('GET /api/config/check ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
