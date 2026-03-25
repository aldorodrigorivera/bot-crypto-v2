import { initParse, Parse } from './client'
import type { BacktestRecord, GridConfigName } from '../types'

function toBacktestRecord(obj: Parse.Object): BacktestRecord {
  return {
    objectId: obj.id,
    pair: obj.get('pair') ?? '',
    configName: (obj.get('configName') ?? 'balanced') as GridConfigName,
    gridLevels: obj.get('gridLevels') ?? 0,
    gridRangePercent: obj.get('gridRangePercent') ?? 0,
    periodDays: obj.get('periodDays') ?? 0,
    startDate: obj.get('startDate') ?? new Date(),
    endDate: obj.get('endDate') ?? new Date(),
    totalTrades: obj.get('totalTrades') ?? 0,
    completedCycles: obj.get('completedCycles') ?? 0,
    winRate: obj.get('winRate') ?? 0,
    profitFactor: obj.get('profitFactor') ?? 0,
    sharpeRatio: obj.get('sharpeRatio') ?? 0,
    maxDrawdown: obj.get('maxDrawdown') ?? 0,
    totalReturn: obj.get('totalReturn') ?? 0,
    netProfitUSDC: obj.get('netProfitUSDC') ?? 0,
    totalFeesPaid: obj.get('totalFeesPaid') ?? 0,
    gridBreaks: obj.get('gridBreaks') ?? 0,
    score: obj.get('score') ?? 0,
    passed: obj.get('passed') ?? false,
    failedReasons: obj.get('failedReasons') ?? [],
    ranAt: obj.get('ranAt') ?? new Date(),
    usedForLaunch: obj.get('usedForLaunch') ?? false,
  }
}

export async function saveBacktestResult(record: Omit<BacktestRecord, 'objectId'>): Promise<BacktestRecord> {
  initParse()
  const BacktestResultClass = Parse.Object.extend('BacktestResult')
  const obj = new BacktestResultClass()

  obj.set('pair', record.pair)
  obj.set('configName', record.configName)
  obj.set('gridLevels', record.gridLevels)
  obj.set('gridRangePercent', record.gridRangePercent)
  obj.set('periodDays', record.periodDays)
  obj.set('startDate', record.startDate)
  obj.set('endDate', record.endDate)
  obj.set('totalTrades', record.totalTrades)
  obj.set('completedCycles', record.completedCycles)
  obj.set('winRate', record.winRate)
  obj.set('profitFactor', record.profitFactor)
  obj.set('sharpeRatio', record.sharpeRatio)
  obj.set('maxDrawdown', record.maxDrawdown)
  obj.set('totalReturn', record.totalReturn)
  obj.set('netProfitUSDC', record.netProfitUSDC)
  obj.set('totalFeesPaid', record.totalFeesPaid)
  obj.set('gridBreaks', record.gridBreaks)
  obj.set('score', record.score)
  obj.set('passed', record.passed)
  obj.set('failedReasons', record.failedReasons)
  obj.set('ranAt', record.ranAt)
  obj.set('usedForLaunch', record.usedForLaunch)

  await obj.save()
  return toBacktestRecord(obj)
}

export async function getLatestBacktestResult(): Promise<BacktestRecord | null> {
  initParse()
  const query = new Parse.Query('BacktestResult')
  query.descending('ranAt')
  query.limit(1)
  const obj = await query.first()
  return obj ? toBacktestRecord(obj) : null
}

export async function getBacktestHistory(limit = 20): Promise<BacktestRecord[]> {
  initParse()
  const query = new Parse.Query('BacktestResult')
  query.descending('ranAt')
  query.limit(limit)
  const results = await query.find()
  return results.map(toBacktestRecord)
}
