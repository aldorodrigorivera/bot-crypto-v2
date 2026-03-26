export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runtime as botRuntime } from '@/lib/runtime'
import { fetchCurrentPrice, readAccountBalance, getRateLimiterState } from '@/lib/exchange/orders'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { ApiResponse, StatusResponse } from '@/lib/types'

export async function GET() {
  logger.debug('GET /api/status')
  try {
    const config = getAppConfig()
    const pair = config.bot.pair

    const [currentPrice, balance] = await Promise.all([
      fetchCurrentPrice(pair).catch(() => 0),
      readAccountBalance(pair).catch(() => null),
    ])

    const activePercent = config.bot.activePercent / 100
    const liveBalance = balance ? {
      totalBase: balance.totalBase,
      freeBase: balance.freeBase,
      activeBase: balance.totalBase * activePercent,
      activeUSDC: balance.freeUSDC * 0.5,
      totalUSDC: balance.totalUSDC,
    } : null

    const rl = getRateLimiterState()
    const maxDailyTrades = config.bot.maxDailyTrades

    const data: StatusResponse = {
      isRunning: botRuntime.isRunning,
      isPaused: botRuntime.isPaused,
      botState: botRuntime.botState,
      currentConfig: botRuntime.currentConfig,
      currentPrice,
      openOrdersCount: Array.from(botRuntime.activeOrders.values()).filter(o => o.status === 'open').length,
      pair,
      mode: config.binance.testnet ? 'TESTNET' : 'PRODUCCIÓN',
      activePercent: config.bot.activePercent,
      liveBalance,
      rateLimits: {
        dailyTradesUsed: botRuntime.dailyTradesCount,
        dailyTradesLimit: maxDailyTrades,
        dailyTradesLimitBinance: 160_000,
        dailyTradesPercent: Math.round((botRuntime.dailyTradesCount / maxDailyTrades) * 100),
        ordersLast10s: rl.count,
        ordersLast10sLimitBinance: 50,
      },
    }

    logger.debug('GET /api/status OK', { isRunning: data.isRunning, isPaused: data.isPaused, price: currentPrice, openOrders: data.openOrdersCount })
    return NextResponse.json<ApiResponse<StatusResponse>>({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo estado'
    logger.error('GET /api/status ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
