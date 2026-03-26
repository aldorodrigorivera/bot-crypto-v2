'use client'

import { useMarketAnalysis } from '@/hooks/useDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { BarChart2, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketAnalysis } from '@/lib/types'

export function MarketPanel() {
  const { data: raw, isLoading } = useMarketAnalysis()
  const analysis = raw as MarketAnalysis | null

  const trendConfig = {
    bullish: { label: 'Alcista', icon: TrendingUp, color: 'text-green-500' },
    bearish: { label: 'Bajista', icon: TrendingDown, color: 'text-red-500' },
    sideways: { label: 'Lateral', icon: Minus, color: 'text-yellow-500' },
  }

  const trend = analysis ? (trendConfig[analysis.trend] ?? trendConfig.sideways) : null
  const TrendIcon = trend?.icon ?? Minus

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart2 className="h-4 w-4" />
          Análisis de Mercado
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-semibold">Análisis técnico del mercado</p>
              <p className="text-muted-foreground">Resumen calculado al arrancar el bot usando datos de las últimas 24h: tendencia de precio, volatilidad y cambio porcentual.</p>
              <p className="text-muted-foreground mt-1">El badge (Conservador/Balanceado/Agresivo) indica qué configuración de grid se seleccionó automáticamente para las condiciones actuales.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        {analysis && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs cursor-default">
                {analysis.recommendedConfig.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="font-semibold">Config recomendada</p>
              <p className="text-muted-foreground">{analysis.configReason}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </CardHeader>
      <CardContent>
        {isLoading || !analysis ? (
          <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
            {isLoading ? 'Cargando...' : 'Sin análisis disponible'}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {/* Tendencia */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="rounded-lg border border-border/50 p-2 text-center bg-muted/30 cursor-default">
                    <TrendIcon className={cn('h-4 w-4 mx-auto mb-1', trend?.color)} />
                    <p className="text-xs text-muted-foreground">Tendencia</p>
                    <p className={cn('text-sm font-semibold', trend?.color)}>
                      {trend?.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{analysis.trendStrength}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-semibold">Tendencia de precio</p>
                  <p className="text-muted-foreground">Dirección general del precio en las últimas 24h calculada a partir del cierre de las velas. Intensidad: weak / moderate / strong.</p>
                  <p className="text-muted-foreground mt-1">Alcista: precio subiendo. Bajista: precio bajando. Lateral: sin dirección clara.</p>
                </TooltipContent>
              </Tooltip>

              {/* Volatilidad */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="rounded-lg border border-border/50 p-2 text-center bg-muted/30 cursor-default">
                    <p className="text-lg font-bold tabular-nums">
                      {analysis.volatility24h.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Volatilidad 24h</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-semibold">Volatilidad de precio en 24 horas</p>
                  <p className="text-muted-foreground">Rango relativo entre el máximo y mínimo del día: <span className="text-foreground font-mono">(max - min) / precio</span>.</p>
                  <p className="text-muted-foreground mt-1">&lt;5%: baja · 5–15%: normal · &gt;15%: alta (activa rango dinámico) · &gt;30%: extrema.</p>
                  <p className="text-muted-foreground mt-1">Con volatilidad &gt;15%, el rango del grid se calcula como movimiento diario típico × 1.2 para evitar que el precio salga del grid.</p>
                </TooltipContent>
              </Tooltip>

              {/* Cambio 24h */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="rounded-lg border border-border/50 p-2 text-center bg-muted/30 cursor-default">
                    <p className={cn(
                      'text-lg font-bold tabular-nums',
                      analysis.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {analysis.priceChange24h >= 0 ? '+' : ''}{analysis.priceChange24h.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Cambio 24h</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-semibold">Cambio porcentual en 24 horas</p>
                  <p className="text-muted-foreground">Variación del precio desde hace exactamente 24 horas hasta ahora. Verde = subida, Rojo = bajada.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Config reason */}
            <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
              {analysis.configReason}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
