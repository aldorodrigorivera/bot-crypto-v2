'use client'

import { useBotStore } from '@/store/bot'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FlaskConical, CheckCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IncubationPhase } from '@/lib/types'

const INCUBATION_TOOLTIP = `Sistema de escalado progresivo que protege tu capital al iniciar.

En vez de operar al 100% desde el primer trade, el bot empieza con órdenes muy pequeñas y aumenta el tamaño solo si los resultados son buenos.

Fases y tamaño de órdenes:
• MICRO  → 0.1% del tamaño normal (validación inicial)
• SMALL  → 25% — necesita 10 trades con win rate ≥50%
• MEDIUM → 50% — necesita 20 trades con win rate ≥53%
• NORMAL → 100% — necesita 30 trades, ≥7 días, win rate ≥55%

Si las pérdidas superan el 5% del total operado en cualquier fase, el bot se detiene automáticamente para proteger el capital.`

const PHASE_CONFIG: Record<IncubationPhase, { label: string; color: string; index: number }> = {
  micro:  { label: 'MICRO',  color: 'bg-red-500',    index: 0 },
  small:  { label: 'SMALL',  color: 'bg-yellow-500', index: 1 },
  medium: { label: 'MEDIUM', color: 'bg-blue-500',   index: 2 },
  normal: { label: 'NORMAL', color: 'bg-green-500',  index: 3 },
}
const PHASES: IncubationPhase[] = ['micro', 'small', 'medium', 'normal']

export function IncubationPanel() {
  const incubation = useBotStore(s => s.incubation)

  const titleNode = (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1 cursor-default">
            Modo Incubación
            <Info className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-line">
          {INCUBATION_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  if (!incubation.isActive) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            {titleNode}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Incubación no activa. El bot opera al tamaño completo configurado.</p>
        </CardContent>
      </Card>
    )
  }

  const current = PHASE_CONFIG[incubation.phase]
  const pct = Math.round(incubation.sizeMultiplier * 100)

  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-yellow-400" />
          {titleNode}
        </CardTitle>
        <Badge variant="outline" className={cn('text-xs', current.color.replace('bg-', 'text-'))}>
          {current.label} — {pct}% del tamaño
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-1">
          {PHASES.map((phase, i) => {
            const cfg = PHASE_CONFIG[phase]
            const isActive = cfg.index === current.index
            const isPast = cfg.index < current.index
            return (
              <div key={phase} className="flex items-center gap-1 flex-1">
                <div className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  isActive ? cfg.color : isPast ? 'bg-muted-foreground' : 'bg-muted'
                )} />
                <span className={cn(
                  'text-xs',
                  isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}>{cfg.label}</span>
                {i < PHASES.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
              </div>
            )
          })}
        </div>

        {incubation.phase !== 'normal' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progreso hacia siguiente fase</span>
              <span>{incubation.progressPercent}%</span>
            </div>
            <Progress value={incubation.progressPercent} className="h-1.5" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Trades reales</p>
            <p className="font-medium text-foreground">{incubation.tradesIn}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Días en incubación</p>
            <p className="font-medium text-foreground">{incubation.daysIn.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Win rate real</p>
            <p className="font-medium text-foreground">{incubation.realWinRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Profit Factor real</p>
            <p className="font-medium text-foreground">
              {incubation.realPF == null || incubation.realPF === Infinity ? '∞' : incubation.realPF.toFixed(2)}
            </p>
          </div>
        </div>

        {incubation.phase === 'normal' && (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <CheckCircle className="h-4 w-4" />
            Incubación completada — Operando a tamaño completo
          </div>
        )}
      </CardContent>
    </Card>
  )
}
