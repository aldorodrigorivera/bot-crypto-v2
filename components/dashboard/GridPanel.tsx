'use client'

import { useBotStore } from '@/store/bot'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Grid3X3, Info } from 'lucide-react'

export function GridPanel() {
  const {
    gridMin, gridMax, gridLevels, gridConfig,
    currentPrice, openOrders,
    liquidityLevelsAbove, liquidityLevelsBelow, liquidityBiasDirection,
  } = useBotStore(useShallow(s => ({
    gridMin: s.gridMin,
    gridMax: s.gridMax,
    gridLevels: s.gridLevels,
    gridConfig: s.gridConfig,
    currentPrice: s.currentPrice,
    openOrders: s.openOrders,
    liquidityLevelsAbove: s.liquidityLevelsAbove,
    liquidityLevelsBelow: s.liquidityLevelsBelow,
    liquidityBiasDirection: s.liquidityBiasDirection,
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-semibold">Estrategia de Grid Trading</p>
              <p className="text-muted-foreground">El bot divide el rango de precios en niveles equidistantes y coloca órdenes de compra (buy) por debajo del precio actual y órdenes de venta (sell) por encima.</p>
              <p className="text-muted-foreground mt-1">Cuando el precio sube y toca un sell, gana la diferencia. Cuando baja y toca un buy, queda listo para vender más arriba.</p>
              <p className="text-muted-foreground mt-1">Con v5 (Liquidity Bias) los niveles se distribuyen asimétricamente según la dirección del mercado.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs cursor-default">
              {cfg.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-semibold">Perfil de configuración</p>
            <p className="text-muted-foreground">Conservador: rango ~6%, separación ~0.5%. Para mercados tranquilos.</p>
            <p className="text-muted-foreground">Balanceado: rango ~8%, separación ~0.6%. Uso general.</p>
            <p className="text-muted-foreground">Agresivo: rango dinámico (hasta 30%), separación mayor. Para alta volatilidad.</p>
          </TooltipContent>
        </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center cursor-default">
                <p className="text-lg font-bold">{gridLevels}</p>
                <p className="text-xs text-muted-foreground">Niveles</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="font-semibold">Niveles del grid</p>
              <p className="text-muted-foreground">Cantidad total de órdenes (compras + ventas) distribuidas en el rango. Más niveles = más oportunidades pero menor ganancia por ciclo.</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center cursor-default">
                <p className="text-lg font-bold">{openOrders}</p>
                <p className="text-xs text-muted-foreground">Órdenes activas</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="font-semibold">Órdenes abiertas en Binance</p>
              <p className="text-muted-foreground">Número de órdenes limit actualmente colocadas en el exchange. Puede ser menor a los niveles si algunas fueron ejecutadas y aún no repuestas.</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center cursor-default">
                <p className="text-lg font-bold">
                  {range > 0 ? ((range / ((gridMin + gridMax) / 2)) * 100).toFixed(1) : '0'}%
                </p>
                <p className="text-xs text-muted-foreground">Rango total</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="font-semibold">Amplitud del grid</p>
              <p className="text-muted-foreground">Porcentaje de precio que cubre el grid de MIN a MAX. Ejemplo: 8% con precio $1.35 = el grid cubre desde ~$1.29 hasta ~$1.41.</p>
              <p className="text-muted-foreground mt-1">Si el precio sale de este rango, el bot activa el stop loss.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Distribución asimétrica v5 */}
        {liquidityBiasDirection !== 'neutral' && liquidityLevelsAbove > 0 && liquidityLevelsBelow > 0 && (
          <div className="pt-2 border-t border-border/50 space-y-1.5">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground font-medium">Distribución del grid (v5)</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="font-semibold">Grid asimétrico (Liquidity Bias v5)</p>
                  <p className="text-muted-foreground">En vez de distribuir niveles 50/50, el bot coloca más órdenes en la dirección donde el análisis de liquidez detecta mayor presión compradora o vendedora.</p>
                  <p className="text-muted-foreground mt-1">Alcista → más compras abajo. Bajista → más ventas arriba.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-red-400 w-14 shrink-0">↑ Ventas</span>
                <div
                  className="h-2 rounded bg-red-500/60"
                  style={{ width: `${(liquidityLevelsAbove / gridLevels) * 100}%` }}
                />
                <span className="text-muted-foreground">{liquidityLevelsAbove}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-400 w-14 shrink-0">↓ Compras</span>
                <div
                  className="h-2 rounded bg-green-500/60"
                  style={{ width: `${(liquidityLevelsBelow / gridLevels) * 100}%` }}
                />
                <span className="text-muted-foreground">{liquidityLevelsBelow}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
