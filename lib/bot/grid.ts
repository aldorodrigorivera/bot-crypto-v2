import { MIN_LEVEL_SEPARATION, BINANCE_FEE_PERCENT, BINANCE_MIN_NOTIONAL_USDT } from '../config'
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
    // Cap niveles al máximo que cabe respetando la separación mínima
    const minStep = (MIN_LEVEL_SEPARATION / 100) * currentPrice
    const maxLevels = Math.max(2, Math.floor((gridMax - gridMin) / minStep) + 1)
    const gridLevels = Math.min(config.gridLevels, maxLevels)
    const stepSize = (gridMax - gridMin) / (gridLevels - 1)
    const levels: GridLevel[] = []
    for (let i = 0; i < gridLevels; i++) {
      const price = gridMin + i * stepSize
      const side: OrderSide = price < currentPrice ? 'buy' : 'sell'
      levels.push({ level: i, price, side, amount: amountPerLevel })
    }
    return levels
  }

  // ── Grid asimétrico (v5) ─────────────────────────────────────────────
  const { sizeMultiplierAbove, sizeMultiplierBelow } = bias
  const levels: GridLevel[] = []
  let levelIndex = 0

  // Cap niveles al máximo que cabe respetando la separación mínima
  const minStep = (MIN_LEVEL_SEPARATION / 100) * currentPrice
  const maxLevelsBelow = Math.max(1, Math.floor((currentPrice - gridMin) / minStep))
  const maxLevelsAbove = Math.max(1, Math.floor((gridMax - currentPrice) / minStep))
  const levelsBelow = Math.min(bias.levelsBelow, maxLevelsBelow)
  const levelsAbove = Math.min(bias.levelsAbove, maxLevelsAbove)

  // Niveles de compra (abajo del precio)
  if (levelsBelow > 0) {
    const buyStep = (currentPrice - gridMin) / levelsBelow
    const buyAmount = Math.max(amountPerLevel * sizeMultiplierBelow, SIZING_BASE_AMOUNT)
    for (let i = levelsBelow; i >= 1; i--) {
      const price = currentPrice - i * buyStep
      levels.push({ level: levelIndex++, price, side: 'buy', amount: buyAmount })
    }
  }

  // Niveles de venta (arriba del precio)
  if (levelsAbove > 0) {
    const sellStep = (gridMax - currentPrice) / levelsAbove
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
  // Piso 1: mínimo configurado en bot.config
  // Piso 2: mínimo notional de Binance (5 USDT) convertido a base currency
  const minFromNotional = BINANCE_MIN_NOTIONAL_USDT / currentPrice
  return Math.max(calculated, SIZING_BASE_AMOUNT, minFromNotional)
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
