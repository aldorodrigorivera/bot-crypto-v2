import type { IncubationState, AppConfig } from '../types'

export interface IncubationStatus {
  progressToNextPhase: number   // 0-100%
  tradesNeeded: number
  daysNeeded: number
  winRateNeeded: number
  currentLossPercent: number
  daysInIncubation: number
}

export function getIncubationStatus(
  state: IncubationState,
  config: AppConfig['incubation']
): IncubationStatus {
  const { realTrades, realWinRate, currentPhase, totalRealLossBTC, totalRealProfitBTC, startedAt } = state
  const daysInIncubation = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24)

  const totalTraded = totalRealProfitBTC + totalRealLossBTC
  const currentLossPercent = totalTraded > 0
    ? (totalRealLossBTC / totalTraded) * 100
    : 0

  if (currentPhase === 'normal') {
    return { progressToNextPhase: 100, tradesNeeded: 0, daysNeeded: 0, winRateNeeded: 0, currentLossPercent, daysInIncubation }
  }

  if (currentPhase === 'micro') {
    const tradeProgress = Math.min(realTrades / 10, 1) * 100
    const winRateProgress = Math.min(realWinRate / 50, 1) * 100
    const progress = Math.round((tradeProgress + winRateProgress) / 2)
    return {
      progressToNextPhase: progress,
      tradesNeeded: Math.max(0, 10 - realTrades),
      daysNeeded: 0,
      winRateNeeded: Math.max(0, 50 - realWinRate),
      currentLossPercent,
      daysInIncubation,
    }
  }

  if (currentPhase === 'small') {
    const tradeProgress = Math.min(realTrades / 20, 1) * 100
    const winRateProgress = Math.min(realWinRate / 53, 1) * 100
    const progress = Math.round((tradeProgress + winRateProgress) / 2)
    return {
      progressToNextPhase: progress,
      tradesNeeded: Math.max(0, 20 - realTrades),
      daysNeeded: 0,
      winRateNeeded: Math.max(0, 53 - realWinRate),
      currentLossPercent,
      daysInIncubation,
    }
  }

  // medium → normal
  const tradeProgress = Math.min(realTrades / config.minTrades, 1) * 100
  const dayProgress = Math.min(daysInIncubation / config.durationDays, 1) * 100
  const winRateProgress = Math.min(realWinRate / config.targetWinRate, 1) * 100
  const progress = Math.round((tradeProgress + dayProgress + winRateProgress) / 3)

  return {
    progressToNextPhase: progress,
    tradesNeeded: Math.max(0, config.minTrades - realTrades),
    daysNeeded: Math.max(0, config.durationDays - daysInIncubation),
    winRateNeeded: Math.max(0, config.targetWinRate - realWinRate),
    currentLossPercent,
    daysInIncubation,
  }
}
