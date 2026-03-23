import { initParse, Parse } from './client'
import type { MarketAnalysis, TrendDirection, TrendStrength } from '../types'
import { GRID_CONFIGS } from '../config'

export async function saveMarketAnalysis(analysis: MarketAnalysis): Promise<void> {
  initParse()
  const MAClass = Parse.Object.extend('MarketAnalysis')
  const obj = new MAClass()

  obj.set('pair', analysis.pair)
  obj.set('currentPrice', analysis.currentPrice)
  obj.set('volatility24h', analysis.volatility24h)
  obj.set('trend', analysis.trend)
  obj.set('trendStrength', analysis.trendStrength)
  obj.set('volume24h', analysis.volume24h)
  obj.set('recommendedConfig', analysis.recommendedConfig.name)
  obj.set('configReason', analysis.configReason)
  obj.set('analyzedAt', analysis.timestamp)

  await obj.save()
}

export async function getLatestMarketAnalysis(pair: string): Promise<MarketAnalysis | null> {
  initParse()
  const query = new Parse.Query('MarketAnalysis')
  query.equalTo('pair', pair)
  query.descending('analyzedAt')

  const obj = await query.first()
  if (!obj) return null

  const configName = obj.get('recommendedConfig') ?? 'balanced'
  return {
    timestamp: obj.get('analyzedAt') ?? new Date(),
    pair: obj.get('pair'),
    currentPrice: obj.get('currentPrice') ?? 0,
    price24hHigh: obj.get('price24hHigh') ?? 0,
    price24hLow: obj.get('price24hLow') ?? 0,
    priceChange24h: obj.get('priceChange24h') ?? 0,
    volatility24h: obj.get('volatility24h') ?? 0,
    averageDailyRange: obj.get('averageDailyRange') ?? 0,
    trend: (obj.get('trend') ?? 'sideways') as TrendDirection,
    trendStrength: (obj.get('trendStrength') ?? 'weak') as TrendStrength,
    priceVsMA20: obj.get('priceVsMA20') ?? 0,
    priceVsMA50: obj.get('priceVsMA50') ?? 0,
    volume24h: obj.get('volume24h') ?? 0,
    volumeChange: obj.get('volumeChange') ?? 0,
    totalBase: obj.get('totalBase') ?? 0,
    reserveBase: obj.get('reserveBase') ?? 0,
    activeBase: obj.get('activeBase') ?? 0,
    estimatedActiveUSDC: obj.get('estimatedActiveUSDC') ?? 0,
    recommendedConfig: GRID_CONFIGS[configName as keyof typeof GRID_CONFIGS] ?? GRID_CONFIGS.balanced,
    configReason: obj.get('configReason') ?? '',
  }
}
