export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getLiquiditySnapshotHistory } from '@/lib/database/liquiditySnapshots'
import { getAppConfig } from '@/lib/config'
import type { ApiResponse } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)
    const config = getAppConfig()
    const history = await getLiquiditySnapshotHistory(config.bot.pair, limit)
    return NextResponse.json<ApiResponse>({ success: true, data: history })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo historial de liquidez'
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
