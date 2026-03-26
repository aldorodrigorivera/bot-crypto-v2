import { initParse, Parse } from './client'
import { logger } from '../logger'
import type { LiquiditySnapshot, GridBias } from '../types'

function toSnapshot(obj: Parse.Object): LiquiditySnapshot {
  return {
    pair: obj.get('pair') ?? '',
    obiRatio: obj.get('obiRatio') ?? 0,
    obiDirection: obj.get('obiDirection') ?? 'neutral',
    cvdDelta: obj.get('cvdDelta') ?? 0,
    cvdTrend: obj.get('cvdTrend') ?? 'neutral',
    fundingRate: obj.get('fundingRate') ?? 0,
    biasDirection: obj.get('biasDirection') ?? 'neutral',
    biasStrength: obj.get('biasStrength') ?? 0,
    confidence: obj.get('confidence') ?? 0,
    levelsAbove: obj.get('levelsAbove') ?? 0,
    levelsBelow: obj.get('levelsBelow') ?? 0,
    overrideActive: obj.get('overrideActive') ?? false,
    overrideReason: obj.get('overrideReason'),
    recordedAt: obj.get('recordedAt') ?? new Date(),
  }
}

export async function saveLiquiditySnapshot(pair: string, bias: GridBias): Promise<void> {
  try {
    await initParse()
    const LiquiditySnapshot = Parse.Object.extend('LiquiditySnapshot')
    const snapshot = new LiquiditySnapshot()

    snapshot.set('pair', pair)
    snapshot.set('obiRatio', bias.signals.obi.ratio)
    snapshot.set('obiDirection', bias.signals.obi.bias)
    snapshot.set('cvdDelta', bias.signals.cvd.delta)
    snapshot.set('cvdTrend', bias.signals.cvd.trend)
    snapshot.set('fundingRate', bias.signals.fundingRate.rate)
    snapshot.set('biasDirection', bias.direction)
    snapshot.set('biasStrength', bias.strength)
    snapshot.set('confidence', bias.confidence)
    snapshot.set('levelsAbove', bias.levelsAbove)
    snapshot.set('levelsBelow', bias.levelsBelow)
    snapshot.set('overrideActive', bias.overrideActive)
    snapshot.set('overrideReason', bias.overrideReason ?? null)
    snapshot.set('recordedAt', new Date())

    await snapshot.save()
    logger.debug('[LiquiditySnapshots] Snapshot guardado para %s', pair)
  } catch (err) {
    logger.warn('[LiquiditySnapshots] Error guardando snapshot:', err)
  }
}

export async function getLatestLiquiditySnapshot(pair: string): Promise<LiquiditySnapshot | null> {
  try {
    await initParse()
    const query = new Parse.Query('LiquiditySnapshot')
    query.equalTo('pair', pair)
    query.descending('recordedAt')
    query.limit(1)
    const results = await query.find()
    return results.length > 0 ? toSnapshot(results[0]) : null
  } catch (err) {
    logger.warn('[LiquiditySnapshots] Error leyendo snapshot:', err)
    return null
  }
}

export async function getLiquiditySnapshotHistory(
  pair: string,
  limit = 20
): Promise<LiquiditySnapshot[]> {
  try {
    await initParse()
    const query = new Parse.Query('LiquiditySnapshot')
    query.equalTo('pair', pair)
    query.descending('recordedAt')
    query.limit(limit)
    const results = await query.find()
    return results.map(toSnapshot)
  } catch (err) {
    logger.warn('[LiquiditySnapshots] Error leyendo historial:', err)
    return []
  }
}
