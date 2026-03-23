'use client'

import { useQuery } from '@tanstack/react-query'
import { useBotStore } from '@/store/bot'
import type { StatusResponse, TradeRecord, DailyProfit, TradesSummary, GridOrder } from '@/lib/types'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as T
}

export function useStatus() {
  const updateFromStatus = useBotStore(s => s.updateFromStatus)

  return useQuery({
    queryKey: ['status'],
    queryFn: async () => {
      const data = await fetchJson<StatusResponse>('/api/status')
      updateFromStatus(data)
      return data
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}

export function useTrades(limit = 20) {
  return useQuery({
    queryKey: ['trades', limit],
    queryFn: () => fetchJson<TradeRecord[]>(`/api/trades?limit=${limit}`),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
}

export function useTodayTrades() {
  return useQuery({
    queryKey: ['trades-today'],
    queryFn: () => fetchJson<TradeRecord[]>('/api/trades?today=true&limit=88'),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
}

export function useTradesSummary() {
  const updateFromSummary = useBotStore(s => s.updateFromSummary)

  return useQuery({
    queryKey: ['trades-summary'],
    queryFn: async () => {
      const data = await fetchJson<TradesSummary>('/api/trades/summary')
      updateFromSummary({ todayTrades: data.todayTrades, todayProfitUSDC: data.todayProfitUSDC })
      return data
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

export function useProfitHistory(days = 30) {
  return useQuery({
    queryKey: ['profit-history', days],
    queryFn: () => fetchJson<DailyProfit[]>(`/api/profit/history?days=${days}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useMarketAnalysis() {
  return useQuery({
    queryKey: ['market-analysis'],
    queryFn: () => fetchJson('/api/market/analysis'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useGridOrders() {
  return useQuery({
    queryKey: ['grid-orders'],
    queryFn: () => fetchJson<GridOrder[]>('/api/grid/orders'),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}

export function useLayersLatest() {
  return useQuery({
    queryKey: ['layers-latest'],
    queryFn: () => fetchJson('/api/layers/latest'),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
}
