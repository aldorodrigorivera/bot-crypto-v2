import { initParse, Parse } from './client'
import type { TradeRecord, TradesSummary, DailyProfit, OrderSide, GridConfigName } from '../types'

function toTradeRecord(obj: Parse.Object): TradeRecord {
  return {
    pair: obj.get('pair'),
    side: obj.get('side') as OrderSide,
    price: obj.get('price'),
    targetPrice: obj.get('targetPrice'),
    amount: obj.get('amount'),
    usdcValue: obj.get('usdcValue'),
    fee: obj.get('fee'),
    profit: obj.get('profit') ?? 0,
    profitBase: obj.get('profitBTC') ?? 0,
    gridLevel: obj.get('gridLevel'),
    orderId: obj.get('orderId'),
    pairedOrderId: obj.get('pairedOrderId'),
    executedAt: obj.get('executedAt'),
    configUsed: obj.get('configUsed') as GridConfigName,
    status: obj.get('status'),
    layer1Score: obj.get('layer1Score'),
    layer2Probability: obj.get('layer2Probability'),
    sizeMultiplier: obj.get('sizeMultiplier'),
    isMicroOrder: obj.get('isMicroOrder'),
    parentMicroGroupId: obj.get('parentMicroGroupId'),
    microOrderIndex: obj.get('microOrderIndex'),
  }
}

export async function saveTrade(trade: TradeRecord): Promise<void> {
  initParse()
  const TradeClass = Parse.Object.extend('Trade')
  const obj = new TradeClass()

  obj.set('pair', trade.pair)
  obj.set('side', trade.side)
  obj.set('price', trade.price)
  obj.set('targetPrice', trade.targetPrice)
  obj.set('amount', trade.amount)
  obj.set('usdcValue', trade.usdcValue)
  obj.set('fee', trade.fee)
  obj.set('profit', trade.profit)
  obj.set('profitBTC', trade.profitBase)
  obj.set('gridLevel', trade.gridLevel)
  obj.set('orderId', trade.orderId)
  obj.set('pairedOrderId', trade.pairedOrderId)
  obj.set('executedAt', trade.executedAt)
  obj.set('configUsed', trade.configUsed)
  obj.set('status', trade.status ?? 'filled')
  obj.set('layer1Score', trade.layer1Score)
  obj.set('layer2Probability', trade.layer2Probability)
  obj.set('sizeMultiplier', trade.sizeMultiplier)
  obj.set('isMicroOrder', trade.isMicroOrder ?? false)
  obj.set('parentMicroGroupId', trade.parentMicroGroupId)
  obj.set('microOrderIndex', trade.microOrderIndex)

  await obj.save()
}

export async function getRecentTrades(pair: string, limit = 50): Promise<TradeRecord[]> {
  initParse()
  const query = new Parse.Query('Trade')
  query.equalTo('pair', pair)
  query.descending('executedAt')
  query.limit(Math.min(limit, 200))

  const results = await query.find()
  return results.map(toTradeRecord)
}

export async function getTodayTrades(pair: string, limit = 88): Promise<TradeRecord[]> {
  initParse()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const query = new Parse.Query('Trade')
  query.equalTo('pair', pair)
  query.greaterThanOrEqualTo('executedAt', today)
  query.descending('executedAt')
  query.limit(Math.min(limit, 88))

  const results = await query.find()
  return results.map(toTradeRecord)
}

export async function getTradesSummary(pair: string): Promise<TradesSummary> {
  initParse()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const allQuery = new Parse.Query('Trade')
  allQuery.equalTo('pair', pair)
  allQuery.limit(10000)
  const allTrades = await allQuery.find()

  const todayTrades = allTrades.filter(t => {
    const d = t.get('executedAt') as Date
    return d && d >= today
  })

  const sum = (arr: Parse.Object[], field: string) =>
    arr.reduce((acc, t) => acc + (t.get(field) as number ?? 0), 0)

  return {
    totalTrades: allTrades.length,
    totalProfitBase: sum(allTrades, 'profitBTC'),
    totalProfitUSDC: sum(allTrades, 'profit'),
    todayTrades: todayTrades.length,
    todayProfitBase: sum(todayTrades, 'profitBTC'),
    todayProfitUSDC: sum(todayTrades, 'profit'),
    todayFees: sum(todayTrades, 'fee'),
  }
}

export async function getTradesSince(pair: string, since: Date): Promise<TradeRecord[]> {
  initParse()
  const query = new Parse.Query('Trade')
  query.equalTo('pair', pair)
  query.greaterThanOrEqualTo('executedAt', since)
  query.limit(10000)
  const results = await query.find()
  return results.map(toTradeRecord)
}

export async function getDailyProfitHistory(pair: string, days = 30): Promise<DailyProfit[]> {
  initParse()
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  const query = new Parse.Query('Trade')
  query.equalTo('pair', pair)
  query.greaterThanOrEqualTo('executedAt', since)
  query.limit(10000)

  const trades = await query.find()

  const map = new Map<string, DailyProfit>()
  for (const t of trades) {
    const d = t.get('executedAt') as Date
    if (!d) continue
    const key = d.toISOString().slice(0, 10)
    const prev = map.get(key) ?? { date: key, profitBase: 0, profitUSDC: 0, trades: 0 }
    map.set(key, {
      date: key,
      profitBase: prev.profitBase + (t.get('profitBTC') as number ?? 0),
      profitUSDC: prev.profitUSDC + (t.get('profit') as number ?? 0),
      trades: prev.trades + 1,
    })
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}
