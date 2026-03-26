import type { AppConfig, GridConfig, GridConfigName } from './types'
import {
  PAIR, ACTIVE_PERCENT, GRID_LEVELS, GRID_RANGE_PERCENT,
  STOP_LOSS_PERCENT, MAX_DAILY_TRADES,
  LAYER1_MIN_RISK_SCORE, LAYER2_MIN_PROBABILITY,
  LAYER3_TRIGGER_VOLATILITY, LAYER3_TRIGGER_IDLE_MINUTES, LAYER3_REVIEW_HOURS,
  SIZING_BASE_AMOUNT, SIZING_MAX_MULTIPLIER, SIZING_MIN_MULTIPLIER, SIZING_CENTRAL_LEVELS_PERCENT,
  SPLIT_ENABLED, SPLIT_PARTS, SPLIT_DISTRIBUTION, SPLIT_SPREAD_PERCENT,
  PROFIT_TARGET_USDC, LOG_LEVEL, MOCK_BALANCE, BINANCE_TESTNET,
  BACKTEST_ENABLED, BACKTEST_DAYS, BACKTEST_MIN_TRADES, BACKTEST_MIN_WIN_RATE,
  BACKTEST_MIN_PROFIT_FACTOR, BACKTEST_MAX_DRAWDOWN, BACKTEST_MIN_SHARPE,
  INCUBATION_ENABLED, INCUBATION_MIN_SIZE, INCUBATION_DURATION_DAYS,
  INCUBATION_MIN_TRADES, INCUBATION_TARGET_WIN_RATE, INCUBATION_MAX_LOSS_PERCENT,
  MULTI_CONFIG_ENABLED, MAIN_LOOP_INTERVAL_MS,
} from '../bot.config'

// ─── Constantes globales ───────────────────────────────────────────────────
export const BINANCE_FEE_PERCENT = 0.1
export const MIN_LEVEL_SEPARATION = 0.25
export { MAIN_LOOP_INTERVAL_MS }
export const REANALYSIS_CRON = '0 */4 * * *'
export const LAYER3_MIN_INTERVAL_MS = 45 * 60 * 1000
export const PRICE_BROADCAST_INTERVAL_MS = 5_000

// ─── 3 configuraciones predefinidas del grid ──────────────────────────────
export const GRID_CONFIGS: Record<GridConfigName, GridConfig> = {
  conservative: {
    name: 'conservative',
    label: 'Conservador',
    gridLevels: 8,
    gridRangePercent: 6,
    description: 'Pocos niveles, rango moderado. Ideal para mercados laterales suaves.',
    idealFor: 'Baja volatilidad, tendencias moderadas',
    minProfitPerCycle: 0.4,
  },
  balanced: {
    name: 'balanced',
    label: 'Balanceado',
    gridLevels: 12,
    gridRangePercent: 8,
    description: 'Balance entre frecuencia y rango. Funciona bien en la mayoría de condiciones.',
    idealFor: 'Volatilidad moderada',
    minProfitPerCycle: 0.47,
  },
  aggressive: {
    name: 'aggressive',
    label: 'Agresivo',
    gridLevels: 14,
    gridRangePercent: 10,
    description: 'Muchos niveles, rango amplio. Máxima frecuencia de trades.',
    idealFor: 'Alta volatilidad, mercados activos',
    minProfitPerCycle: 0.3,
  },
}

// ─── Configuración central desde bot.config.ts ────────────────────────────
export function getAppConfig(): AppConfig {
  return {
    binance: {
      apiKey: process.env.BINANCE_API_KEY ?? '',
      secret: process.env.BINANCE_SECRET ?? '',
      testnet: BINANCE_TESTNET,
    },
    back4app: {
      appId: process.env.BACK4APP_APP_ID ?? '',
      jsKey: process.env.BACK4APP_JS_KEY ?? '',
      serverUrl: process.env.BACK4APP_SERVER_URL ?? 'https://parseapi.back4app.com/parse',
    },
    bot: {
      pair: PAIR,
      activePercent: ACTIVE_PERCENT,
      gridLevels: GRID_LEVELS,
      gridRangePercent: GRID_RANGE_PERCENT,
      stopLossPercent: STOP_LOSS_PERCENT,
      maxDailyTrades: MAX_DAILY_TRADES,
      layer1MinRiskScore: LAYER1_MIN_RISK_SCORE,
      layer2MinProbability: LAYER2_MIN_PROBABILITY,
      layer3TriggerVolatility: LAYER3_TRIGGER_VOLATILITY,
      layer3TriggerIdleMinutes: LAYER3_TRIGGER_IDLE_MINUTES,
      layer3ReviewHours: LAYER3_REVIEW_HOURS,
      sizingBaseAmount: SIZING_BASE_AMOUNT,
      sizingMaxMultiplier: SIZING_MAX_MULTIPLIER,
      sizingMinMultiplier: SIZING_MIN_MULTIPLIER,
      sizingCentralLevelsPercent: SIZING_CENTRAL_LEVELS_PERCENT,
      splitEnabled: SPLIT_ENABLED,
      splitParts: SPLIT_PARTS,
      splitDistribution: SPLIT_DISTRIBUTION,
      splitSpreadPercent: SPLIT_SPREAD_PERCENT,
      profitTargetUSDC: PROFIT_TARGET_USDC,
    },
    server: {
      port: Number(process.env.PORT ?? 3000),
    },
    logLevel: LOG_LEVEL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    mockBalance: MOCK_BALANCE,
    backtest: {
      enabled: BACKTEST_ENABLED,
      days: BACKTEST_DAYS,
      minTrades: BACKTEST_MIN_TRADES,
      minWinRate: BACKTEST_MIN_WIN_RATE,
      minProfitFactor: BACKTEST_MIN_PROFIT_FACTOR,
      maxDrawdown: BACKTEST_MAX_DRAWDOWN,
      minSharpe: BACKTEST_MIN_SHARPE,
    },
    incubation: {
      enabled: INCUBATION_ENABLED,
      minSize: INCUBATION_MIN_SIZE,
      durationDays: INCUBATION_DURATION_DAYS,
      minTrades: INCUBATION_MIN_TRADES,
      targetWinRate: INCUBATION_TARGET_WIN_RATE,
      maxLossPercent: INCUBATION_MAX_LOSS_PERCENT,
    },
    multiConfig: {
      enabled: MULTI_CONFIG_ENABLED,
    },
  }
}
