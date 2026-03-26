'use client'

import { useBotStore } from '@/store/bot'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Brain, AlertTriangle, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-semibold">Capa 3 — Agente Claude AI</p>
              <p className="text-muted-foreground">Análisis profundo del mercado usando Claude (claude-sonnet-4-6). Evalúa RSI, MACD, Bollinger Bands, VWAP y tendencia para recomendar ajustes al grid.</p>
              <p className="text-muted-foreground mt-1">Se ejecuta cada 30 min o cuando se detecta volatilidad extrema o inactividad prolongada.</p>
              <p className="text-muted-foreground mt-1">Después de 3 recomendaciones consecutivas de reconstruir sin trades, el bot se pausa automáticamente.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        {botStatus === 'paused' && (
          <Badge variant="destructive" className="text-xs animate-pulse">
            BOT PAUSADO
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Sesgo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 cursor-default', bias.color)}>
              <BiasIcon className="h-4 w-4" />
              <div>
                <p className="text-xs text-muted-foreground">Sesgo del mercado</p>
                <p className="font-semibold">{bias.label}</p>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="font-semibold">Sesgo según indicadores técnicos</p>
            <p className="text-muted-foreground">Dirección general del mercado detectada por Claude al analizar indicadores de mediano plazo (RSI, MACD, tendencia de precio).</p>
            <p className="text-muted-foreground mt-1">Difiere del Análisis de Liquidez (que usa order book) — ambos pueden divergir y eso es normal.</p>
          </TooltipContent>
        </Tooltip>

        {/* Acción */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded-lg border border-border/50 px-3 py-2 bg-muted/30 cursor-default">
              <p className="text-xs text-muted-foreground">Última recomendación</p>
              <p className="font-medium text-sm">{actionLabels[layer3LastAction] ?? layer3LastAction}</p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="font-semibold">Acción recomendada por Claude</p>
            <p className="text-muted-foreground"><span className="text-foreground">Mantener:</span> condiciones normales, grid actual es adecuado.</p>
            <p className="text-muted-foreground"><span className="text-foreground">Reconstruir:</span> recrea el grid desde cero con precio y análisis actualizados.</p>
            <p className="text-muted-foreground"><span className="text-foreground">Pausar:</span> condiciones de riesgo alto — el bot se detiene temporalmente.</p>
            <p className="text-muted-foreground"><span className="text-foreground">Desplazar arriba/abajo:</span> el precio se alejó del centro del grid.</p>
            <p className="text-muted-foreground"><span className="text-foreground">Ampliar/Reducir rango:</span> la volatilidad cambió significativamente.</p>
          </TooltipContent>
        </Tooltip>

        {/* Órdenes saltadas */}
        {ordersSkippedToday > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-yellow-600 text-xs cursor-default">
                <AlertTriangle className="h-3 w-3" />
                <span>{ordersSkippedToday} órdenes filtradas hoy</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-semibold">Órdenes bloqueadas por las Capas de análisis</p>
              <p className="text-muted-foreground"><span className="text-foreground">Capa 1:</span> Risk Score bajo (volatilidad extrema, desequilibrio en el libro de órdenes, volumen anómalo).</p>
              <p className="text-muted-foreground"><span className="text-foreground">Capa 2:</span> Probabilidad técnica insuficiente (RSI, MACD, Bollinger no favorables).</p>
              <p className="text-muted-foreground mt-1">Las órdenes filtradas son órdenes que NO se colocaron en Binance para proteger el capital.</p>
            </TooltipContent>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  )
}
