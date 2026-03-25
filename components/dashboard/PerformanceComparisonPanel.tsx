'use client'

import { usePerformanceComparison } from '@/hooks/useDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TrendingUp, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const COMPARISON_TOOLTIP = `Compara las métricas reales del bot contra lo que predijo el backtest.

Si los números reales divergen mucho del backtest, significa que el mercado cambió o que la configuración necesita ajuste.

Columnas:
• Backtest: lo que se esperaba según la simulación histórica
• Real: lo que el bot está logrando en operaciones reales
• Div.: divergencia porcentual entre ambos

Semáforo de divergencia:
• Verde  ≤10% — estrategia funcionando como se esperaba
• Amarillo 10–20% — hay diferencia, monitorear
• Rojo   >20% — el mercado cambió, considerar reconfigurar

Requiere mínimo 20 trades reales para activarse.`

interface ComparisonRow {
  label: string
  backtest: number | string
  real: number | string
  divergencePct: number | null
  fmt: (v: number | string) => string
}

export function PerformanceComparisonPanel() {
  const { data: raw, isLoading } = usePerformanceComparison()
  const data = raw as {
    ready: boolean
    realTrades?: number
    minTrades?: number
    message?: string
    comparison?: {
      winRate: { backtest: number; real: number; divergencePct: number }
      profitFactor: { backtest: number; real: number; divergencePct: number }
      avgProfitPerCycle: { backtest: number; real: number; divergencePct: number }
    }
    maxDivergence?: number
    alert?: string | null
  } | null

  const titleNode = (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1 cursor-default">
            Real vs Simulado
            <Info className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-line">
          {COMPARISON_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  if (isLoading || !data) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {titleNode}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Cargando datos...</p>
        </CardContent>
      </Card>
    )
  }

  if (!data.ready || !data.comparison) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {titleNode}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{data.message}</p>
        </CardContent>
      </Card>
    )
  }

  const c = data.comparison!
  const rows: ComparisonRow[] = [
    { label: 'Win Rate', backtest: c.winRate.backtest, real: c.winRate.real, divergencePct: c.winRate.divergencePct, fmt: v => `${v}%` },
    { label: 'Profit Factor', backtest: c.profitFactor.backtest, real: c.profitFactor.real, divergencePct: c.profitFactor.divergencePct, fmt: v => String(v) },
    { label: 'Avg Profit/Ciclo', backtest: c.avgProfitPerCycle.backtest, real: c.avgProfitPerCycle.real, divergencePct: c.avgProfitPerCycle.divergencePct, fmt: v => `$${Number(v).toFixed(4)}` },
  ]

  function divColor(pct: number | null): string {
    if (pct == null) return 'text-muted-foreground'
    if (pct <= 10) return 'text-green-400'
    if (pct <= 20) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {titleNode}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-border/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-3 py-2 text-left text-muted-foreground font-normal">Métrica</th>
                <th className="px-3 py-2 text-right text-muted-foreground font-normal">Backtest</th>
                <th className="px-3 py-2 text-right text-muted-foreground font-normal">Real</th>
                <th className="px-3 py-2 text-right text-muted-foreground font-normal">Div.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="border-b border-border/30 last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{row.label}</td>
                  <td className="px-3 py-2 text-right text-foreground">{row.fmt(row.backtest)}</td>
                  <td className="px-3 py-2 text-right text-foreground">{row.fmt(row.real)}</td>
                  <td className={cn('px-3 py-2 text-right', divColor(row.divergencePct))}>
                    {row.divergencePct != null ? `${row.divergencePct.toFixed(0)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.alert ? (
          <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{data.alert}</span>
          </div>
        ) : (
          <p className="text-xs text-green-400">
            Divergencia dentro de rango normal ({data.maxDivergence}% &lt; 20%)
          </p>
        )}
      </CardContent>
    </Card>
  )
}
