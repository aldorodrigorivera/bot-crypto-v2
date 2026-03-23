export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getGridEfficiencyHistory } from '@/lib/database/gridEfficiency'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(Number(searchParams.get('days') ?? 7), 30)
  logger.debug('GET /api/efficiency', { days })
  try {
    const history = await getGridEfficiencyHistory(days)
    logger.debug('GET /api/efficiency OK', { days, returned: history.length })
    return NextResponse.json<ApiResponse>({ success: true, data: history })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo eficiencia'
    logger.error('GET /api/efficiency ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
