import type { AppConfig, GridConfig, GridConfigName } from './types'

// ─── Constantes globales ───────────────────────────────────────────────────
export const BINANCE_FEE_PERCENT = 0.1
export const MIN_LEVEL_SEPARATION = 0.25
export const MAIN_LOOP_INTERVAL_MS = 15_000
export const REANALYSIS_CRON = '0 */4 * * *'
export const LAYER3_MIN_INTERVAL_MS = 15 * 60 * 1000
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

// ─── Configuración central desde variables de entorno ─────────────────────
export function getAppConfig(): AppConfig {
  return {
    binance: {
      apiKey: process.env.BINANCE_API_KEY ?? '',
      secret: process.env.BINANCE_SECRET ?? '',
      testnet: process.env.BINANCE_TESTNET === 'true',
    },
    back4app: {
      appId: process.env.BACK4APP_APP_ID ?? '',
      jsKey: process.env.BACK4APP_JS_KEY ?? '',
      serverUrl: process.env.BACK4APP_SERVER_URL ?? 'https://parseapi.back4app.com/parse',
    },
    bot: {
      pair: process.env.PAIR ?? 'XRP/USDC',
      activePercent: Number(process.env.ACTIVE_PERCENT ?? 20),
      gridLevels: Number(process.env.GRID_LEVELS ?? 10),
      gridRangePercent: Number(process.env.GRID_RANGE_PERCENT ?? 6),
      stopLossPercent: Number(process.env.STOP_LOSS_PERCENT ?? 12),
      maxDailyTrades: Number(process.env.MAX_DAILY_TRADES ?? 200),
      layer1MinRiskScore: Number(process.env.LAYER1_MIN_RISK_SCORE ?? 30),
      layer2MinProbability: Number(process.env.LAYER2_MIN_PROBABILITY ?? 45),
      layer3TriggerVolatility: Number(process.env.LAYER3_TRIGGER_VOLATILITY ?? 2.0),
      layer3TriggerIdleMinutes: Number(process.env.LAYER3_TRIGGER_IDLE_MINUTES ?? 30),
      layer3ReviewHours: Number(process.env.LAYER3_REVIEW_HOURS ?? 4),
      sizingBaseAmount: Number(process.env.SIZING_BASE_AMOUNT ?? 0.001),
      sizingMaxMultiplier: Number(process.env.SIZING_MAX_MULTIPLIER ?? 1.5),
      sizingMinMultiplier: Number(process.env.SIZING_MIN_MULTIPLIER ?? 0.2),
      sizingCentralLevelsPercent: Number(process.env.SIZING_CENTRAL_LEVELS_PERCENT ?? 60),
      splitEnabled: process.env.SPLIT_ENABLED === 'true',
      splitParts: Number(process.env.SPLIT_PARTS ?? 3),
      splitDistribution: (process.env.SPLIT_DISTRIBUTION ?? '30,40,30')
        .split(',')
        .map(Number),
      splitSpreadPercent: Number(process.env.SPLIT_SPREAD_PERCENT ?? 0.15),
      profitTargetUSDC: Number(process.env.PROFIT_TARGET_USDC ?? 5.0),
    },
    server: {
      port: Number(process.env.PORT ?? 3000),
    },
    logLevel: process.env.LOG_LEVEL ?? 'info',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    mockBalance: process.env.MOCK_BALANCE === 'true',
  }
}
