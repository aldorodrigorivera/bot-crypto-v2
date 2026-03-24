'use client'

import { useBotStore } from '@/store/bot'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Grid3X3 } from 'lucide-react'

export function GridPanel() {
  const {
    gridMin, gridMax, gridLevels, gridConfig,
    currentPrice, openOrders,
  } = useBotStore(useShallow(s => ({
    gridMin: s.gridMin,
    gridMax: s.gridMax,
    gridLevels: s.gridLevels,
    gridConfig: s.gridConfig,
    currentPrice: s.currentPrice,
    openOrders: s.openOrders,
  })))

  const range = gridMax - gridMin
  const priceProgress = range > 0
    ? Math.min(100, Math.max(0, ((currentPrice - gridMin) / range) * 100))
    : 50

  const configs: Record<string, { label: string; color: string }> = {
    conservative: { label: 'Conservador', color: 'bg-green-500' },
    balanced: { label: 'Balanceado', color: 'bg-yellow-500' },
    aggressive: { label: 'Agresivo', color: 'bg-red-500' },
  }

  const cfg = configs[gridConfig] ?? configs.balanced

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Grid3X3 className="h-4 w-4" />
          Panel del Grid
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {cfg.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rango */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>MIN: ${gridMin.toFixed(4)}</span>
            <span className="font-semibold text-foreground">${currentPrice.toFixed(4)}</span>
            <span>MAX: ${gridMax.toFixed(4)}</span>
          </div>
          <Progress value={priceProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>{priceProgress.toFixed(1)}% del rango</span>
            <span>100%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
          <div className="text-center">
            <p className="text-lg font-bold">{gridLevels}</p>
            <p className="text-xs text-muted-foreground">Niveles</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{openOrders}</p>
            <p className="text-xs text-muted-foreground">Órdenes activas</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">
              {range > 0 ? ((range / ((gridMin + gridMax) / 2)) * 100).toFixed(1) : '0'}%
            </p>
            <p className="text-xs text-muted-foreground">Rango total</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
