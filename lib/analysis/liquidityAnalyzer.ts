import fs from 'fs'
import path from 'path'
import { calculateOBI, calculateCVD, fetchFundingRateSignal } from './orderFlowTracker'
import { buildLiquidityMap } from './liquidityMap'
import { saveLiquiditySnapshot } from '../database/liquiditySnapshots'
import { logger } from '../logger'
import type { GridBias, OBIResult, CVDResult, LiquidityMap, FundingRateResult } from '../types'

// ─── Algoritmo de combinación de señales ─────────────────────────────────

function buildSummary(
  finalScore: number,
  confidence: number,
  obi: OBIResult,
  cvd: CVDResult,
  funding: FundingRateResult,
  overrideActive: boolean,
  overrideReason?: string
): string {
  const dir = finalScore > 20 ? 'ALCISTA' : finalScore < -20 ? 'BAJISTA' : 'NEUTRAL'
  const parts = [
    `Sesgo ${dir} (score ${finalScore.toFixed(0)}/100, confianza ${confidence.toFixed(0)}%)`,
    `OBI ${obi.bias} ${obi.ratio.toFixed(2)}x`,
    `CVD ${cvd.trend} delta ${cvd.delta > 0 ? '+' : ''}${cvd.delta.toFixed(0)}`,
    funding.unavailable ? 'Funding N/A' : `Funding ${(funding.rate * 100).toFixed(4)}%`,
  ]
  if (overrideActive && overrideReason) parts.push(`Override: ${overrideReason}`)
  return parts.join(' | ')
}

function calculateGridBias(
  obi: OBIResult,
  cvd: CVDResult,
  liquidityMap: LiquidityMap,
  fundingRate: FundingRateResult,
  totalLevels: number,
  currentPrice: number
): GridBias {
  // 1. Score base por señal (-100 a +100), positivo = alcista
  const obiScore = obi.bias === 'bullish' ? obi.strength
    : obi.bias === 'bearish' ? -obi.strength : 0

  const cvdScore = cvd.trend === 'accumulation' ? cvd.strength
    : cvd.trend === 'distribution' ? -cvd.strength : 0

  const liquidityScore = liquidityMap.currentZone === 'near_support' ? 30
    : liquidityMap.currentZone === 'near_resistance' ? -20 : 0

  // 2. Score ponderado (OBI tiene más peso por ser la señal más inmediata)
  const weightedScore = (obiScore * 0.40) + (cvdScore * 0.35) + (liquidityScore * 0.25)

  // 3. Confidence: % de señales que apuntan en la misma dirección
  const signalScores = [obiScore, cvdScore, liquidityScore]
  const aligned = signalScores.filter(s => s !== 0 && Math.sign(s) === Math.sign(weightedScore)).length
  const nonZero = signalScores.filter(s => s !== 0).length
  const confidence = nonZero > 0 ? (aligned / nonZero) * 100 : 0

  // 4. Override por funding rate extremo
  let finalScore = weightedScore
  let overrideActive = false
  let overrideReason: string | undefined

  if (!fundingRate.unavailable) {
    if (fundingRate.rate > 0.0005 && weightedScore > 0) {
      finalScore = weightedScore * 0.3
      overrideActive = true
      overrideReason = 'Funding rate muy positivo — riesgo de long squeeze'
    } else if (fundingRate.rate < -0.0005 && weightedScore < 0) {
      finalScore = weightedScore * 0.3
      overrideActive = true
      overrideReason = 'Funding rate muy negativo — riesgo de short squeeze'
    }
  }

  // 5. Distribución de niveles
  //    finalScore +100 → 80% arriba, 20% abajo
  //    finalScore 0    → 50/50
  //    finalScore -100 → 20% arriba, 80% abajo
  const biasRatio = Math.max(0.2, Math.min(0.8, 0.5 + (finalScore / 100) * 0.3))
  const levelsAbove = Math.max(1, Math.round(totalLevels * biasRatio))
  const levelsBelow = Math.max(1, totalLevels - levelsAbove)

  // 6. Multiplicadores de tamaño por dirección
  const sizeMultiplierAbove = finalScore > 0
    ? 1.0 + (finalScore / 100) * 0.3
    : 1.0 - (Math.abs(finalScore) / 100) * 0.2

  const sizeMultiplierBelow = finalScore < 0
    ? 1.0 + (Math.abs(finalScore) / 100) * 0.3
    : 1.0 - (finalScore / 100) * 0.2

  // 7. Zona densa: concentrar niveles hacia el cluster más cercano
  const densityZone = {
    priceMin: finalScore > 0
      ? currentPrice
      : (liquidityMap.nearestSupport?.price ?? currentPrice * 0.97),
    priceMax: finalScore > 0
      ? (liquidityMap.nearestResistance?.price ?? currentPrice * 1.03)
      : currentPrice,
    levelConcentration: 60,
  }

  const direction: GridBias['direction'] = finalScore > 20 ? 'bullish'
    : finalScore < -20 ? 'bearish' : 'neutral'

  return {
    direction,
    strength: Math.round(Math.abs(finalScore)),
    confidence: Math.round(confidence),
    levelsAbove,
    levelsBelow,
    densityZone,
    sizeMultiplierAbove: Math.round(sizeMultiplierAbove * 100) / 100,
    sizeMultiplierBelow: Math.round(sizeMultiplierBelow * 100) / 100,
    signals: { obi, cvd, liquidityMap, fundingRate },
    overrideActive,
    overrideReason,
    summary: buildSummary(finalScore, confidence, obi, cvd, fundingRate, overrideActive, overrideReason),
  }
}

