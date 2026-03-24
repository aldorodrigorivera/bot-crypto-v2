'use client'

import { useBotStore } from '@/store/bot'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LayersPanel() {
  const { layer3Bias, layer3LastAction, ordersSkippedToday, isPaused, botStatus } = useBotStore(useShallow(s => ({
    layer3Bias: s.layer3Bias,
    layer3LastAction: s.layer3LastAction,
    ordersSkippedToday: s.ordersSkippedToday,
    isPaused: s.isPaused,
    botStatus: s.botStatus,
  })))

  const biasConfig = {
    bullish: { label: 'ALCISTA', icon: TrendingUp, color: 'text-green-500 border-green-500/30 bg-green-500/10' },
    bearish: { label: 'BAJISTA', icon: TrendingDown, color: 'text-red-500 border-red-500/30 bg-red-500/10' },
    neutral: { label: 'NEUTRAL', icon: Minus, color: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10' },
  }

  const bias = biasConfig[layer3Bias] ?? biasConfig.neutral
  const BiasIcon = bias.icon

  const actionLabels: Record<string, string> = {
    keep: 'Mantener configuración',
    pause: 'Pausar bot',
    rebuild: 'Reconstruir grid',
    shift_up: 'Desplazar arriba',
    shift_down: 'Desplazar abajo',
    widen: 'Ampliar rango',
    narrow: 'Reducir rango',
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Agente IA (Capa 3)
        </CardTitle>
        {botStatus === 'paused' && (
          <Badge variant="destructive" className="text-xs animate-pulse">
            BOT PAUSADO
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Sesgo */}
        <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', bias.color)}>
          <BiasIcon className="h-4 w-4" />
          <div>
            <p className="text-xs text-muted-foreground">Sesgo del mercado</p>
            <p className="font-semibold">{bias.label}</p>
          </div>
        </div>

        {/* Acción */}
        <div className="rounded-lg border border-border/50 px-3 py-2 bg-muted/30">
          <p className="text-xs text-muted-foreground">Última recomendación</p>
          <p className="font-medium text-sm">{actionLabels[layer3LastAction] ?? layer3LastAction}</p>
        </div>

        {/* Órdenes saltadas */}
        {ordersSkippedToday > 0 && (
          <div className="flex items-center gap-2 text-yellow-600 text-xs">
            <AlertTriangle className="h-3 w-3" />
            <span>{ordersSkippedToday} órdenes filtradas hoy</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
