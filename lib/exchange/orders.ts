/* eslint-disable @typescript-eslint/no-explicit-any */
import { getExchange } from './binance'
import { broadcastSSE } from '../sse'
import { logger } from '../logger'
import type { AccountBalance, ExchangeOrder, OrderSide } from '../types'

// Mock mode solo afecta operaciones autenticadas (balance, órdenes).
// Datos de mercado (precio, OHLCV, order book) siempre son reales — son públicos.
const isMock = () => process.env.MOCK_BALANCE === 'true'
export const isMockMode = isMock
let mockCounter = 0

// ─── Rate Limiter Preventivo (límite real de Binance: 50 órdenes/10s) ────────
const BINANCE_ORDERS_PER_10S = 50
const RATE_LIMIT_THRESHOLD = 45 // 90% del límite — umbral preventivo

interface RateLimiterState {
  count: number
  windowStart: number
}

const _rl: RateLimiterState = { count: 0, windowStart: Date.now() }

/** Expone el estado actual del rate limiter para el endpoint /api/status */
export function getRateLimiterState(): { count: number; windowStart: number; limitBinance: number } {
  return { count: _rl.count, windowStart: _rl.windowStart, limitBinance: BINANCE_ORDERS_PER_10S }
}

async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  if (now - _rl.windowStart >= 10_000) {
    _rl.count = 0
    _rl.windowStart = now
  }
  if (_rl.count >= RATE_LIMIT_THRESHOLD) {
    const waitMs = 10_000 - (now - _rl.windowStart)
    const msg =
      `Rate limit preventivo de Binance: esperando ${waitMs}ms ` +
      `(${_rl.count}/${BINANCE_ORDERS_PER_10S} órdenes en ventana actual)`
    logger.warn(msg)
    broadcastSSE('risk_alert', { message: 'Rate limit preventivo de Binance activado', kind: 'rate_limit', waitMs, ordersCount: _rl.count, ordersLimit: BINANCE_ORDERS_PER_10S })
    await new Promise(res => setTimeout(res, waitMs))
    _rl.count = 0
    _rl.windowStart = Date.now()
  }
  _rl.count++
  return fn()
}

// ─── Balance ──────────────────────────────────────────────────────────────
export async function readAccountBalance(pair: string): Promise<AccountBalance> {
  if (isMock()) {
    return {
      totalBase: 100,
      freeBase: 50,
      usedBase: 50,
      totalUSDC: 100,
      freeUSDC: 500,
    }
  }

  const [base] = pair.split('/')
  const exchange = getExchange()
  const balance = await exchange.fetchBalance()

  return {
    totalBase: (balance[base]?.total as number) ?? 0,
    freeBase: (balance[base]?.free as number) ?? 0,
    usedBase: (balance[base]?.used as number) ?? 0,
    totalUSDC: (balance['USDC']?.total as number) ?? 0,
    freeUSDC: (balance['USDC']?.free as number) ?? 0,
  }
}

// ─── Verificar conexión ───────────────────────────────────────────────────
export async function verifyBinanceConnection(): Promise<void> {
  if (isMock()) return
  const exchange = getExchange()
  await exchange.fetchStatus()
}

// ─── Precio actual (siempre real — dato público) ──────────────────────────
export async function fetchCurrentPrice(pair: string): Promise<number> {
  const exchange = getExchange()
  const ticker = await exchange.fetchTicker(pair)
  return ticker.last ?? ticker.close ?? 0
}

// ─── OHLCV (siempre real — dato público) ─────────────────────────────────
export async function fetchOHLCV(
  pair: string,
  timeframe = '1h',
  limit = 100
): Promise<number[][]> {
  const exchange = getExchange()
  return exchange.fetchOHLCV(pair, timeframe, undefined, limit) as Promise<number[][]>
}

// ─── Order Book (siempre real — dato público) ─────────────────────────────
export async function fetchOrderBook(
  pair: string,
  limit = 20
): Promise<{ bids: number[][]; asks: number[][] }> {
  const exchange = getExchange()
  const book = await exchange.fetchOrderBook(pair, limit)
  return { bids: book.bids as number[][], asks: book.asks as number[][] }
}

// ─── Recientes trades (siempre real — dato público) ───────────────────────
export async function fetchRecentTrades(
  pair: string,
  limit = 50
): Promise<Array<{ side: string; amount: number }>> {
  const exchange = getExchange()
  const trades = await exchange.fetchTrades(pair, undefined, limit)
  return trades.map((t: any) => ({ side: t.side, amount: t.amount }))
}

// ─── Colocar orden límite ─────────────────────────────────────────────────
export async function placeLimitOrder(
  pair: string,
  side: OrderSide,
  amount: number,
  price: number
): Promise<ExchangeOrder> {
  if (isMock()) {
    mockCounter++
    return {
      id: `MOCK-${Date.now()}-${mockCounter}`,
      side,
      price,
      amount,
      filled: 0,
      remaining: amount,
      status: 'open',
      timestamp: Date.now(),
      symbol: pair,
    }
  }

  return withRateLimit(async () => {
    const exchange = getExchange()
    const order = await exchange.createLimitOrder(pair, side, amount, price)
    logger.info(`Orden ${side} colocada: ${amount} @ ${price}`, { orderId: order.id })
    return {
      id: order.id,
      side: order.side as OrderSide,
      price: order.price,
      amount: order.amount,
      filled: order.filled,
      remaining: order.remaining,
      status: order.status as ExchangeOrder['status'],
      timestamp: order.timestamp,
      symbol: order.symbol,
    }
  })
}

// ─── Cancelar orden ───────────────────────────────────────────────────────
export async function cancelOrder(orderId: string, pair: string): Promise<void> {
  if (isMock()) return
  const exchange = getExchange()
  await exchange.cancelOrder(orderId, pair)
  logger.info(`Orden cancelada: ${orderId}`)
}

// ─── Cancelar todas ───────────────────────────────────────────────────────
export async function cancelAllOrders(pair: string): Promise<void> {
  if (isMock()) return
  const exchange = getExchange()
  await exchange.cancelAllOrders(pair)
  logger.info(`Todas las órdenes canceladas para ${pair}`)
}

// ─── Órdenes abiertas ─────────────────────────────────────────────────────
export async function fetchOpenOrders(pair: string): Promise<ExchangeOrder[]> {
  if (isMock()) return []
  const exchange = getExchange()
  const orders = await exchange.fetchOpenOrders(pair)
  return orders.map((o: any) => ({
    id: o.id,
    side: o.side as OrderSide,
    price: o.price,
    amount: o.amount,
    filled: o.filled,
    remaining: o.remaining,
    status: o.status as ExchangeOrder['status'],
    timestamp: o.timestamp,
    symbol: o.symbol,
  }))
}

// ─── Órdenes cerradas ─────────────────────────────────────────────────────
export async function fetchClosedOrders(pair: string): Promise<ExchangeOrder[]> {
  if (isMock()) return []
  const exchange = getExchange()
  const orders = await exchange.fetchClosedOrders(pair, undefined, 50)
  return orders.map((o: any) => ({
    id: o.id,
    side: o.side as OrderSide,
    price: o.price,
    amount: o.amount,
    filled: o.filled,
    remaining: o.remaining,
    status: o.status as ExchangeOrder['status'],
    timestamp: o.timestamp,
    symbol: o.symbol,
  }))
}
