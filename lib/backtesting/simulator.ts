import { buildGridLevels, calculateCycleProfit } from '../bot/grid'
import { BINANCE_FEE_PERCENT, GRID_CONFIGS } from '../config'
import type { OHLCVCandle, SimulatedTrade, SimulationResult, GridConfigName } from '../types'

interface SimulatorConfig {
  candles: OHLCVCandle[]
  configName: GridConfigName
  feePercent?: number
}

interface OpenOrder {
  side: 'buy' | 'sell'
  price: number
  amount: number
  cycleId: string
}

export function simulateGrid(config: SimulatorConfig): SimulationResult {
  const { candles, configName } = config
  const feePercent = config.feePercent ?? BINANCE_FEE_PERCENT
  const gridConfig = GRID_CONFIGS[configName]

  if (candles.length === 0) {
    return { trades: [], finalCapital: 0, startCapital: 0, totalReturn: 0, durationDays: 0, gridBreaks: 0 }
  }

  const initialPrice = candles[0].open
  // Capital simulado: un nivel de grid en USDC equivalente
  const startCapital = gridConfig.gridLevels * 10 // 10 USDC por nivel (referencia)
  const amountPerLevel = (startCapital / 2) / (gridConfig.gridLevels / 2) / initialPrice

  let capital = startCapital
  const trades: SimulatedTrade[] = []
  let gridBreaks = 0
  let cycleCounter = 0

  // Construir grid inicial
  let levels = buildGridLevels(initialPrice, gridConfig, amountPerLevel)
  let gridMin = levels[0].price
  let gridMax = levels[levels.length - 1].price

  // Órdenes abiertas: buy below price, sell above price
  const openOrders = new Map<number, OpenOrder>()

  function initOrders(price: number): void {
    openOrders.clear()
    levels = buildGridLevels(price, gridConfig, amountPerLevel)
    gridMin = levels[0].price
    gridMax = levels[levels.length - 1].price

    for (const level of levels) {
      if (level.side === 'buy' && level.price < price) {
        openOrders.set(level.price, { side: 'buy', price: level.price, amount: level.amount, cycleId: '' })
      } else if (level.side === 'sell' && level.price > price) {
        openOrders.set(level.price, { side: 'sell', price: level.price, amount: level.amount, cycleId: '' })
      }
    }
  }

  initOrders(initialPrice)

  // Mapa cycleId → precio de compra (para calcular profit en la venta)
  const openCycles = new Map<string, number>()

  for (const candle of candles) {
    const { high, low, close, timestamp } = candle

    // 1. Evaluar ventas (HIGH toca sell orders)
    for (const [price, order] of openOrders) {
      if (order.side === 'sell' && high >= price) {
        const fee = (feePercent / 100) * price * order.amount
        const buyPrice = openCycles.get(order.cycleId)
        const profit = buyPrice
          ? calculateCycleProfit(buyPrice, price, order.amount)
          : 0

        trades.push({ type: 'sell', price, amount: order.amount, timestamp, fee, profit, cycleId: order.cycleId })
        capital += price * order.amount - fee
        openOrders.delete(price)
        openCycles.delete(order.cycleId)

        // Colocar nueva buy order un nivel abajo
        const nextBuyPrice = price * (1 - (gridMax - gridMin) / (gridConfig.gridLevels - 1) / initialPrice)
        if (nextBuyPrice > gridMin) {
          const newCycleId = `c${++cycleCounter}`
          openOrders.set(nextBuyPrice, { side: 'buy', price: nextBuyPrice, amount: amountPerLevel, cycleId: newCycleId })
        }
      }
    }

    // 2. Evaluar compras (LOW toca buy orders)
    for (const [price, order] of openOrders) {
      if (order.side === 'buy' && low <= price) {
        const fee = (feePercent / 100) * price * order.amount

        const cycleId = `c${++cycleCounter}`
        trades.push({ type: 'buy', price, amount: order.amount, timestamp, fee, cycleId })
        capital -= price * order.amount + fee
        openOrders.delete(price)
        openCycles.set(cycleId, price)

        // Colocar nueva sell order un nivel arriba
        const stepSize = (gridMax - gridMin) / (gridConfig.gridLevels - 1)
        const nextSellPrice = price + stepSize
        if (nextSellPrice <= gridMax) {
          openOrders.set(nextSellPrice, { side: 'sell', price: nextSellPrice, amount: amountPerLevel, cycleId })
        }
      }
    }

    // 3. Verificar ruptura del grid
    if (close < gridMin || close > gridMax) {
      gridBreaks++
      initOrders(close)
      openCycles.clear()
    }
  }

  const firstTs = candles[0].timestamp
  const lastTs = candles[candles.length - 1].timestamp
  const durationDays = (lastTs - firstTs) / (1000 * 60 * 60 * 24)

  // Capital final = capital inicial + suma de profits netos de ventas completadas
  const finalCapital = startCapital + trades
    .filter(t => t.type === 'sell' && t.profit !== undefined)
    .reduce((sum, t) => sum + (t.profit ?? 0), 0)

  const totalReturn = startCapital > 0 ? ((finalCapital - startCapital) / startCapital) * 100 : 0

  return { trades, finalCapital, startCapital, totalReturn, durationDays, gridBreaks }
}
