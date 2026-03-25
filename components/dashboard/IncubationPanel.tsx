'use client'

import { useBotStore } from '@/store/bot'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { FlaskConical, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IncubationPhase } from '@/lib/types'

const PHASE_CONFIG: Record<IncubationPhase, { label: string; color: string; index: number }> = {
  micro:  { label: 'MICRO',  color: 'bg-red-500',    index: 0 },
  small:  { label: 'SMALL',  color: 'bg-yellow-500', index: 1 },
  medium: { label: 'MEDIUM', color: 'bg-blue-500',   index: 2 },
  normal: { label: 'NORMAL', color: 'bg-green-500',  index: 3 },
}
const PHASES: IncubationPhase[] = ['micro', 'small', 'medium', 'normal']

export function IncubationPanel() {
  const incubation = useBotStore(s => s.incubation)

  if (!incubation.isActive) return null

  const current = PHASE_CONFIG[incubation.phase]
  const pct = Math.round(incubation.sizeMultiplier * 100)

  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-yellow-400" />
          Modo Incubación
        </CardTitle>
        <Badge variant="outline" className={cn('text-xs', current.color.replace('bg-', 'text-'))}>
          {current.label} — {pct}% del tamaño
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Barra de fases */}
        <div className="flex items-center gap-1">
          {PHASES.map((phase, i) => {
            const cfg = PHASE_CONFIG[phase]
            const isActive = cfg.index === current.index
            const isPast = cfg.index < current.index
            return (
              <div key={phase} className="flex items-center gap-1 flex-1">
                <div className={cn(
                  'h-2 w-2 rounded-full flex-shrink-0',
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

        {/* Progreso hacia siguiente fase */}
        {incubation.phase !== 'normal' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progreso hacia siguiente fase</span>
              <span>{incubation.progressPercent}%</span>
            </div>
            <Progress value={incubation.progressPercent} className="h-1.5" />
          </div>
        )}

        {/* Métricas */}
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
              {incubation.realPF === Infinity ? '∞' : incubation.realPF.toFixed(2)}
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
