import { fetchOHLCV, fetchCurrentPrice } from '../exchange/orders'
import { readAccountBalance } from '../exchange/orders'
import { selectOptimalConfig } from './config-selector'
import { getAppConfig } from '../config'
import { saveMarketAnalysis } from '../database/marketAnalysis'
import type { MarketAnalysis, TrendDirection, TrendStrength } from '../types'

function calcSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function detectTrend(closes: number[]): { trend: TrendDirection; strength: TrendStrength } {
  const ma20 = calcSMA(closes, 20)
  const ma50 = calcSMA(closes, 50)
  const current = closes[closes.length - 1]

  const diff = (current - ma20) / ma20 * 100

  let trend: TrendDirection = 'sideways'
  let strength: TrendStrength = 'weak'

  if (ma20 > ma50 && current > ma20) {
    trend = 'bullish'
    strength = diff > 3 ? 'strong' : diff > 1 ? 'moderate' : 'weak'
  } else if (ma20 < ma50 && current < ma20) {
    trend = 'bearish'
    strength = Math.abs(diff) > 3 ? 'strong' : Math.abs(diff) > 1 ? 'moderate' : 'weak'
  }

  return { trend, strength }
}

export async function runMarketAnalysis(pair: string): Promise<MarketAnalysis> {
  const config = getAppConfig()

  const [ohlcv100, ohlcv7d, currentPrice] = await Promise.all([
    fetchOHLCV(pair, '1h', 100),
    fetchOHLCV(pair, '1d', 7),
    fetchCurrentPrice(pair),
  ])

  const closes = ohlcv100.map(c => c[4])
  const highs = ohlcv100.map(c => c[2])
  const lows = ohlcv100.map(c => c[3])
  const volumes = ohlcv100.map(c => c[5])

  // 24h stats usando las últimas 24 velas hourly
  const last24h = ohlcv100.slice(-24)
  const price24hHigh = Math.max(...last24h.map(c => c[2]))
  const price24hLow = Math.min(...last24h.map(c => c[3]))
  const priceChange24h = ((currentPrice - last24h[0][1]) / last24h[0][1]) * 100
  const volatility24h = ((price24hHigh - price24hLow) / price24hLow) * 100
  const volume24h = last24h.reduce((a, c) => a + c[5], 0)

  // Volumen del día anterior
  const prev24h = ohlcv100.slice(-48, -24)
  const prevVolume = prev24h.reduce((a, c) => a + c[5], 0)
  const volumeChange = prevVolume > 0 ? ((volume24h - prevVolume) / prevVolume) * 100 : 0

  // Rango diario promedio 7 días
  const averageDailyRange =
    ohlcv7d.reduce((acc, c) => acc + ((c[2] - c[3]) / c[3]) * 100, 0) / ohlcv7d.length

  const { trend, strength } = detectTrend(closes)

  const ma20 = calcSMA(closes, 20)
  const ma50 = calcSMA(closes, 50)
  const priceVsMA20 = ((currentPrice - ma20) / ma20) * 100
  const priceVsMA50 = ((currentPrice - ma50) / ma50) * 100

  // Balance y capital
  const balance = await readAccountBalance(pair)
  const activePercent = config.bot.activePercent / 100
  const activeBase = balance.totalBase * activePercent
  const reserveBase = balance.totalBase - activeBase
  const estimatedActiveUSDC = (activeBase / 2) * currentPrice
  const totalCapitalUSD = balance.totalBase * currentPrice + balance.totalUSDC

  const { config: recommendedConfig, reason: configReason } = selectOptimalConfig(
    volatility24h,
    trend,
    totalCapitalUSD
  )

  const analysis: MarketAnalysis = {
    timestamp: new Date(),
    pair,
    currentPrice,
    price24hHigh,
    price24hLow,
    priceChange24h,
    volatility24h,
    averageDailyRange,
    trend,
    trendStrength: strength,
    priceVsMA20,
    priceVsMA50,
    volume24h,
    volumeChange,
    totalBase: balance.totalBase,
    reserveBase,
    activeBase,
    estimatedActiveUSDC,
    recommendedConfig,
    configReason,
  }

  await saveMarketAnalysis(analysis).catch(() => {})
  return analysis
}
