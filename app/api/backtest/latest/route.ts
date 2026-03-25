export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getLatestBacktestResult } from '@/lib/database/backtestResults'
import { runtime as botRuntime } from '@/lib/runtime'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  try {
    const dbResult = await getLatestBacktestResult()
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        record: dbResult,
        inMemory: botRuntime.lastBacktestMetrics,
        failed: botRuntime.lastBacktestFailed,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo último backtest'
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
