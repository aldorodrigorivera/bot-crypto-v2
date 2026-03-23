import { getAppConfig } from '../config'
import type { Layer2Output, OrderSide, AgentBias } from '../types'

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema = (data: number[], period: number) => {
    const k = 2 / (period + 1)
    let emaVal = data[0]
    for (let i = 1; i < data.length; i++) emaVal = data[i] * k + emaVal * (1 - k)
    return emaVal
  }

  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const macd = ema12 - ema26
  const signal = macd * 0.9 // Simplified signal
  return { macd, signal, histogram: macd - signal }
}

function calcBollinger(closes: number[], period = 20, stdDevMult = 2) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0 }
  const slice = closes.slice(-period)
  const middle = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period
  const stdDev = Math.sqrt(variance)
  return {
    upper: middle + stdDevMult * stdDev,
    middle,
    lower: middle - stdDevMult * stdDev,
  }
}

function calcVWAP(ohlcv: number[]): number {
  const last24 = ohlcv.slice ? ohlcv.slice(-24) : [ohlcv]
  // Simplified — use typical price
  return Array.isArray(last24[0])
    ? (last24 as unknown as number[][]
      ).reduce((acc, c) => acc + ((c[2] + c[3] + c[4]) / 3) * c[5], 0) /
      (last24 as unknown as number[][]).reduce((acc, c) => acc + c[5], 0)
    : 0
}

export function runLayer2Analysis(
  ohlcv: number[][],
  orderBook: { bids: number[][]; asks: number[][] },
  orderSide: OrderSide
): Layer2Output {
  const config = getAppConfig()
  const closes = ohlcv.map(c => c[4])
  const current = closes[closes.length - 1]

  let totalContribution = 0
  const signals: Layer2Output['signals'] = {
    rsi: { value: 0, contribution: 0 },
    macd: { signal: '', contribution: 0 },
    bollinger: { position: '', contribution: 0 },
    vwap: { deviation: 0, contribution: 0 },
    momentum: { pattern: '', contribution: 0 },
    orderFlow: { imbalance: 0, contribution: 0 },
  }

  // ── 1. RSI (±28 pts) ──────────────────────────────────────────────────────
  const rsi = calcRSI(closes)
  signals.rsi.value = rsi
  if (orderSide === 'buy') {
    if (rsi < 30) signals.rsi.contribution = 28
    else if (rsi < 40) signals.rsi.contribution = 15
    else if (rsi > 70) signals.rsi.contribution = -28
    else if (rsi > 60) signals.rsi.contribution = -10
  } else {
    if (rsi > 70) signals.rsi.contribution = 28
    else if (rsi > 60) signals.rsi.contribution = 15
    else if (rsi < 30) signals.rsi.contribution = -28
    else if (rsi < 40) signals.rsi.contribution = -10
  }
  totalContribution += signals.rsi.contribution

  // ── 2. MACD (±15 pts) ─────────────────────────────────────────────────────
  const { macd, signal, histogram } = calcMACD(closes)
  const macdBullish = macd > signal
  signals.macd.signal = macdBullish ? 'bullish' : 'bearish'
  if (orderSide === 'buy' && macdBullish) signals.macd.contribution = 15
  else if (orderSide === 'sell' && !macdBullish) signals.macd.contribution = 15
  if (histogram > 0) signals.macd.contribution += 8
  totalContribution += signals.macd.contribution

  // ── 3. Bollinger Bands (±18 pts) ──────────────────────────────────────────
  const bb = calcBollinger(closes)
  const bbRange = bb.upper - bb.lower
  const bbPos = bbRange > 0 ? (current - bb.lower) / bbRange : 0.5
  if (bbPos < 0.1) {
    signals.bollinger.position = 'near_lower'
    if (orderSide === 'buy') signals.bollinger.contribution = 18
  } else if (bbPos > 0.9) {
    signals.bollinger.position = 'near_upper'
    if (orderSide === 'sell') signals.bollinger.contribution = 18
  } else {
    signals.bollinger.position = 'middle'
  }
  totalContribution += signals.bollinger.contribution

  // ── 4. VWAP (±12 pts) ────────────────────────────────────────────────────
  const vwap = calcVWAP(ohlcv as unknown as number[])
  if (vwap > 0) {
    const deviation = (current - vwap) / vwap
    signals.vwap.deviation = deviation * 100
    if (orderSide === 'buy' && current < vwap * 0.995) signals.vwap.contribution = 12
    else if (orderSide === 'sell' && current > vwap * 1.005) signals.vwap.contribution = 12
  }
  totalContribution += signals.vwap.contribution

  // ── 5. Momentum / Velas (±15 pts) ────────────────────────────────────────
  const last3 = closes.slice(-4)
  const reds = last3.slice(1).every((c, i) => c < last3[i])
  const greens = last3.slice(1).every((c, i) => c > last3[i])
  if (reds) {
    signals.momentum.pattern = 'red_exhaustion'
    if (orderSide === 'buy') signals.momentum.contribution = 15
  } else if (greens) {
    signals.momentum.pattern = 'green_exhaustion'
    if (orderSide === 'sell') signals.momentum.contribution = 15
  } else {
    signals.momentum.pattern = 'neutral'
  }
  totalContribution += signals.momentum.contribution

  // ── 6. Order Flow (±15 pts) ───────────────────────────────────────────────
  const buyVol = orderBook.bids.slice(0, 10).reduce((a, b) => a + b[1], 0)
  const sellVol = orderBook.asks.slice(0, 10).reduce((a, b) => a + b[1], 0)
  const totalFlow = buyVol + sellVol
  const imbalance = totalFlow > 0 ? (buyVol - sellVol) / totalFlow : 0
  signals.orderFlow.imbalance = imbalance
  if (orderSide === 'buy' && imbalance > 0.2) signals.orderFlow.contribution = 15
  else if (orderSide === 'sell' && imbalance < -0.2) signals.orderFlow.contribution = 15
  totalContribution += signals.orderFlow.contribution

  // ── Resultado ─────────────────────────────────────────────────────────────
  const probability = Math.min(85, Math.max(15, 50 + totalContribution))
  const minProb = config.bot.layer2MinProbability
  const approved = probability >= minProb

  let marketBias: AgentBias = 'neutral'
  if (probability > 60) marketBias = orderSide === 'buy' ? 'bullish' : 'bearish'
  else if (probability < 40) marketBias = orderSide === 'buy' ? 'bearish' : 'bullish'

  const sizeMultiplier = Math.min(1.2, Math.max(0, (probability - 50) / 50 * 0.7 + 0.5))

  return {
    probability,
    marketBias,
    sizeMultiplier,
    approved,
    signals,
    skipReason: approved ? undefined : `Probabilidad ${probability.toFixed(0)}% < mínimo ${minProb}%`,
  }
}
