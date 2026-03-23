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
  }
}

const g = globalThis as { botRuntime?: BotRuntime }
export const runtime: BotRuntime = g.botRuntime ?? createInitialRuntime()
if (!g.botRuntime) g.botRuntime = runtime
