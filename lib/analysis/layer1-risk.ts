import { getAppConfig } from '../config'
import type { Layer1Input, Layer1Output } from '../types'

function calcATR(ohlcv: number[][], period: number): number {
  if (ohlcv.length < period + 1) return 0
  const trs = ohlcv.slice(-period - 1).map((c, i, arr) => {
    if (i === 0) return c[2] - c[3]
    const prevClose = arr[i - 1][4]
    return Math.max(c[2] - c[3], Math.abs(c[2] - prevClose), Math.abs(c[3] - prevClose))
  })
  trs.shift()
  return trs.reduce((a, b) => a + b, 0) / period
}

export function runLayer1Analysis(input: Layer1Input): Layer1Output {
  const config = getAppConfig()
  const { orderSide, orderPrice, currentPrice, ohlcv, orderBook, recentTrades, gridRange } = input

  // ── Volatilidad (35%) ─────────────────────────────────────────────────────
  const atr5 = calcATR(ohlcv, 5)
  const atr20 = calcATR(ohlcv, 20)
  const atrRatio = atr20 > 0 ? atr5 / atr20 : 1

  let volatilityScore: number
  if (atrRatio < 0.8) volatilityScore = 90
  else if (atrRatio < 1.2) volatilityScore = 70
  else if (atrRatio < 1.6) volatilityScore = 70
  else if (atrRatio < 2.2) volatilityScore = 50
  else volatilityScore = 15

  // ── Posición en grid (30%) ────────────────────────────────────────────────
  let positionScore: number
  const { min, max } = gridRange

  if (orderPrice < min || orderPrice > max) {
    // Fuera del grid — bloquear
    return {
      riskScore: 0,
      approved: false,
      maxSizeMultiplier: 0,
      subScores: { volatility: volatilityScore, position: 0, orderBook: 50, volume: 50 },
      blockedReason: 'Orden fuera del rango del grid',
    }
  }

  const range = max - min
  const posRatio = (orderPrice - min) / range // 0 = bottom, 1 = top
  // En extremos del grid (reversión probable) → más score
  const distanceFromCenter = Math.abs(posRatio - 0.5) * 2 // 0=center, 1=extreme
  positionScore = 40 + distanceFromCenter * 50

  // ── Order Book (25%) ──────────────────────────────────────────────────────
  const bidVol = orderBook.bids.slice(0, 5).reduce((a, b) => a + b[1], 0)
  const askVol = orderBook.asks.slice(0, 5).reduce((a, b) => a + b[1], 0)
  const totalVol = bidVol + askVol
  const ratio = totalVol > 0 ? bidVol / askVol : 1

  let orderBookScore: number
  if (orderSide === 'buy') {
    if (ratio > 1.5) orderBookScore = 80
    else if (ratio > 1.0) orderBookScore = 60
    else orderBookScore = 40
  } else {
    if (ratio < 0.7) orderBookScore = 80
    else if (ratio < 1.0) orderBookScore = 60
    else orderBookScore = 40
  }

  // ── Volumen (10%) ─────────────────────────────────────────────────────────
  const recentVol = ohlcv.slice(-1)[0]?.[5] ?? 0
  const avgVol = ohlcv.slice(-20).reduce((a, c) => a + c[5], 0) / 20
  const volRatio = avgVol > 0 ? recentVol / avgVol : 1

  let volumeScore: number
  if (volRatio > 1.5) volumeScore = 90
  else if (volRatio >= 0.8) volumeScore = 70
  else volumeScore = 40

  // ── Score final ───────────────────────────────────────────────────────────
  const riskScore = Math.round(
    volatilityScore * 0.35 +
    positionScore * 0.30 +
    orderBookScore * 0.25 +
    volumeScore * 0.10
  )

  const minScore = config.bot.layer1MinRiskScore
  const approved = riskScore >= minScore
  const maxSizeMultiplier = riskScore / 100 * 0.7 + 0.3

  return {
    riskScore,
    approved,
    maxSizeMultiplier,
    subScores: {
      volatility: volatilityScore,
      position: positionScore,
      orderBook: orderBookScore,
      volume: volumeScore,
    },
    blockedReason: approved ? undefined : `Risk score ${riskScore} < mínimo ${minScore}`,
  }
}
