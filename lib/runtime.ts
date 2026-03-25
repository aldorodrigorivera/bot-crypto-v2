import type { BotRuntime } from './types'

function createInitialRuntime(): BotRuntime {
  return {
    isRunning: false,
    isPaused: false,
    botState: null,
    activeOrders: new Map(),
    currentConfig: null,
    lastAnalysis: null,
    dailyTradesCount: 0,
    dailyTradesDate: '',
    mainLoopInterval: null,
    lastLayer3At: null,
    ordersSkippedToday: 0,
    lastTradeAt: null,
    layer3Bias: 'neutral',
    layer3Action: 'keep',
    orderLimitReached: false,
    consecutiveLosses: 0,
    peakProfitUSDC: 0,
    pauseUntil: null,
    lastBacktestFailed: false,
    lastBacktestMetrics: null,
    incubationSizeMultiplier: 1.0,
    pausedForDailyLimit: false,
    startSnapshot: null,
  }
}

const g = globalThis as { botRuntime?: BotRuntime }
export const runtime: BotRuntime = g.botRuntime ?? createInitialRuntime()
if (!g.botRuntime) g.botRuntime = runtime
