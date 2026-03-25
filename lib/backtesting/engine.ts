import { loadHistoricalData } from './dataLoader'
import { simulateGrid } from './simulator'
import { calculateMetrics, formatBacktestOutput } from './metrics'
import { runMultiConfigBacktest } from './runner'
import { saveBacktestResult } from '../database/backtestResults'
import { getAppConfig, GRID_CONFIGS } from '../config'
import { logger } from '../logger'
import type { BacktestMetrics, GridConfigName, MultiConfigResult } from '../types'

export interface BacktestRunResult {
  metrics: BacktestMetrics
  configName: GridConfigName
  multiConfig?: MultiConfigResult
  formattedOutput: string
}

export async function runBacktest(overrideConfigName?: GridConfigName): Promise<BacktestRunResult> {
  const config = getAppConfig()
  const { backtest, bot, multiConfig } = config

  // Feature flag: si está deshabilitado, pasar inmediatamente
  if (!backtest.enabled) {
    const passedMetrics = buildPassedMetrics()
    return {
      metrics: passedMetrics,
      configName: overrideConfigName ?? 'balanced',
      formattedOutput: '[BACKTEST_ENABLED=false] Backtest omitido.',
    }
  }

  logger.info('[backtest] Iniciando backtest...')

  const candles = await loadHistoricalData({
    pair: bot.pair,
    timeframe: '15m',
    days: backtest.days,
  })

  const durationDays = candles.length > 1
    ? (candles[candles.length - 1].timestamp - candles[0].timestamp) / (1000 * 60 * 60 * 24)
    : backtest.days

  const startDate = new Date(candles[0].timestamp)
  const endDate = new Date(candles[candles.length - 1].timestamp)

  let chosenConfigName: GridConfigName = overrideConfigName ?? 'balanced'
  let metrics: BacktestMetrics
  let multiConfigResult: MultiConfigResult | undefined

  if (multiConfig.enabled && !overrideConfigName) {
    logger.info('[backtest] Modo multi-config: comparando 3 configuraciones...')
    multiConfigResult = await runMultiConfigBacktest(candles, backtest, durationDays)
    chosenConfigName = multiConfigResult.winner
    metrics = multiConfigResult[chosenConfigName]
    logger.info(`[backtest] Ganador: ${chosenConfigName} (score ${metrics.score}/100)`)
  } else {
    const simResult = simulateGrid({ candles, configName: chosenConfigName })
    metrics = calculateMetrics(simResult, backtest, GRID_CONFIGS[chosenConfigName].gridLevels, durationDays)
  }

  const chosenConfig = GRID_CONFIGS[chosenConfigName]
  const formattedOutput = formatBacktestOutput(
    metrics,
    chosenConfig.label,
    chosenConfigName,
    backtest.days,
    startDate,
    endDate,
    candles.length
  )

  // Guardar en Back4App (no bloquear si falla)
  saveBacktestResult({
    pair: bot.pair,
    configName: chosenConfigName,
    gridLevels: chosenConfig.gridLevels,
    gridRangePercent: chosenConfig.gridRangePercent,
    periodDays: backtest.days,
    startDate,
    endDate,
    totalTrades: metrics.totalTrades,
    completedCycles: metrics.completedCycles,
    winRate: metrics.winRate,
    profitFactor: metrics.profitFactor,
    sharpeRatio: metrics.sharpeRatio,
    maxDrawdown: metrics.maxDrawdown,
    totalReturn: metrics.totalReturn,
    netProfitUSDC: metrics.netProfitUSDC,
    totalFeesPaid: metrics.totalFeesPaid,
    gridBreaks: metrics.gridBreaks,
    score: metrics.score,
    passed: metrics.passed,
    failedReasons: metrics.failedReasons,
    ranAt: new Date(),
    usedForLaunch: true,
  }).catch(err => logger.warn('[backtest] Error guardando resultado en DB:', err))

  return { metrics, configName: chosenConfigName, multiConfig: multiConfigResult, formattedOutput }
}

function buildPassedMetrics(): BacktestMetrics {
  return {
    winRate: 0, profitFactor: 0, sharpeRatio: 0, maxDrawdown: 0,
    totalTrades: 0, completedCycles: 0, totalReturn: 0,
    avgProfitPerCycle: 0, avgDuration: 0, totalFeesPaid: 0,
    netProfitUSDC: 0, gridBreaks: 0,
    passed: true, failedReasons: [], score: 0,
  }
}
