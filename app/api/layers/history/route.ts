export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getRecentLayerAnalysis } from '@/lib/database/layerAnalysis'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  logger.debug('GET /api/layers/history', { limit })
  try {
    const history = await getRecentLayerAnalysis(limit)
    logger.debug('GET /api/layers/history OK', { returned: history.length })
    return NextResponse.json<ApiResponse>({ success: true, data: history })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo historial de capas'
    logger.error('GET /api/layers/history ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
