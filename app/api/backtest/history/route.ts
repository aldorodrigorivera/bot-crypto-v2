export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getBacktestHistory } from '@/lib/database/backtestResults'
import type { ApiResponse } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20')
    const history = await getBacktestHistory(limit)
    return NextResponse.json<ApiResponse>({ success: true, data: { history } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo historial'
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
