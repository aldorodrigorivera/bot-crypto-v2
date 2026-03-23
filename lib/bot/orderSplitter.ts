import { placeLimitOrder } from '../exchange/orders'
import { logger } from '../logger'
import type { OrderSide, ExchangeOrder } from '../types'
import { getAppConfig } from '../config'

export async function splitOrder(
  pair: string,
  side: OrderSide,
  totalAmount: number,
  centerPrice: number
): Promise<ExchangeOrder[]> {
  const config = getAppConfig()

  if (!config.bot.splitEnabled) {
    const order = await placeLimitOrder(pair, side, totalAmount, centerPrice)
    return [order]
  }

  const parts = config.bot.splitParts
  const distribution = config.bot.splitDistribution
  const spreadPercent = config.bot.splitSpreadPercent / 100
  const orders: ExchangeOrder[] = []

  for (let i = 0; i < parts; i++) {
    const percent = distribution[i] / 100
    const amount = totalAmount * percent

    // Escalonar precio
    const offset = (i - Math.floor(parts / 2)) * spreadPercent * centerPrice
    const price = side === 'buy'
      ? centerPrice - Math.abs(offset)
      : centerPrice + Math.abs(offset)

    try {
      const order = await placeLimitOrder(pair, side, amount, parseFloat(price.toFixed(6)))
      orders.push(order)
    } catch (err) {
      logger.error(`Error colocando micro-orden ${i + 1}/${parts}:`, err)
    }
  }

  return orders
}