// ─── Log en consola ───────────────────────────────────────────────────────

function logBiasReport(pair: string, bias: GridBias): void {
  const line = '═'.repeat(58)
  const pad = (s: string) => s.padEnd(56)

  const obiIcon = bias.signals.obi.bias === 'bullish' ? '🟢'
    : bias.signals.obi.bias === 'bearish' ? '🔴' : '🟡'
  const cvdIcon = bias.signals.cvd.trend === 'accumulation' ? '🟢'
    : bias.signals.cvd.trend === 'distribution' ? '🔴' : '🟡'
  const dirIcon = bias.direction === 'bullish' ? '🟢'
    : bias.direction === 'bearish' ? '🔴' : '🟡'

  logger.info([
    `╔${line}╗`,
    `║  ${pad(`ANÁLISIS DE LIQUIDEZ — ${pair}`)}║`,
    `╠${line}╣`,
    `║  ${pad(`Order Book Imbalance:`)}║`,
    `║    ${pad(`Bids: ${bias.signals.obi.bidVolume.toFixed(0)} USDT  │  Asks: ${bias.signals.obi.askVolume.toFixed(0)} USDT`)}  ║`,
    `║    ${pad(`Ratio: ${bias.signals.obi.ratio.toFixed(2)}x  →  ${obiIcon} ${bias.signals.obi.bias.toUpperCase()} (${bias.signals.obi.strength}/100)`)}  ║`,
    `║  ${pad(`CVD (últimas transacciones):`)}║`,
    `║    ${pad(`Compras: ${bias.signals.cvd.buyVolume.toFixed(0)}  │  Ventas: ${bias.signals.cvd.sellVolume.toFixed(0)}`)}  ║`,
    `║    ${pad(`Delta: ${bias.signals.cvd.delta > 0 ? '+' : ''}${bias.signals.cvd.delta.toFixed(0)}  →  ${cvdIcon} ${bias.signals.cvd.trend.toUpperCase()} (${bias.signals.cvd.strength}/100)${bias.signals.cvd.lowDataWarning ? ' ⚠️ pocos datos' : ''}`)}  ║`,
    `║  ${pad(`Funding Rate:`)}║`,
    `║    ${pad(bias.signals.fundingRate.unavailable ? 'No disponible — tratado como neutral' : `Tasa: ${(bias.signals.fundingRate.rate * 100).toFixed(4)}%  │  ${bias.signals.fundingRate.note}`)}  ║`,
    `╠${line}╣`,
    `║  ${pad(`SESGO RESULTANTE:  ${dirIcon} ${bias.direction.toUpperCase()}`)}║`,
    `║  ${pad(`Fuerza: ${bias.strength}/100  │  Confianza: ${bias.confidence}%`)}║`,
    `╠${line}╣`,
    `║  ${pad(`GRID ASIMÉTRICO:`)}║`,
    `║    ${pad(`Niveles arriba (ventas): ${bias.levelsAbove}  ← ${bias.direction === 'bullish' ? 'más niveles' : bias.direction === 'bearish' ? 'menos niveles' : 'simétrico'}`)}  ║`,
    `║    ${pad(`Niveles abajo (compras): ${bias.levelsBelow}  ← ${bias.direction === 'bearish' ? 'más niveles' : bias.direction === 'bullish' ? 'menos niveles' : 'simétrico'}`)}  ║`,
    `║    ${pad(`Size ↑: ×${bias.sizeMultiplierAbove}  │  Size ↓: ×${bias.sizeMultiplierBelow}`)}  ║`,
    bias.overrideActive ? `║    ${pad(`⚠️  Override: ${bias.overrideReason ?? ''}`)}  ║` : null,
    `╚${line}╝`,
  ].filter(Boolean).join('\n'))
}

