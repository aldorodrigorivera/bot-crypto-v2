import { initParse, Parse } from './client'
import type { GridEfficiencyRecord } from '../types'

export async function saveGridEfficiency(record: GridEfficiencyRecord): Promise<void> {
  initParse()
  const GEClass = Parse.Object.extend('GridEfficiency')
  const obj = new GEClass()

  obj.set('efficiencyScore', record.efficiencyScore)
  obj.set('activeLevels', record.activeLevels)
  obj.set('totalLevels', record.totalLevels)
  obj.set('capitalInActive', record.capitalInActive)
  obj.set('capitalTotal', record.capitalTotal)
  obj.set('tradesLast4h', record.tradesLast4h)
  obj.set('recordedAt', record.recordedAt)

  await obj.save()
}

export async function getGridEfficiencyHistory(days = 7): Promise<GridEfficiencyRecord[]> {
  initParse()
  const since = new Date()
  since.setDate(since.getDate() - days)

  const query = new Parse.Query('GridEfficiency')
  query.greaterThanOrEqualTo('recordedAt', since)
  query.ascending('recordedAt')
  query.limit(1000)

  const results = await query.find()
  return results.map(obj => ({
    objectId: obj.id,
    efficiencyScore: obj.get('efficiencyScore'),
    activeLevels: obj.get('activeLevels'),
    totalLevels: obj.get('totalLevels'),
    capitalInActive: obj.get('capitalInActive'),
    capitalTotal: obj.get('capitalTotal'),
    tradesLast4h: obj.get('tradesLast4h'),
    recordedAt: obj.get('recordedAt'),
  }))
}
