'use client'

import { useBotStore } from '@/store/bot'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Wallet, TrendingUp, BarChart2, Activity, Banknote, PiggyBank, Info } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
  valueClass?: string
  tooltip: React.ReactNode
}

function MetricCard({ title, value, sub, icon, valueClass, tooltip }: MetricCardProps) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent side="top" className="leading-relaxed">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold tabular-nums', valueClass)}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function CapitalCards() {
  const {
    totalBase, totalUSDC, totalProfitUSDC,
    todayTrades, totalTrades, ordersSkippedToday,
    activePercent, botUSDC, pair,
  } = useBotStore()

  const [base] = pair.split('/')
  const totalUSDCLive = totalUSDC + totalProfitUSDC
  const profitSign = totalProfitUSDC >= 0 ? '+' : ''

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricCard
        title={`Total ${base}`}
        value={totalBase.toFixed(2)}
        sub={base}
        icon={<Wallet className="h-4 w-4" />}
        tooltip={
          <div className="space-y-1">
            <p className="font-semibold">Balance total de {base}</p>
            <p className="text-muted-foreground">Cantidad total de {base} en tu cuenta de Binance, incluyendo la reserva intocable (80%) y el capital activo (20%).</p>
          </div>
        }
      />
      <MetricCard
        title="Total USDC"
        value={`$${totalUSDCLive.toFixed(2)}`}
        sub={totalProfitUSDC !== 0 ? `${profitSign}${totalProfitUSDC.toFixed(4)} ganancia` : 'balance total'}
        icon={<Banknote className="h-4 w-4" />}
        valueClass={totalProfitUSDC > 0 ? 'text-green-400' : totalProfitUSDC < 0 ? 'text-red-400' : undefined}
        tooltip={
          <div className="space-y-1">
            <p className="font-semibold">USDC en cuenta</p>
            <p className="text-muted-foreground">Balance USDC del exchange más las ganancias acumuladas desde el inicio del bot.</p>
            <p className="text-muted-foreground">Fórmula: <span className="text-foreground font-mono">balance + ganancias</span></p>
          </div>
        }
      />
      <MetricCard
        title="USDC para Bot"
        value={botUSDC !== null ? `$${botUSDC.toFixed(2)}` : '—'}
        sub={botUSDC !== null ? `${activePercent}% del capital total` : 'Clic en "Actualizar USDC para Bot"'}
        icon={<PiggyBank className="h-4 w-4" />}
        valueClass="text-blue-400"
        tooltip={
          <div className="space-y-1">
            <p className="font-semibold">Capital asignado al bot</p>
            <p className="text-muted-foreground">El {activePercent}% del Total USDC que el bot puede usar para operar. Se fija manualmente con el botón "Actualizar USDC para Bot" y no cambia automáticamente.</p>
            <p className="text-muted-foreground">Fórmula: <span className="text-foreground font-mono">Total USDC × {activePercent}%</span></p>
          </div>
        }
      />
      <MetricCard
        title="Ganancia Total"
        value={`${totalProfitUSDC >= 0 ? '+' : ''}${totalProfitUSDC.toFixed(4)} USDC`}
        sub="desde inicio"
        icon={<TrendingUp className="h-4 w-4" />}
        valueClass={totalProfitUSDC >= 0 ? 'text-green-500' : 'text-red-500'}
        tooltip={
          <div className="space-y-1">
            <p className="font-semibold">Ganancia neta acumulada</p>
            <p className="text-muted-foreground">Suma de ganancias de todos los ciclos completados (compra → venta) desde que se inició el bot, descontando fees de Binance (0.1% por lado).</p>
            <p className="text-muted-foreground">Solo se registra al completar una venta.</p>
          </div>
        }
      />
      <MetricCard
        title="Trades Hoy"
        value={todayTrades.toString()}
        sub={ordersSkippedToday > 0 ? `${ordersSkippedToday} saltadas` : undefined}
        icon={<Activity className="h-4 w-4" />}
        tooltip={
          <div className="space-y-1">
            <p className="font-semibold">Órdenes ejecutadas hoy</p>
            <p className="text-muted-foreground">Total de órdenes (compras + ventas) que el bot procesó durante el día de hoy.</p>
            {ordersSkippedToday > 0 && (
              <p className="text-yellow-500">{ordersSkippedToday} órdenes saltadas por Capa 1, Capa 2 o límite de operaciones abiertas.</p>
            )}
          </div>
        }
      />
      <MetricCard
        title="Total Trades"
        value={totalTrades.toString()}
        sub="histórico"
        icon={<BarChart2 className="h-4 w-4" />}
        tooltip={
          <div className="space-y-1">
            <p className="font-semibold">Ciclos completados (histórico)</p>
            <p className="text-muted-foreground">Número total de ciclos grid completados (ventas con ganancia registrada) desde que el bot fue iniciado por primera vez.</p>
            <p className="text-muted-foreground">Se persiste en base de datos entre sesiones.</p>
          </div>
        }
      />
    </div>
  )
}
