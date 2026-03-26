import { fetchOrderBook, fetchOHLCV } from '../exchange/orders'
import { logger } from '../logger'
import type { LiquidityLevel, LiquidityMap } from '../types'

// Umbral de distancia para considerar que el precio está "cerca" de un cluster (%)
const NEAR_THRESHOLD_PCT = 0.5

// ─── Clusters desde order book profundo ──────────────────────────────────

function findOrderBookClusters(
  bids: number[][],
  asks: number[][],
  currentPrice: number
): LiquidityLevel[] {
  const levels: LiquidityLevel[] = []

  // Agrupar bids y asks en buckets de 0.1% de precio
  const bucketSize = currentPrice * 0.001

  const buckets = new Map<number, { volume: number; side: 'bid' | 'ask' }>()

  for (const [price, qty] of [...bids, ...asks]) {
    const bucket = Math.round(price / bucketSize) * bucketSize
    const existing = buckets.get(bucket)
    const vol = price * qty
    if (existing) {
      existing.volume += vol
    } else {
      buckets.set(bucket, { volume: vol, side: price < currentPrice ? 'bid' : 'ask' })
    }
  }

  // Calcular volumen promedio para identificar clusters significativos
  const volumes = Array.from(buckets.values()).map(b => b.volume)
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1)

  for (const [price, { volume, side }] of buckets) {
    if (volume < avgVolume * 1.8) continue  // solo niveles con volumen notable

    const distanceFromCurrent = Math.abs((price - currentPrice) / currentPrice) * 100
    if (distanceFromCurrent > 15) continue  // ignorar niveles muy lejanos

    const strengthRaw = Math.min(100, (volume / avgVolume - 1) * 30)
    const strength = Math.round(Math.max(10, strengthRaw))

    levels.push({
      price,
      volume,
      type: side === 'bid' ? 'support' : 'resistance',
      strength,
      distanceFromCurrent,
    })
  }

  return levels
}

// ─── Soportes/resistencias desde historial OHLCV ─────────────────────────

function findOHLCVLevels(
  ohlcv: number[][],
  currentPrice: number
): LiquidityLevel[] {
  const levels: LiquidityLevel[] = []
  const tolerance = currentPrice * 0.003  // 0.3% para considerar mismo nivel

  // Contar cuántas veces cada high/low actuó como soporte o resistencia
  const touchCounts = new Map<number, { count: number; type: 'support' | 'resistance' }>()

  for (let i = 1; i < ohlcv.length - 1; i++) {
    const [, , high, low] = ohlcv[i]

    // High que fue rechazado en velas siguientes → resistencia
    const rejectedHigh = ohlcv.slice(i + 1, i + 4).some(([, , h]) => h < high - tolerance)
    if (rejectedHigh) {
      const key = Math.round(high / tolerance) * tolerance
      const existing = touchCounts.get(key)
      touchCounts.set(key, { count: (existing?.count ?? 0) + 1, type: 'resistance' })
    }

    // Low que fue respetado en velas siguientes → soporte
    const respectedLow = ohlcv.slice(i + 1, i + 4).some(([, , , l]) => l > low + tolerance)
    if (respectedLow) {
      const key = Math.round(low / tolerance) * tolerance
      const existing = touchCounts.get(key)
      touchCounts.set(key, { count: (existing?.count ?? 0) + 1, type: 'support' })
    }
  }

  for (const [price, { count, type }] of touchCounts) {
    if (count < 2) continue  // necesita al menos 2 toques para ser relevante

    const distanceFromCurrent = Math.abs((price - currentPrice) / currentPrice) * 100
    if (distanceFromCurrent > 15) continue

    levels.push({
      price,
      volume: 0,  // OHLCV no tiene volumen por nivel
      type,
      strength: Math.min(100, count * 20),
      distanceFromCurrent,
    })
  }

  return levels
}

// ─── Combinar y deduplicar niveles ────────────────────────────────────────

function mergeLevels(
  obLevels: LiquidityLevel[],
  ohlcvLevels: LiquidityLevel[],
  currentPrice: number
): LiquidityLevel[] {
  const tolerance = currentPrice * 0.003
  const merged: LiquidityLevel[] = [...obLevels]

  for (const ohlcvLevel of ohlcvLevels) {
    const nearby = merged.find(l =>
      Math.abs(l.price - ohlcvLevel.price) < tolerance && l.type === ohlcvLevel.type
    )
    if (nearby) {
      // Reforzar el nivel si ya existe en el order book
      nearby.strength = Math.min(100, nearby.strength + ohlcvLevel.strength * 0.5)
    } else {
      merged.push(ohlcvLevel)
    }
  }

  return merged.sort((a, b) => a.price - b.price)
}

// ─── Export principal ─────────────────────────────────────────────────────

export async function buildLiquidityMap(
  pair: string,
  currentPrice: number
): Promise<LiquidityMap> {
  const [{ bids, asks }, ohlcv] = await Promise.all([
    fetchOrderBook(pair, 100),
    fetchOHLCV(pair, '1h', 48),
  ])

  const obLevels = findOrderBookClusters(bids, asks, currentPrice)
  const ohlcvLevels = findOHLCVLevels(ohlcv, currentPrice)
  const levels = mergeLevels(obLevels, ohlcvLevels, currentPrice)

  // Niveles de resistencia por encima del precio
  const resistances = levels
    .filter(l => l.type === 'resistance' && l.price > currentPrice)
    .sort((a, b) => a.price - b.price)

  // Niveles de soporte por debajo del precio
  const supports = levels
    .filter(l => l.type === 'support' && l.price < currentPrice)
    .sort((a, b) => b.price - a.price)

  const nearestResistance = resistances[0] ?? null
  const nearestSupport = supports[0] ?? null

  // Determinar zona actual
  let currentZone: LiquidityMap['currentZone'] = 'in_range'
  if (nearestResistance && nearestResistance.distanceFromCurrent < NEAR_THRESHOLD_PCT) {
    currentZone = 'near_resistance'
  } else if (nearestSupport && nearestSupport.distanceFromCurrent < NEAR_THRESHOLD_PCT) {
    currentZone = 'near_support'
  }

  logger.debug('[LiquidityMap] %d niveles encontrados, zona=%s, resistencia=%s, soporte=%s',
    levels.length,
    currentZone,
    nearestResistance?.price.toFixed(4) ?? 'N/A',
    nearestSupport?.price.toFixed(4) ?? 'N/A',
  )

  return { levels, nearestResistance, nearestSupport, currentZone }
}
