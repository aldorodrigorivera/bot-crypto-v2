'use client'

import { useState } from 'react'
import { useBotStore } from '@/store/bot'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BarChart2, RefreshCw, CheckCircle, XCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const BACKTEST_TOOLTIP = `Simulación de la estrategia grid sobre datos históricos reales (últimos 90 días) antes de operar con dinero real.

Métricas clave:
• Win Rate: % de ciclos buy→sell que terminaron con ganancia
• Profit Factor: ganancias totales ÷ pérdidas totales (>1.3 = rentable)
• Max Drawdown: peor caída % desde el pico de capital
• Score: calificación global 0–100

Si el backtest no aprueba (Score bajo), el bot te advierte antes de arrancar.`

function TitleWithTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1 cursor-default">
            {children}
            <Info className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-line">
          {BACKTEST_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function BacktestPanel() {
  const backtest = useBotStore(s => s.backtest)
  const [isRequesting, setIsRequesting] = useState(false)

  const hasData = backtest.lastRunAt !== null
  const isRunning = backtest.isRunning || isRequesting

  async function handleRerun() {
    setIsRequesting(true)
    try {
      await fetch('/api/backtest/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    } finally {
      setIsRequesting(false)
    }
  }

  function fmtAgo(iso: string | null): string {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `hace ${mins}m`
    return `hace ${Math.floor(mins / 60)}h`
  }

  function metricColor(value: number, min: number, inverse = false): string {
    const pass = inverse ? value <= min : value >= min
    return pass ? 'text-green-400' : 'text-red-400'
  }

  if (!hasData && !isRunning) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            <TitleWithTooltip>Último Backtest</TitleWithTooltip>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleRerun} disabled={isRunning}>
            <RefreshCw className={cn('h-3 w-3 mr-1', isRunning && 'animate-spin')} />
            Ejecutar
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Sin backtest registrado. Ejecuta uno para validar la configuración.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart2 className="h-4 w-4" />
          <TitleWithTooltip>
            Último Backtest
            {backtest.lastRunAt && (
              <span className="text-xs text-muted-foreground font-normal ml-1">{fmtAgo(backtest.lastRunAt)}</span>
            )}
          </TitleWithTooltip>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={handleRerun} disabled={isRunning}>
          <RefreshCw className={cn('h-3 w-3 mr-1', isRunning && 'animate-spin')} />
          {isRunning ? 'Corriendo...' : 'Re-run'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Ejecutando backtest, esto puede tomar unos segundos...
          </div>
        )}

        {!isRunning && (
          <>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className={cn('text-lg font-bold', metricColor(backtest.winRate, 55))}>
                  {backtest.winRate}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Profit Factor</p>
                <p className={cn('text-lg font-bold', metricColor(backtest.profitFactor, 1.3))}>
                  {backtest.profitFactor}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Max DD</p>
                <p className={cn('text-lg font-bold', metricColor(backtest.maxDrawdown, 15, true))}>
                  {backtest.maxDrawdown}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="text-lg font-bold text-foreground">{backtest.score}/100</p>
              </div>
            </div>

            {backtest.configName && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Config:</span>
                <Badge variant="outline" className="text-xs">{backtest.configName}</Badge>
              </div>
            )}

            <div className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
              backtest.passed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            )}>
              {backtest.passed
                ? <><CheckCircle className="h-4 w-4" /> APROBADO — Listo para operar</>
                : <><XCircle className="h-4 w-4" /> NO APROBADO</>
              }
            </div>

            {!backtest.passed && backtest.failedReasons.length > 0 && (
              <ul className="space-y-1">
                {backtest.failedReasons.map((r, i) => (
                  <li key={i} className="text-xs text-red-400 flex gap-1">
                    <span>·</span><span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
