import type { IncubationState, IncubationPhase, AppConfig } from '../types'

export interface ScalingEvaluation {
  shouldScale: boolean
  nextPhase?: IncubationPhase
  shouldAbort: boolean
  abortReason?: string
}

export function evaluateScaling(
  state: IncubationState,
  config: AppConfig['incubation']
): ScalingEvaluation {
  const { realTrades, realWinRate, currentPhase, totalRealLossBTC, totalRealProfitBTC } = state

  // Calcular pérdida acumulada como % del capital total operado
  const totalTraded = totalRealProfitBTC + totalRealLossBTC
  const lossPercent = totalTraded > 0
    ? (totalRealLossBTC / totalTraded) * 100
    : 0

  // Abort: pérdida acumulada supera el límite en cualquier fase
  if (lossPercent > config.maxLossPercent && totalTraded > 0) {
    return {
      shouldScale: false,
      shouldAbort: true,
      abortReason: `Pérdida acumulada ${lossPercent.toFixed(1)}% superó el límite de ${config.maxLossPercent}%`,
    }
  }

  // Ya está en normal — no hay más escalado
  if (currentPhase === 'normal') {
    return { shouldScale: false, shouldAbort: false }
  }

  // MICRO → SMALL
  if (currentPhase === 'micro') {
    if (realTrades >= 10 && realWinRate >= 50) {
      return { shouldScale: true, nextPhase: 'small', shouldAbort: false }
    }
    return { shouldScale: false, shouldAbort: false }
  }

  // SMALL → MEDIUM
  if (currentPhase === 'small') {
    if (realTrades >= 20 && realWinRate >= 53 && lossPercent <= config.maxLossPercent) {
      return { shouldScale: true, nextPhase: 'medium', shouldAbort: false }
    }
    return { shouldScale: false, shouldAbort: false }
  }

  // MEDIUM → NORMAL
  if (currentPhase === 'medium') {
    const daysInIncubation = (Date.now() - state.startedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (
      realTrades >= config.minTrades &&
      daysInIncubation >= config.durationDays &&
      realWinRate >= config.targetWinRate &&
      lossPercent <= config.maxLossPercent
    ) {
      return { shouldScale: true, nextPhase: 'normal', shouldAbort: false }
    }
    return { shouldScale: false, shouldAbort: false }
  }

  return { shouldScale: false, shouldAbort: false }
}

export function getSizeMultiplierForPhase(phase: IncubationPhase, minSize: number): number {
  switch (phase) {
    case 'micro':   return minSize
    case 'small':   return 0.25
    case 'medium':  return 0.50
    case 'normal':  return 1.0
  }
}
