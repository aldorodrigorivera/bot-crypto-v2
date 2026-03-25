import { getExchange } from '../exchange/binance'
import { logger } from '../logger'
import type { OHLCVCandle } from '../types'

interface DataLoaderConfig {
  pair: string
  timeframe: string
  days: number
}

interface CacheEntry {
  data: OHLCVCandle[]
  expiresAt: number
}

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutos
const BATCH_SIZE = 1000
const g = globalThis as { ohlcvCache?: Map<string, CacheEntry> }
if (!g.ohlcvCache) g.ohlcvCache = new Map()
const cache: Map<string, CacheEntry> = g.ohlcvCache

export async function loadHistoricalData(config: DataLoaderConfig): Promise<OHLCVCandle[]> {
  const cacheKey = `${config.pair}-${config.timeframe}-${config.days}`
  const now = Date.now()

  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    logger.info(`[dataLoader] Cache hit: ${cached.data.length} velas para ${config.pair}`)
    return cached.data
  }

  const exchange = getExchange()
  const sinceMs = now - config.days * 24 * 60 * 60 * 1000
  const allCandles: OHLCVCandle[] = []
  let since = sinceMs

  logger.info(`[dataLoader] Descargando ${config.days} días de OHLCV para ${config.pair} (${config.timeframe})...`)

  while (true) {
    const raw = await exchange.fetchOHLCV(config.pair, config.timeframe, since, BATCH_SIZE)
    if (!raw || raw.length === 0) break

    const candles: OHLCVCandle[] = raw.map((c: (number | string)[]) => ({
      timestamp: c[0] as number,
      open: c[1] as number,
      high: c[2] as number,
      low: c[3] as number,
      close: c[4] as number,
      volume: c[5] as number,
    }))

    allCandles.push(...candles)

    const lastTs = candles[candles.length - 1].timestamp
    logger.info(`[dataLoader] Descargando datos históricos: ${allCandles.length} velas...`)

    if (candles.length < BATCH_SIZE) break
    if (lastTs >= now) break

    // Avanzar al siguiente lote (evitar solapamiento)
    since = lastTs + 1
  }

  if (allCandles.length === 0) {
    throw new Error(
      `[dataLoader] No se pudieron descargar datos históricos para ${config.pair}. ` +
      `Verifica la conexión a Binance y que el par sea válido.`
    )
  }

  // Ordenar y deduplicar por timestamp
  const unique = Array.from(
    new Map(allCandles.map(c => [c.timestamp, c])).values()
  ).sort((a, b) => a.timestamp - b.timestamp)

  cache.set(cacheKey, { data: unique, expiresAt: now + CACHE_TTL_MS })
  logger.info(`[dataLoader] ${unique.length} velas descargadas y cacheadas (30 min)`)

  return unique
}
