import { fetchOrderBook, fetchRecentTrades } from '../exchange/orders'
import { getExchange } from '../exchange/binance'
import { logger } from '../logger'
import type { OBIResult, CVDResult, FundingRateResult } from '../types'

// ─── Order Book Imbalance ─────────────────────────────────────────────────

export async function calculateOBI(pair: string): Promise<OBIResult> {
  const { bids, asks } = await fetchOrderBook(pair, 20)

  // Volumen en USDT: precio × cantidad, solo top 10 niveles
  const bidVolume = bids.slice(0, 10).reduce((acc, [price, qty]) => acc + price * qty, 0)
  const askVolume = asks.slice(0, 10).reduce((acc, [price, qty]) => acc + price * qty, 0)

  const ratio = askVolume > 0 ? bidVolume / askVolume : 1

  let bias: OBIResult['bias']
  let strength: number

  if (ratio > 1.5) {
    bias = 'bullish'
    strength = Math.min(100, 70 + (ratio - 1.5) * 40)
  } else if (ratio > 1.2) {
    bias = 'bullish'
    strength = 40 + (ratio - 1.2) * 100
  } else if (ratio >= 0.8) {
    bias = 'neutral'
    strength = Math.abs(ratio - 1) * 100
  } else if (ratio >= 0.5) {
    bias = 'bearish'
    strength = 40 + (0.8 - ratio) * 100
  } else {
    bias = 'bearish'
    strength = Math.min(100, 70 + (0.5 - ratio) * 40)
  }

  strength = Math.round(Math.min(100, Math.max(0, strength)))

  logger.debug('[OBI] ratio=%s bias=%s strength=%d', ratio.toFixed(3), bias, strength)

  return { bidVolume, askVolume, ratio, bias, strength }
}

// ─── Cumulative Volume Delta ──────────────────────────────────────────────

export async function calculateCVD(pair: string): Promise<CVDResult> {
  const trades = await fetchRecentTrades(pair, 500)

  const lowDataWarning = trades.length < 100

  const buyVolume = trades
    .filter(t => t.side === 'buy')
    .reduce((acc, t) => acc + t.amount, 0)

  const sellVolume = trades
    .filter(t => t.side === 'sell')
    .reduce((acc, t) => acc + t.amount, 0)

  const delta = buyVolume - sellVolume
  const totalVolume = buyVolume + sellVolume
  const cumulativeDelta = delta  // con 500 trades esto es el delta del período disponible

  let trend: CVDResult['trend']
  let strength: number

  if (totalVolume === 0) {
    trend = 'neutral'
    strength = 0
  } else {
    const deltaRatio = Math.abs(delta) / totalVolume  // 0-1
    strength = Math.round(Math.min(100, deltaRatio * 200))  // escalar a 0-100

    if (delta > 0 && deltaRatio > 0.05) {
      trend = 'accumulation'
    } else if (delta < 0 && deltaRatio > 0.05) {
      trend = 'distribution'
    } else {
      trend = 'neutral'
    }
  }

  if (lowDataWarning) {
    strength = Math.round(strength * 0.7)  // reducir confianza si hay pocos datos
  }

  logger.debug('[CVD] delta=%s trend=%s strength=%d lowData=%s',
    delta.toFixed(0), trend, strength, lowDataWarning)

  return { buyVolume, sellVolume, delta, cumulativeDelta, trend, strength, lowDataWarning }
}

// ─── Funding Rate ─────────────────────────────────────────────────────────

export async function fetchFundingRateSignal(_pair: string): Promise<FundingRateResult> {
  try {
    const exchange = getExchange()
    // El funding rate es de futuros perpetuos — siempre usar XRP/USDT independiente del par spot
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await (exchange as any).fetchFundingRate('XRP/USDT')
    const rate: number = data?.fundingRate ?? data?.info?.lastFundingRate ?? 0

    let interpretation: FundingRateResult['interpretation']
    let riskLevel: FundingRateResult['riskLevel']
    let note: string

    if (rate > 0.05 / 100) {
      interpretation = 'longs_paying'
      riskLevel = 'high'
      note = 'Longs pagando mucho — riesgo de long squeeze, reducir sesgo alcista'
    } else if (rate > 0.01 / 100) {
      interpretation = 'longs_paying'
      riskLevel = 'low'
      note = 'Longs pagando — sesgo alcista moderado en futuros'
    } else if (rate < -0.05 / 100) {
      interpretation = 'shorts_paying'
      riskLevel = 'high'
      note = 'Shorts pagando mucho — riesgo de short squeeze, reducir sesgo bajista'
    } else if (rate < -0.01 / 100) {
      interpretation = 'shorts_paying'
      riskLevel = 'low'
      note = 'Shorts pagando — sesgo bajista moderado en futuros'
    } else {
      interpretation = 'neutral'
      riskLevel = 'low'
      note = 'Funding neutral — sin presión adicional de futuros'
    }

    logger.debug('[FundingRate] rate=%s interpretation=%s', rate, interpretation)

    return { rate, interpretation, riskLevel, note }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.debug('[FundingRate] No disponible (normal en testnet/spot):', msg)
    return {
      rate: 0,
      interpretation: 'neutral',
      riskLevel: 'low',
      note: 'Funding rate no disponible — tratado como neutral',
      unavailable: true,
    }
  }
}
