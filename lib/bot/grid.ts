import { MIN_LEVEL_SEPARATION, BINANCE_FEE_PERCENT } from '../config'
import { SIZING_BASE_AMOUNT } from '../../bot.config'
import type { GridLevel, GridConfig, OrderSide } from '../types'

export function buildGridLevels(
  currentPrice: number,
  config: GridConfig,
  amountPerLevel: number
): GridLevel[] {
  const { gridLevels, gridRangePercent } = config
  const gridMin = currentPrice * (1 - gridRangePercent / 200)
  const gridMax = currentPrice * (1 + gridRangePercent / 200)
  const stepSize = (gridMax - gridMin) / (gridLevels - 1)

  // Validar separación mínima
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