// ─── Guardar reporte en docs/markets/ ─────────────────────────────────────

function saveAnalysisReport(pair: string, bias: GridBias): void {
  try {
    const now = new Date()
    const date = now.toISOString().split('T')[0]
    const time = now.toTimeString().slice(0, 8)
    const dir = path.join(process.cwd(), 'docs', 'markets')
    const filePath = path.join(dir, `review-${date}.md`)

    fs.mkdirSync(dir, { recursive: true })

    const { obi, cvd, fundingRate, liquidityMap } = bias.signals

    const entry = [
      `## Análisis ${time} — ${pair}`,
      '',
      `**Sesgo:** ${bias.direction.toUpperCase()}  |  **Fuerza:** ${bias.strength}/100  |  **Confianza:** ${bias.confidence}%`,
      '',
      '### Señales',
      '',
      `| Señal | Valor | Tendencia |`,
      `|-------|-------|-----------|`,
      `| OBI | ratio ${obi.ratio.toFixed(2)}x (bids ${obi.bidVolume.toFixed(0)} / asks ${obi.askVolume.toFixed(0)}) | ${obi.bias.toUpperCase()} (${obi.strength}/100) |`,
      `| CVD | delta ${cvd.delta > 0 ? '+' : ''}${cvd.delta.toFixed(0)} (compras ${cvd.buyVolume.toFixed(0)} / ventas ${cvd.sellVolume.toFixed(0)}) | ${cvd.trend.toUpperCase()} (${cvd.strength}/100)${cvd.lowDataWarning ? ' ⚠️ pocos datos' : ''} |`,
      `| Liquidez | zona ${liquidityMap.currentZone} | soporte ${liquidityMap.nearestSupport ? liquidityMap.nearestSupport.price.toFixed(4) : 'N/A'} / resistencia ${liquidityMap.nearestResistance ? liquidityMap.nearestResistance.price.toFixed(4) : 'N/A'} |`,
      `| Funding | ${fundingRate.unavailable ? 'N/A' : `${(fundingRate.rate * 100).toFixed(4)}% — ${fundingRate.note}`} | ${fundingRate.unavailable ? 'NEUTRAL' : fundingRate.interpretation.toUpperCase()} |`,
      '',
      '### Grid asimétrico',
      '',
      `- Niveles arriba (ventas): **${bias.levelsAbove}**`,
      `- Niveles abajo (compras): **${bias.levelsBelow}**`,
      `- Multiplicador ↑: ×${bias.sizeMultiplierAbove}  |  Multiplicador ↓: ×${bias.sizeMultiplierBelow}`,
      '',
      bias.overrideActive && bias.overrideReason
        ? `> ⚠️ **Override activo:** ${bias.overrideReason}\n`
        : '',
      `**Resumen:** ${bias.summary}`,
      '',
      '---',
      '',
    ].filter(s => s !== '').join('\n')

    const header = fs.existsSync(filePath) ? '' : `# Análisis de Liquidez — ${date}\n\n`
    fs.appendFileSync(filePath, header + entry, 'utf8')
  } catch {
    // non-critical — never interrupt trading
  }
}

// ─── Export principal ─────────────────────────────────────────────────────

export async function runLiquidityAnalysis(
  pair: string,
  currentPrice: number,
  totalLevels: number
): Promise<GridBias> {
  logger.info('[LiquidityAnalyzer] Iniciando análisis de liquidez para %s', pair)

  const [obi, cvd, liquidityMap, fundingRate] = await Promise.all([
    calculateOBI(pair),
    calculateCVD(pair),
    buildLiquidityMap(pair, currentPrice),
    fetchFundingRateSignal(pair),
  ])

  const bias = calculateGridBias(obi, cvd, liquidityMap, fundingRate, totalLevels, currentPrice)

  logBiasReport(pair, bias)

  // Guardar snapshot en Back4App (no bloquear si falla)
  saveLiquiditySnapshot(pair, bias).catch(() => {})

  // Guardar reporte markdown en docs/markets/review-YYYY-MM-DD.md
  saveAnalysisReport(pair, bias)

  return bias
}
