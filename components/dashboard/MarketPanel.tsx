'use client'

import { useMarketAnalysis } from '@/hooks/useDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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
        </CardTitle>
        {analysis && (
          <Badge variant="outline" className="text-xs">
            {analysis.recommendedConfig.label}
          </Badge>
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
              <div className="rounded-lg border border-border/50 p-2 text-center bg-muted/30">
                <TrendIcon className={cn('h-4 w-4 mx-auto mb-1', trend?.color)} />
                <p className="text-xs text-muted-foreground">Tendencia</p>
                <p className={cn('text-sm font-semibold', trend?.color)}>
                  {trend?.label}
                </p>
                <p className="text-xs text-muted-foreground">{analysis.trendStrength}</p>
              </div>

              {/* Volatilidad */}
              <div className="rounded-lg border border-border/50 p-2 text-center bg-muted/30">
                <p className="text-lg font-bold tabular-nums">
                  {analysis.volatility24h.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Volatilidad 24h</p>
              </div>

              {/* Cambio 24h */}
              <div className="rounded-lg border border-border/50 p-2 text-center bg-muted/30">
                <p className={cn(
                  'text-lg font-bold tabular-nums',
                  analysis.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
                )}>
                  {analysis.priceChange24h >= 0 ? '+' : ''}{analysis.priceChange24h.toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground">Cambio 24h</p>
              </div>
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
