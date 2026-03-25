import { initParse, Parse } from './client'
import type { IncubationState, IncubationPhase, IncubationPhaseEntry } from '../types'

function toIncubationState(obj: Parse.Object): IncubationState {
  return {
    objectId: obj.id,
    isActive: obj.get('isActive') ?? false,
    startedAt: obj.get('startedAt') ?? new Date(),
    currentPhase: (obj.get('currentPhase') ?? 'micro') as IncubationPhase,
    realTrades: obj.get('realTrades') ?? 0,
    realWinRate: obj.get('realWinRate') ?? 0,
    realProfitFactor: obj.get('realProfitFactor') ?? 0,
    currentSizeMultiplier: obj.get('currentSizeMultiplier') ?? 0.0001,
    totalRealProfitBTC: obj.get('totalRealProfitBTC') ?? 0,
    totalRealLossBTC: obj.get('totalRealLossBTC') ?? 0,
    phaseHistory: (obj.get('phaseHistory') ?? []) as IncubationPhaseEntry[],
    passedAt: obj.get('passedAt'),
    abortedAt: obj.get('abortedAt'),
    abortReason: obj.get('abortReason'),
  }
}

// Singleton: siempre upsert el mismo registro (uno por bot)
const INCUBATION_SINGLETON_KEY = 'incubationSingleton'

async function getOrCreateObj(): Promise<Parse.Object> {
  initParse()
  const query = new Parse.Query('IncubationState')
  query.equalTo('key', INCUBATION_SINGLETON_KEY)
  const existing = await query.first()
  if (existing) return existing
  const IncubationStateClass = Parse.Object.extend('IncubationState')
  const obj = new IncubationStateClass()
  obj.set('key', INCUBATION_SINGLETON_KEY)
  return obj
}

export async function getIncubationState(): Promise<IncubationState | null> {
  initParse()
  const query = new Parse.Query('IncubationState')
  query.equalTo('key', INCUBATION_SINGLETON_KEY)
  const obj = await query.first()
  return obj ? toIncubationState(obj) : null
}

export async function saveIncubationState(state: IncubationState): Promise<void> {
  const obj = await getOrCreateObj()

  obj.set('isActive', state.isActive)
  obj.set('startedAt', state.startedAt)
  obj.set('currentPhase', state.currentPhase)
  obj.set('realTrades', state.realTrades)
  obj.set('realWinRate', state.realWinRate)
  obj.set('realProfitFactor', state.realProfitFactor)
  obj.set('currentSizeMultiplier', state.currentSizeMultiplier)
  obj.set('totalRealProfitBTC', state.totalRealProfitBTC)
  obj.set('totalRealLossBTC', state.totalRealLossBTC)
  obj.set('phaseHistory', state.phaseHistory)

  if (state.passedAt) obj.set('passedAt', state.passedAt)
  if (state.abortedAt) obj.set('abortedAt', state.abortedAt)
  if (state.abortReason) obj.set('abortReason', state.abortReason)

  await obj.save()
}

export async function clearIncubationState(): Promise<void> {
  initParse()
  const query = new Parse.Query('IncubationState')
  query.equalTo('key', INCUBATION_SINGLETON_KEY)
  const obj = await query.first()
  if (!obj) return
  obj.set('isActive', false)
  await obj.save()
}
