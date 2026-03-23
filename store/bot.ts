import { create } from 'zustand'
import type { SSEEvent, AgentBias, StatusResponse } from '@/lib/types'

const TEN_MINUTES_MS = 10 * 60 * 1000
const MAX_PROFIT_POINTS = 72 // 12 horas a intervalos de 10 min

export interface ProfitPoint {
  time: number   // timestamp ms
  profit: number // ganancia acumulada USDC
}

interface BotStore {
  // Estado del bot
  botStatus: 'loading' | 'running' | 'paused' | 'stopped'
  isPaused: boolean
  currentPrice: number
  prevPrice: number
  priceDirection: 'up' | 'down' | 'neutral'
  sseConnected: boolean

  // Historial de ganancias (intervalo 10 min)
  profitHistory: ProfitPoint[]
  lastProfitSampledAt: number

  // Capital
  activePercent: number
  totalBase: number
  activeUSDC: number
  totalUSDC: number
  totalProfitUSDC: number
  botUSDC: number | null  // null = no calculado aún; solo se actualiza con el botón
  todayProfitUSDC: number
  totalTrades: number
  todayTrades: number
  ordersSkippedToday: number

  // Grid
  gridMin: number
  gridMax: number
  gridLevels: number
  gridConfig: string
  openOrders: number

  // Capas
  layer3Bias: AgentBias
  layer3LastAction: string
  capitalEfficiency: number

  // Mercado
  pair: string
  mode: string

  // Acciones
  updateFromSSE: (event: SSEEvent) => void
  updateFromStatus: (data: StatusResponse) => void
  updateFromSummary: (data: { todayTrades: number; todayProfitUSDC: number }) => void
  setSSEConnected: (connected: boolean) => void
  setBotUSDC: (value: number) => void
}

export const useBotStore = create<BotStore>((set, get) => ({
  botStatus: 'loading',
  isPaused: false,
  currentPrice: 0,
  prevPrice: 0,
  priceDirection: 'neutral',
  sseConnected: false,

  profitHistory: [],
  lastProfitSampledAt: 0,

  activePercent: 20,
  totalBase: 0,
  activeUSDC: 0,
  totalUSDC: 0,
  totalProfitUSDC: 0,
  botUSDC: null,
  todayProfitUSDC: 0,
  totalTrades: 0,
  todayTrades: 0,
  ordersSkippedToday: 0,

  gridMin: 0,
  gridMax: 0,
  gridLevels: 0,
  gridConfig: 'balanced',
  openOrders: 0,

  layer3Bias: 'neutral',
  layer3LastAction: 'keep',
  capitalEfficiency: 0,

  pair: 'XRP/USDC',
  mode: 'TESTNET',

  setSSEConnected: (connected) => set({ sseConnected: connected }),
  setBotUSDC: (value) => set({ botUSDC: value }),

  updateFromStatus: (data) => {
    const bs = data.botState
    const lb = data.liveBalance

    set({
      pair: data.pair,
      mode: data.mode,
      isPaused: data.isPaused,
      botStatus: data.isRunning ? 'running' : data.isPaused ? 'paused' : 'stopped',
      openOrders: data.openOrdersCount,
      currentPrice: data.currentPrice,

      activePercent: data.activePercent ?? 20,
      totalBase: lb?.totalBase ?? bs?.totalBase ?? 0,
      activeUSDC: lb?.activeUSDC ?? bs?.activeUSDC ?? 0,
      totalUSDC: lb?.totalUSDC ?? 0,
      totalProfitUSDC: bs?.totalProfitUSDC ?? 0,
      totalTrades: bs?.totalTrades ?? 0,
      ordersSkippedToday: bs?.ordersSkippedToday ?? 0,

      gridMin: bs?.gridMin ?? 0,
      gridMax: bs?.gridMax ?? 0,
      gridLevels: bs?.gridLevels ?? 0,
      gridConfig: bs?.configName ?? 'balanced',

      layer3Bias: bs?.agentBias ?? 'neutral',
      layer3LastAction: 'keep',
    })
  },

  updateFromSummary: (data) => {
    set({
      todayTrades: data.todayTrades,
      todayProfitUSDC: data.todayProfitUSDC,
    })
  },

  updateFromSSE: (event) => {
    const state = get()

    switch (event.type) {
      case 'price_update': {
        const d = event.data as { price: number; pair: string }
        const now = Date.now()
        const prev = state.currentPrice
        const dir = d.price > prev ? 'up' : d.price < prev ? 'down' : 'neutral'

        // Muestrear ganancia acumulada cada 10 minutos
        const shouldSample = now - state.lastProfitSampledAt >= TEN_MINUTES_MS
        if (shouldSample && state.botStatus === 'running') {
          const newPoint: ProfitPoint = { time: now, profit: state.totalProfitUSDC }
          const updated = [...state.profitHistory, newPoint].slice(-MAX_PROFIT_POINTS)
          set({
            currentPrice: d.price,
            prevPrice: prev,
            priceDirection: dir,
            profitHistory: updated,
            lastProfitSampledAt: now,
          })
        } else {
          set({ currentPrice: d.price, prevPrice: prev, priceDirection: dir })
        }
        break
      }

      case 'trade_executed': {
        const d = event.data as { profit: number }
        const newProfit = state.totalProfitUSDC + (d.profit ?? 0)
        const now = Date.now()
        // Agregar nodo inmediato en cada trade
        const newPoint: ProfitPoint = { time: now, profit: newProfit }
        const updated = [...state.profitHistory, newPoint].slice(-MAX_PROFIT_POINTS)
        set(s => ({
          totalTrades: s.totalTrades + 1,
          todayTrades: s.todayTrades + 1,
          totalProfitUSDC: newProfit,
          todayProfitUSDC: s.todayProfitUSDC + (d.profit ?? 0),
          profitHistory: updated,
          lastProfitSampledAt: now,
        }))
        break
      }

      case 'order_placed': {
        // No se incrementa aquí — se sincroniza desde /api/status con conteo real de órdenes 'open'
        break
      }

      case 'bot_status_change': {
        const d = event.data as { status: string }
        const status = d.status === 'running' ? 'running'
          : d.status === 'paused' ? 'paused'
          : 'stopped'
        // Resetear historial al iniciar una nueva sesión
        if (status === 'running') {
          set({
            botStatus: status,
            isPaused: false,
            profitHistory: [{ time: Date.now(), profit: 0 }],
            lastProfitSampledAt: Date.now(),
          })
        } else {
          set({ botStatus: status, isPaused: status === 'paused' })
        }
        break
      }

      case 'agent_response': {
        const d = event.data as { market_bias: AgentBias; grid_adjustment: { action: string } }
        set({ layer3Bias: d.market_bias, layer3LastAction: d.grid_adjustment?.action ?? 'keep' })
        break
      }

      case 'efficiency_update': {
        const d = event.data as { score: number }
        set({ capitalEfficiency: d.score })
        break
      }
    }
  },
}))
