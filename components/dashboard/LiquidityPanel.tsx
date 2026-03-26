'use client'

import { useBotStore } from '@/store/bot'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Droplets, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

function BiasIcon({ direction }: { direction: 'bullish' | 'bearish' | 'neutral' }) {
  if (direction === 'bullish') return <TrendingUp className="h-3.5 w-3.5 text-green-500" />
  if (direction === 'bearish') return <TrendingDown className="h-3.5 w-3.5 text-red-400" />
  return <Minus className="h-3.5 w-3.5 text-yellow-500" />
}

function StrengthBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
    </div>
  )
}

export function LiquidityPanel() {
  const {
    liquidityBiasDirection,
    liquidityBiasStrength,
    liquidityConfidence,
    liquidityLevelsAbove,
    liquidityLevelsBelow,
    liquidityLastAnalysis,
    liquidityOverrideActive,
    liquidityOverrideReason,
    liquiditySummary,
  } = useBotStore(useShallow(s => ({
    liquidityBiasDirection: s.liquidityBiasDirection,
    liquidityBiasStrength: s.liquidityBiasStrength,
    liquidityConfidence: s.liquidityConfidence,
    liquidityLevelsAbove: s.liquidityLevelsAbove,
    liquidityLevelsBelow: s.liquidityLevelsBelow,
    liquidityLastAnalysis: s.liquidityLastAnalysis,
    liquidityOverrideActive: s.liquidityOverrideActive,
    liquidityOverrideReason: s.liquidityOverrideReason,
    liquiditySummary: s.liquiditySummary,
  })))

  const [loading, setLoading] = useState(false)

  const hasData = liquidityLastAnalysis !== null

  const timeAgo = liquidityLastAnalysis
    ? (() => {
        const mins = Math.floor((Date.now() - liquidityLastAnalysis) / 60_000)
        if (mins < 1) return 'hace <1min'
        if (mins < 60) return `hace ${mins}min`
        return `hace ${Math.floor(mins / 60)}h`
      })()
    : null

  async function handleReanalyze() {
    setLoading(true)
    try {
      await fetch('/api/liquidity/analyze', { method: 'POST' })
    } finally {
      setLoading(false)
    }
  }

  const biasColor = liquidityBiasDirection === 'bullish' ? 'text-green-500'
    : liquidityBiasDirection === 'bearish' ? 'text-red-400'
    : 'text-yellow-500'

  const biasBarColor = liquidityBiasDirection === 'bullish' ? 'bg-green-500'
    : liquidityBiasDirection === 'bearish' ? 'bg-red-500'
    : 'bg-yellow-500'

  const biasLabel = liquidityBiasDirection === 'bullish' ? 'ALCISTA'
    : liquidityBiasDirection === 'bearish' ? 'BAJISTA'
    : 'NEUTRAL'

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-400" />
            Análisis de Liquidez
            {timeAgo && (
              <span className="text-xs text-muted-foreground font-normal">{timeAgo}</span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-semibold">Análisis de liquidez (v5)</p>
                <p className="text-muted-foreground">Combina 4 señales de flujo de mercado para calcular el sesgo del grid:</p>
                <p className="text-muted-foreground mt-1"><span className="text-foreground">OBI (40%):</span> Desequilibrio entre órdenes de compra y venta en el book. Ratio &gt;1 = más bids (alcista).</p>
                <p className="text-muted-foreground"><span className="text-foreground">CVD (35%):</span> Delta acumulado de volumen — compras de mercado vs ventas de mercado en los últimos 500 trades.</p>
                <p className="text-muted-foreground"><span className="text-foreground">Liquidez (25%):</span> Zonas de soporte/resistencia detectadas en el order book profundo.</p>
                <p className="text-muted-foreground"><span className="text-foreground">Funding Rate:</span> Override si la tasa de financiamiento perpetuo supera ±0.05%.</p>
                <p className="text-muted-foreground mt-1">Se re-analiza automáticamente cada 2 horas o con el botón Re-analizar.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleReanalyze}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3 w-3 mr-1', loading && 'animate-spin')} />
            Re-analizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!hasData ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Sin datos — el análisis se ejecuta al arrancar el bot
          </p>
        ) : (
          <>
            {/* Sesgo resultante */}
            <div className={cn(
              'rounded-md border px-3 py-2 space-y-1.5',
              liquidityBiasDirection === 'bullish' ? 'border-green-500/20 bg-green-500/5'
                : liquidityBiasDirection === 'bearish' ? 'border-red-500/20 bg-red-500/5'
                : 'border-yellow-500/20 bg-yellow-500/5'
            )}>
              <div className="flex items-center justify-between">
                <div className={cn('flex items-center gap-1.5 font-semibold text-sm', biasColor)}>
                  <BiasIcon direction={liquidityBiasDirection} />
                  {biasLabel}
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-default">{liquidityConfidence}% confianza</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-semibold">Confianza del sesgo</p>
                      <p className="text-muted-foreground">Porcentaje de señales (OBI, CVD, Liquidez) que apuntan en la misma dirección.</p>
                      <p className="text-muted-foreground mt-1">100% = las 3 señales coinciden. 33% = solo 1 de 3 señales alineada.</p>
                      <p className="text-muted-foreground">Si la confianza es baja, el grid se construye simétricamente.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={cn('text-xs cursor-default', biasColor)}>
                        {liquidityBiasStrength}/100
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-semibold">Fuerza del sesgo</p>
                      <p className="text-muted-foreground">Intensidad de la señal combinada de 0 a 100. El grid solo se vuelve asimétrico si la fuerza supera 20.</p>
                      <p className="text-muted-foreground mt-1">&lt;20: grid simétrico (50/50). 20–50: leve asimetría. &gt;50: asimetría pronunciada.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <StrengthBar value={liquidityBiasStrength} color={biasBarColor} />
            </div>

            {/* Override activo */}
            {liquidityOverrideActive && liquidityOverrideReason && (
              <div className="flex items-start gap-2 rounded-md border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-300">{liquidityOverrideReason}</p>
              </div>
            )}

            {/* Distribución de niveles */}
            {liquidityLevelsAbove > 0 && liquidityLevelsBelow > 0 && (
              <div className="rounded-md border border-border/40 px-3 py-2 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Grid asimétrico</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-400 w-20 shrink-0">↑ {liquidityLevelsAbove} ventas</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500/60"
                        style={{ width: `${(liquidityLevelsAbove / (liquidityLevelsAbove + liquidityLevelsBelow)) * 100}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground text-right w-8">
                      {Math.round(liquidityLevelsAbove / (liquidityLevelsAbove + liquidityLevelsBelow) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-400 w-20 shrink-0">↓ {liquidityLevelsBelow} compras</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500/60"
                        style={{ width: `${(liquidityLevelsBelow / (liquidityLevelsAbove + liquidityLevelsBelow)) * 100}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground text-right w-8">
                      {Math.round(liquidityLevelsBelow / (liquidityLevelsAbove + liquidityLevelsBelow) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Resumen */}
            {liquiditySummary && (
              <p className="text-xs text-muted-foreground leading-relaxed px-1">
                {liquiditySummary}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
