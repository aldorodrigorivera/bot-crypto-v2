export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getExchange } from '@/lib/exchange/binance'
import { getAppConfig } from '@/lib/config'
import { runtime as botRuntime } from '@/lib/runtime'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

/**
 * Cancela TODAS las órdenes abiertas en Binance directamente,
 * ignorando MOCK_BALANCE. Útil para limpiar órdenes huérfanas del testnet.
 */
export async function POST() {
  logger.info('POST /api/bot/cancel-all')
  try {
    const config = getAppConfig()
    const pair = config.bot.pair
    const exchange = getExchange()

    const openOrders = await exchange.fetchOpenOrders(pair)
    if (openOrders.length === 0) {
      return NextResponse.json<ApiResponse>({ success: true, data: { cancelled: 0, message: 'No hay órdenes abiertas en Binance' } })
    }

    await exchange.cancelAllOrders(pair)
    botRuntime.activeOrders.clear()

    logger.info(`cancel-all: ${openOrders.length} órdenes canceladas en Binance (${pair})`)
    return NextResponse.json<ApiResponse>({
      success: true,
      data: { cancelled: openOrders.length, message: `${openOrders.length} órdenes canceladas en Binance` },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error cancelando órdenes'
    logger.error('POST /api/bot/cancel-all ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
