export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runtime as botRuntime } from '@/lib/runtime'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  logger.debug('GET /api/grid/orders')
  try {
    const orders = Array.from(botRuntime.activeOrders.values())
      .filter(o => o.status === 'open')
      .sort((a, b) => b.level - a.level) // niveles más recientes primero
      .slice(0, 10)
    logger.debug('GET /api/grid/orders OK', { count: orders.length })
    return NextResponse.json<ApiResponse>({ success: true, data: orders })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo órdenes'
    logger.error('GET /api/grid/orders ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
