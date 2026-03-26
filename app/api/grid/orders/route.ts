export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runtime as botRuntime } from '@/lib/runtime'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  logger.debug('GET /api/grid/orders')
  try {
    const ordersMap = botRuntime.activeOrders
    const BINANCE_FEE = 0.001 // 0.1% por lado

    const orders = Array.from(ordersMap.values())
      .filter(o => o.status === 'open')
      .sort((a, b) => b.price - a.price) // de mayor a menor precio
      .slice(0, 20)
      .map(o => {
        // Para órdenes SELL con pairedOrderId: buscar el precio de compra original
        const pairedOrder = o.pairedOrderId ? ordersMap.get(o.pairedOrderId) : null
        const pairedPrice = pairedOrder?.price ?? null

        // Ganancia estimada del ciclo si se llena esta orden
        let estimatedProfit: number | null = null
        if (o.side === 'sell' && pairedPrice !== null) {
          const gross = (o.price - pairedPrice) * o.amount
          const fees = (o.price + pairedPrice) * o.amount * BINANCE_FEE
          estimatedProfit = gross - fees
        }

        return {
          orderId: o.orderId,
          level: o.level,
          side: o.side,
          price: o.price,
          amount: o.amount,
          status: o.status,
          pairedPrice,        // para sell: precio al que se compró; para buy: null
          estimatedProfit,    // ganancia estimada si se llena (solo en sells)
        }
      })

    logger.debug('GET /api/grid/orders OK', { count: orders.length })
    return NextResponse.json<ApiResponse>({ success: true, data: orders })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo órdenes'
    logger.error('GET /api/grid/orders ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
