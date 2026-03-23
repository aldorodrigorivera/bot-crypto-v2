import { initParse, Parse } from './client'
import type { TradingSession, GridConfigName, BotStopReason } from '../types'

function toSession(obj: Parse.Object): TradingSession {
  return {
    objectId: obj.id,
    pair: obj.get('pair'),
    startedAt: obj.get('startedAt'),
    stoppedAt: obj.get('stoppedAt'),
    durationMinutes: obj.get('durationMinutes'),
    totalTrades: obj.get('totalTrades'),
    profitTrades: obj.get('profitTrades'),
    lossTrades: obj.get('lossTrades'),
    totalProfitUSDC: obj.get('totalProfitUSDC'),
    totalProfitBase: obj.get('totalProfitBase'),
    stopReason: obj.get('stopReason') as BotStopReason,
    configName: obj.get('configName') as GridConfigName,
  }
}

export async function saveTradingSession(
  session: Omit<TradingSession, 'objectId'>
): Promise<TradingSession> {
  initParse()
  const SessionClass = Parse.Object.extend('TradingSessions')
  const obj = new SessionClass()

  obj.set('pair', session.pair)
  obj.set('startedAt', session.startedAt)
  obj.set('stoppedAt', session.stoppedAt)
  obj.set('durationMinutes', session.durationMinutes)
  obj.set('totalTrades', session.totalTrades)
  obj.set('profitTrades', session.profitTrades)
  obj.set('lossTrades', session.lossTrades)
  obj.set('totalProfitUSDC', session.totalProfitUSDC)
  obj.set('totalProfitBase', session.totalProfitBase)
  obj.set('stopReason', session.stopReason)
  obj.set('configName', session.configName)

  const saved = await obj.save()
  return toSession(saved)
}

export async function getRecentSessions(pair: string, days = 7): Promise<TradingSession[]> {
  initParse()
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  const query = new Parse.Query('TradingSessions')
  query.equalTo('pair', pair)
  query.greaterThanOrEqualTo('stoppedAt', since)
  query.descending('stoppedAt')
  query.limit(100)

  const results = await query.find()
  return results.map(toSession)
}
