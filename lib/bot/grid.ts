import { MIN_LEVEL_SEPARATION, BINANCE_FEE_PERCENT } from '../config'
import { SIZING_BASE_AMOUNT } from '../../bot.config'
import type { GridLevel, GridConfig, GridBias, OrderSide } from '../types'

export function buildGridLevels(
  currentPrice: number,
  config: GridConfig,
  amountPerLevel: number,
  bias?: GridBias
): GridLevel[] {
  const { gridRangePercent } = config
  const halfRange = gridRangePercent / 200
  const gridMin = currentPrice * (1 - halfRange)
  const gridMax = currentPrice * (1 + halfRange)

  // v5: Si hay bias activo con suficiente fuerza → grid asimétrico
  const useAsymmetric = bias !== undefined && bias.strength >= 20 && bias.direction !== 'neutral'

  if (!useAsymmetric) {
    // ── Grid simétrico (comportamiento v4) ──────────────────────────────
    const gridLevels = config.gridLevels
    const stepSize = (gridMax - gridMin) / (gridLevels - 1)
    const stepPercent = (stepSize / currentPrice) * 100
    if (stepPercent < MIN_LEVEL_SEPARATION) {
      throw new Error(
        `Separación de niveles (${stepPercent.toFixed(3)}%) menor al mínimo (${MIN_LEVEL_SEPARATION}%). Grid no rentable.`
      )
    }
    const levels: GridLevel[] = []
    for (let i = 0; i < gridLevels; i++) {
      const price = gridMin + i * stepSize
      const side: OrderSide = price < currentPrice ? 'buy' : 'sell'
      levels.push({ level: i, price, side, amount: amountPerLevel })
    }
    return levels
  }

  // ── Grid asimétrico (v5) ─────────────────────────────────────────────
  const { levelsAbove, levelsBelow, sizeMultiplierAbove, sizeMultiplierBelow } = bias
  const levels: GridLevel[] = []
  let levelIndex = 0

  // Niveles de compra (abajo del precio)
  if (levelsBelow > 0) {
    const buyStep = (currentPrice - gridMin) / levelsBelow
    const buyStepPct = (buyStep / currentPrice) * 100
    if (buyStepPct < MIN_LEVEL_SEPARATION) {
      throw new Error(
        `Separación de niveles buy (${buyStepPct.toFixed(3)}%) menor al mínimo con bias. Reducir levelsBelow o ampliar rango.`
      )
    }
    const buyAmount = Math.max(amountPerLevel * sizeMultiplierBelow, SIZING_BASE_AMOUNT)
    for (let i = levelsBelow; i >= 1; i--) {
      const price = currentPrice - i * buyStep
      levels.push({ level: levelIndex++, price, side: 'buy', amount: buyAmount })
    }
  }

  // Niveles de venta (arriba del precio)
  if (levelsAbove > 0) {
    const sellStep = (gridMax - currentPrice) / levelsAbove
    const sellStepPct = (sellStep / currentPrice) * 100
    if (sellStepPct < MIN_LEVEL_SEPARATION) {
      throw new Error(
        `Separación de niveles sell (${sellStepPct.toFixed(3)}%) menor al mínimo con bias. Reducir levelsAbove o ampliar rango.`
      )
    }
    const sellAmount = Math.max(amountPerLevel * sizeMultiplierAbove, SIZING_BASE_AMOUNT)
    for (let i = 1; i <= levelsAbove; i++) {
      const price = currentPrice + i * sellStep
      levels.push({ level: levelIndex++, price, side: 'sell', amount: sellAmount })
    }
  }

  return levels
}

export function calculateAmountPerLevel(
  activeUSDC: number,
  config: GridConfig,
  currentPrice: number
): number {
  const estimatedBuyLevels = config.gridLevels / 2
  const calculated = (activeUSDC / currentPrice) / estimatedBuyLevels
  // Usar SIZING_BASE_AMOUNT como piso: evita órdenes de 0 o sub-mínimo de Binance
  return Math.max(calculated, SIZING_BASE_AMOUNT)
}

export function getOppositeOrderPrice(
  filledPrice: number,
  filledSide: OrderSide,
  gridLevels: GridLevel[]
): number | null {
  if (filledSide === 'buy') {
    // Siguiente nivel de venta por encima
    const sellLevels = gridLevels.filter(l => l.side === 'sell' && l.price > filledPrice)
    if (sellLevels.length === 0) return null
    return Math.min(...sellLevels.map(l => l.price))
  } else {
    // Siguiente nivel de compra por debajo
    const buyLevels = gridLevels.filter(l => l.side === 'buy' && l.price < filledPrice)
    if (buyLevels.length === 0) return null
    return Math.max(...buyLevels.map(l => l.price))
  }
}

export function calculateCycleProfit(
  buyPrice: number,
  sellPrice: number,
  amount: number
): number {
  const grossProfit = (sellPrice - buyPrice) * amount
  const avgPrice = (buyPrice + sellPrice) / 2
  const fees = 2 * (BINANCE_FEE_PERCENT / 100) * avgPrice * amount
  return grossProfit - fees
}

export function getGridMinMax(currentPrice: number, config: GridConfig): { min: number; max: number } {
  return {
    min: currentPrice * (1 - config.gridRangePercent / 200),
    max: currentPrice * (1 + config.gridRangePercent / 200),
  }
}
