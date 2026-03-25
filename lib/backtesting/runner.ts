import { simulateGrid } from './simulator'
import { calculateMetrics } from './metrics'
import { GRID_CONFIGS } from '../config'
import type { OHLCVCandle, MultiConfigResult, BacktestMetrics, AppConfig } from '../types'

export async function runMultiConfigBacktest(
  candles: OHLCVCandle[],
  benchmarks: AppConfig['backtest'],
  durationDays: number
): Promise<MultiConfigResult> {
  // Correr las 3 configs en paralelo sobre los mismos datos
  const [consResult, balResult, aggResult] = await Promise.all([
    Promise.resolve(simulateGrid({ candles, configName: 'conservative' })),
    Promise.resolve(simulateGrid({ candles, configName: 'balanced' })),
    Promise.resolve(simulateGrid({ candles, configName: 'aggressive' })),
  ])

  const conservative = calculateMetrics(consResult, benchmarks, GRID_CONFIGS.conservative.gridLevels, durationDays)
  const balanced = calculateMetrics(balResult, benchmarks, GRID_CONFIGS.balanced.gridLevels, durationDays)
  const aggressive = calculateMetrics(aggResult, benchmarks, GRID_CONFIGS.aggressive.gridLevels, durationDays)

  const scores: Array<{ name: 'conservative' | 'balanced' | 'aggressive'; metrics: BacktestMetrics }> = [
    { name: 'conservative', metrics: conservative },
    { name: 'balanced', metrics: balanced },
    { name: 'aggressive', metrics: aggressive },
  ]

  // Ganador = mayor score; si hay empate, preferir la más conservadora
  const winner = scores.reduce((best, curr) => curr.metrics.score > best.metrics.score ? curr : best, scores[0])

  const winnerLabel = GRID_CONFIGS[winner.name].label
  const m = winner.metrics
  const winnerReason = `Mayor score compuesto (${m.score}/100). Win rate ${m.winRate}%, PF ${m.profitFactor}`

  return {
    conservative,
    balanced,
    aggressive,
    winner: winner.name,
    winnerReason,
  }
}
