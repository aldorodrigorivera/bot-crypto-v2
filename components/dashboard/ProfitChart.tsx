'use client'

import { memo } from 'react'
import { useBotStore } from '@/store/bot'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

export const ProfitChart = memo(function ProfitChart() {
  const { profitHistory, totalProfitUSDC, botStatus } = useBotStore(useShallow(s => ({
    profitHistory: s.profitHistory,
    totalProfitUSDC: s.totalProfitUSDC,
    botStatus: s.botStatus,
  })))

  const points = profitHistory.slice(-MAX_POINTS)

  const labels = points.map(p => {
    const d = new Date(p.time)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  })

  const profits = points.map(p => p.profit)
  const isEmpty = profits.length < 2

  const lastProfit = profits[profits.length - 1] ?? 0
  const firstProfit = profits[0] ?? 0
  const isUp = lastProfit >= firstProfit

  const lineColor = isUp ? 'rgba(34,197,94,1)' : 'rgba(239,68,68,1)'
  const fillColor = isUp ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'

  const data = {
    labels,
    datasets: [
      {
        label: 'Ganancia USDT',
        data: profits,
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: lineColor,
        tension: 0.2,
        fill: true,
      },
    ],
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'hsl(224 71.4% 4.1%)',
        borderColor: 'hsl(215 27.9% 16.9%)',
        borderWidth: 1,
        titleColor: 'hsl(210 20% 98%)',
        bodyColor: 'hsl(215.4 16.3% 56.9%)',
        padding: 10,
        callbacks: {
          label: (ctx) => {
            const val = Number(ctx.raw)
            return ` ${val >= 0 ? '+' : ''}${val.toFixed(4)} USDT`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: 'hsl(215.4 16.3% 56.9%)',
          font: { size: 10 },
          maxTicksLimit: 8,
          maxRotation: 0,
        },
        border: { display: false },
      },
      y: {
        position: 'right',
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: 'hsl(215.4 16.3% 56.9%)',
          font: { size: 10 },
          callback: (v) => {
            const n = Number(v)
            return `${n >= 0 ? '+' : ''}${n.toFixed(3)}`
          },
        },
        border: { display: false },
      },
    },
  }

  const profitLabel = totalProfitUSDC >= 0
    ? `+${totalProfitUSDC.toFixed(4)} USDT`
    : `${totalProfitUSDC.toFixed(4)} USDT`

  const statusLabel = botStatus === 'running'
    ? 'sesión actual'
    : botStatus === 'paused'
      ? 'pausado'
      : 'última sesión'

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Ganancia Total
          <span className={`ml-1 font-bold tabular-nums ${totalProfitUSDC >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {profitLabel}
          </span>
          <span className="ml-auto text-xs text-muted-foreground font-normal">{statusLabel} · 10 min</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 pb-4">
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-1 text-muted-foreground text-sm">
            <span>Sin datos de ganancia aún</span>
            {botStatus !== 'running' && (
              <span className="text-xs">Inicia el bot para comenzar a registrar</span>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <Line data={data} options={options} />
          </div>
        )}
      </CardContent>
    </Card>
  )
})

const MAX_POINTS = 60 // últimos 60 minutos visibles en la gráfica
