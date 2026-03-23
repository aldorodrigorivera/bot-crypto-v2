import { initParse, Parse } from './client'
import type { BotState, BotStopReason, GridConfigName } from '../types'

function toBotState(obj: Parse.Object): BotState {
  return {
    objectId: obj.id,
    isRunning: obj.get('isRunning') ?? false,
    isPaused: obj.get('isPaused') ?? false,
    totalBase: obj.get('totalBTC') ?? 0,
    reserveBase: obj.get('reserveBTC') ?? 0,
    activeBase: obj.get('activeBTC') ?? 0,
    activeUSDC: obj.get('activeUSDC') ?? 0,
    gridMin: obj.get('gridMin') ?? 0,
    gridMax: obj.get('gridMax') ?? 0,
    gridLevels: obj.get('gridLevels') ?? 10,
    gridRangePercent: obj.get('gridRangePercent') ?? 6,
    configName: (obj.get('configName') ?? 'balanced') as GridConfigName,
    totalProfitBase: obj.get('totalProfitBTC') ?? 0,
    totalProfitUSDC: obj.get('totalProfitUSDC') ?? 0,
    totalTrades: obj.get('totalTrades') ?? 0,
    startedAt: obj.get('startedAt') ?? new Date(),
    lastActiveAt: obj.get('lastActiveAt') ?? new Date(),
    stopReason: obj.get('stopReason'),
    pair: obj.get('pair') ?? 'XRP/USDC',
    initialPrice: obj.get('initialPrice') ?? 0,
    capitalEfficiencyScore: obj.get('capitalEfficiencyScore'),
    agentBias: obj.get('agentBias'),
    lastAgentTrigger: obj.get('lastAgentTrigger'),
    lastAgentAt: obj.get('lastAgentAt'),
    ordersSkippedToday: obj.get('ordersSkippedToday') ?? 0,
  }
}

export async function getBotState(pair: string): Promise<BotState | null> {
  initParse()
  const query = new Parse.Query('BotState')
  query.equalTo('pair', pair)
  const obj = await query.first()
  return obj ? toBotState(obj) : null
}

export async function saveBotState(state: BotState): Promise<BotState> {
  initParse()

  let obj: Parse.Object
  if (state.objectId) {
    obj = Parse.Object.fromJSON({ className: 'BotState', objectId: state.objectId })
  } else {
    const BotStateClass = Parse.Object.extend('BotState')
    obj = new BotStateClass()
  }

  obj.set('isRunning', state.isRunning)
  obj.set('isPaused', state.isPaused)
  obj.set('totalBTC', state.totalBase)
  obj.set('reserveBTC', state.reserveBase)
  obj.set('activeBTC', state.activeBase)
  obj.set('activeUSDC', state.activeUSDC)
  obj.set('gridMin', state.gridMin)
  obj.set('gridMax', state.gridMax)
  obj.set('gridLevels', state.gridLevels)
  obj.set('gridRangePercent', state.gridRangePercent)
  obj.set('configName', state.configName)
  obj.set('totalProfitBTC', state.totalProfitBase)
  obj.set('totalProfitUSDC', state.totalProfitUSDC)
  obj.set('totalTrades', state.totalTrades)
  obj.set('startedAt', state.startedAt)
  obj.set('lastActiveAt', state.lastActiveAt)
  obj.set('pair', state.pair)
  obj.set('initialPrice', state.initialPrice)

  if (state.stopReason) obj.set('stopReason', state.stopReason)
  if (state.capitalEfficiencyScore !== undefined) obj.set('capitalEfficiencyScore', state.capitalEfficiencyScore)
  if (state.agentBias) obj.set('agentBias', state.agentBias)
  if (state.lastAgentTrigger) obj.set('lastAgentTrigger', state.lastAgentTrigger)
  if (state.lastAgentAt) obj.set('lastAgentAt', state.lastAgentAt)
  if (state.ordersSkippedToday !== undefined) obj.set('ordersSkippedToday', state.ordersSkippedToday)

  await obj.save()
  return toBotState(obj)
}

export async function markBotAsStopped(reason: BotStopReason, pair: string): Promise<void> {
  initParse()
  const query = new Parse.Query('BotState')
  query.equalTo('pair', pair)
  const obj = await query.first()
  if (!obj) return

  obj.set('isRunning', false)
  obj.set('isPaused', false)
  obj.set('stopReason', reason)
  await obj.save()
}
