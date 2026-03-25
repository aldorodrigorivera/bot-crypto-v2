'use client'

import { useSSE } from '@/hooks/useSSE'
import { useStatus, useTradesSummary } from '@/hooks/useDashboard'
import { useBotStore } from '@/store/bot'
import { StatusCard } from '@/components/dashboard/StatusCard'
import { CapitalCards } from '@/components/dashboard/CapitalCards'
import { GridPanel } from '@/components/dashboard/GridPanel'
import { LayersPanel } from '@/components/dashboard/LayersPanel'
import { ProfitChart } from '@/components/dashboard/ProfitChart'
import { TradesTable } from '@/components/dashboard/TradesTable'
import { MarketPanel } from '@/components/dashboard/MarketPanel'
import { ControlPanel } from '@/components/dashboard/ControlPanel'
import { TradesDataTable } from '@/components/dashboard/TradesDataTable'
import { BacktestPanel } from '@/components/dashboard/BacktestPanel'
import { IncubationPanel } from '@/components/dashboard/IncubationPanel'
import { PerformanceComparisonPanel } from '@/components/dashboard/PerformanceComparisonPanel'

export default function DashboardPage() {
  // Conectar SSE y obtener datos iniciales
  useSSE()
  useStatus()
  useTradesSummary()

  const totalTrades = useBotStore(s => s.totalTrades)

  return (
    <main className="min-h-screen bg-background p-4 md:p-6 space-y-4">
      {/* Status */}
      <StatusCard />

      {/* Controles */}
      <ControlPanel />

      {/* Capital */}
      <CapitalCards />

      {/* v3: Backtest + Incubación + Real vs Simulado — fila completa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BacktestPanel />
        <IncubationPanel />
        <PerformanceComparisonPanel />
      </div>

      {/* Grid + Capas + Mercado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GridPanel />
        <LayersPanel />
        <MarketPanel />
      </div>

      {/* Gráfico + Tabla órdenes abiertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProfitChart />
        <TradesTable />
      </div>

      {/* Tabla completa de trades del día */}
      <TradesDataTable />
    </main>
  )
}
