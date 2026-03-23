import { initParse, Parse } from './client'
import type { LayerAnalysisRecord, OrderSide } from '../types'

export async function saveLayerAnalysis(record: LayerAnalysisRecord): Promise<void> {
  initParse()
  const LAClass = Parse.Object.extend('LayerAnalysis')
  const obj = new LAClass()

  obj.set('layer', record.layer)
  obj.set('orderSide', record.orderSide)
  obj.set('orderPrice', record.orderPrice)
  obj.set('approved', record.approved)
  obj.set('score', record.score)
  obj.set('sizeMultiplier', record.sizeMultiplier)
  obj.set('subScores', record.subScores)
  obj.set('evaluatedAt', record.evaluatedAt)

  await obj.save()
}

export async function getRecentLayerAnalysis(limit = 50): Promise<LayerAnalysisRecord[]> {
  initParse()
  const query = new Parse.Query('LayerAnalysis')
  query.descending('evaluatedAt')
  query.limit(Math.min(limit, 200))

  const results = await query.find()
  return results.map(obj => ({
    objectId: obj.id,
    layer: obj.get('layer') as 1 | 2,
    orderSide: obj.get('orderSide') as OrderSide,
    orderPrice: obj.get('orderPrice'),
    approved: obj.get('approved'),
    score: obj.get('score'),
    sizeMultiplier: obj.get('sizeMultiplier'),
    subScores: obj.get('subScores') ?? {},
    evaluatedAt: obj.get('evaluatedAt'),
  }))
}
