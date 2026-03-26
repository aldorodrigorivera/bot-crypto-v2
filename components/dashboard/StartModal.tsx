'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, Brain, TriangleAlert, TrendingUp, TrendingDown, Minus, Activity, BarChart2, DollarSign } from 'lucide-react'
import type { MarketAnalysis, Layer3AgentResponse } from '@/lib/types'

interface StartModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (
    opts: { gridLevels: number; gridRangePercent: number },
    forceStart?: boolean
  ) => Promise<{ ok: boolean; backtestFailed?: boolean; reasons?: string[] }>
  analysis: MarketAnalysis | null
  claudeRecommendation: Layer3AgentResponse | null
  loading?: boolean
  loadingForce?: boolean
}

const BIAS_LABEL: Record<string, string> = {
  bullish: 'Alcista',
  bearish: 'Bajista',
  neutral: 'Neutral',
}

const BIAS_CLASS: Record<string, string> = {
  bullish: 'text-green-500 border-green-500/40',
  bearish: 'text-red-500 border-red-500/40',
  neutral: 'text-yellow-500 border-yellow-500/40',
}

export function StartModal({
  open, onClose, onConfirm, analysis, claudeRecommendation, loading, loadingForce,
}: StartModalProps) {
  // Valores sugeridos por Claude (clamp al rango de los sliders)
  const claudeLevels = claudeRecommendation
    ? Math.min(30, Math.max(4, claudeRecommendation.grid_adjustment.new_levels))
    : null
  const claudeRange = claudeRecommendation
    ? Math.min(20, Math.max(2, claudeRecommendation.grid_adjustment.new_range_percent))
    : null

  const [gridLevels, setGridLevels] = useState(
    claudeLevels ?? analysis?.recommendedConfig.gridLevels ?? 10
  )
  const [gridRange, setGridRange] = useState(
    claudeRange ?? analysis?.recommendedConfig.gridRangePercent ?? 6
  )
  const [starting, setStarting] = useState(false)
  const [backtestError, setBacktestError] = useState<{ reasons: string[] } | null>(null)

  // Limpiar error al abrir/cerrar modal
  useEffect(() => {
    if (!open) setBacktestError(null)
  }, [open])

  // Actualizar sliders cuando llega el análisis (modal abre antes que los datos)
  useEffect(() => {
    if (!analysis) return
    setGridLevels(claudeLevels ?? analysis.recommendedConfig.gridLevels)
    setGridRange(claudeRange ?? analysis.recommendedConfig.gridRangePercent)
  }, [analysis, claudeRecommendation]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm(forceStart = false) {
    setStarting(true)
    setBacktestError(null)
    try {
      const result = await onConfirm({ gridLevels, gridRangePercent: gridRange }, forceStart)
      if (result.ok) {
        onClose()
      } else if (result.backtestFailed) {
        setBacktestError({ reasons: result.reasons ?? [] })
      }
    } finally {
      setStarting(false)
    }
  }

  const levelsModified = claudeLevels !== null && gridLevels !== claudeLevels
  const rangeModified = claudeRange !== null && gridRange !== claudeRange

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-green-500" />
            Iniciar Bot de Trading
          </DialogTitle>
          <DialogDescription>
            Ajusta el grid antes de iniciar. Los valores de los sliders están pre-cargados con la recomendación de Claude AI.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Analizando mercado con Claude AI...</span>
          </div>
        ) : analysis ? (
          <div className="space-y-4">

            {/* Tarjeta Claude AI */}
            {claudeRecommendation && (
              <div className="rounded-lg border border-blue-500/30 p-3 bg-blue-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Brain className="h-4 w-4 text-blue-400" />
                    <p className="text-sm font-medium">Claude AI</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={BIAS_CLASS[claudeRecommendation.market_bias]}
                    >
                      {BIAS_LABEL[claudeRecommendation.market_bias]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {claudeRecommendation.confidence}% confianza
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {claudeRecommendation.reasoning}
                </p>
                {claudeRecommendation.risk_flags.length > 0 && (
                  <div className="pt-0.5 space-y-1">
                    {claudeRecommendation.risk_flags.map((flag, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <TriangleAlert className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">{flag}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Análisis de mercado base */}
            <div className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
                <p className="text-sm font-medium">Condiciones de mercado</p>
                <Badge variant="outline">{analysis.recommendedConfig.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground px-3 py-2 border-b border-border/30">
                {analysis.configReason}
              </p>

              <div className="divide-y divide-border/30">
                {/* Precio */}
                <div className="flex items-start gap-2 px-3 py-2">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Precio</span>
                      <span className={`text-xs font-semibold ${analysis.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {analysis.priceChange24h >= 0 ? '+' : ''}{analysis.priceChange24h.toFixed(2)}% 24h
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Rango 24h: ${analysis.price24hLow.toFixed(4)} – ${analysis.price24hHigh.toFixed(4)}.{' '}
                      {analysis.priceChange24h >= 1 ? 'El precio sube con fuerza — bueno para sells del grid.' :
                       analysis.priceChange24h <= -1 ? 'El precio cae — más oportunidades de compra en el grid.' :
                       'Precio lateral — condición ideal para grid trading.'}
                    </p>
                  </div>
                </div>

                {/* Volatilidad */}
                <div className="flex items-start gap-2 px-3 py-2">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Volatilidad 24h</span>
                      <span className={`text-xs font-semibold ${
                        analysis.volatility24h > 15 ? 'text-red-500' :
                        analysis.volatility24h > 6 ? 'text-yellow-500' : 'text-green-500'
                      }`}>{analysis.volatility24h.toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {analysis.volatility24h > 15
                        ? `Volatilidad extrema — el precio puede moverse más del ${analysis.volatility24h.toFixed(0)}% en un día. El grid estrecho (${analysis.recommendedConfig.gridRangePercent}%) reduce el riesgo de que el precio escape del rango.`
                        : analysis.volatility24h > 6
                        ? `Volatilidad alta — el precio se mueve activamente, generando más fills pero también más riesgo de slippage.`
                        : `Volatilidad baja — mercado lateral, ideal para grid. Pocos fills pero alta precisión.`}
                    </p>
                  </div>
                </div>

                {/* Tendencia */}
                <div className="flex items-start gap-2 px-3 py-2">
                  {analysis.trend === 'bullish'
                    ? <TrendingUp className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                    : analysis.trend === 'bearish'
                    ? <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    : <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Tendencia</span>
                      <span className={`text-xs font-semibold capitalize ${
                        analysis.trend === 'bullish' ? 'text-green-500' :
                        analysis.trend === 'bearish' ? 'text-red-500' : 'text-muted-foreground'
                      }`}>{analysis.trend === 'bullish' ? 'Alcista' : analysis.trend === 'bearish' ? 'Bajista' : 'Lateral'} · {analysis.trendStrength}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      MA20: {analysis.priceVsMA20 >= 0 ? '+' : ''}{analysis.priceVsMA20.toFixed(2)}% · MA50: {analysis.priceVsMA50 >= 0 ? '+' : ''}{analysis.priceVsMA50.toFixed(2)}%.{' '}
                      {Math.abs(analysis.priceVsMA20) < 1 && Math.abs(analysis.priceVsMA50) < 1
                        ? 'Precio cerca de sus medias — zona neutral, grid funciona bien en ambas direcciones.'
                        : analysis.priceVsMA20 < -2
                        ? 'Precio bajo sus medias móviles — presión bajista. El bot comprará más barato si el precio cae.'
                        : 'Precio sobre sus medias móviles — momentum positivo. Sells del grid se ejecutarán con más frecuencia.'}
                    </p>
                  </div>
                </div>

                {/* Volumen */}
                <div className="flex items-start gap-2 px-3 py-2">
                  <BarChart2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Volumen 24h</span>
                      <span className={`text-xs font-semibold ${analysis.volumeChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {analysis.volumeChange >= 0 ? '+' : ''}{analysis.volumeChange.toFixed(0)}% vs promedio
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(analysis.volume24h / 1_000_000).toFixed(2)}M XRP negociados.{' '}
                      {analysis.volumeChange > 20
                        ? 'Volumen elevado — alta liquidez, fills rápidos y con poco slippage.'
                        : analysis.volumeChange < -20
                        ? 'Volumen bajo — poca liquidez, las órdenes tardan más en llenarse. Considera tamaños de orden más pequeños.'
                        : 'Volumen normal — condiciones típicas de mercado.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Slider: Niveles del Grid */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">Niveles del Grid</span>
                <div className="flex items-center gap-1.5">
                  {claudeLevels !== null && (
                    <span className="text-xs text-blue-400">
                      Claude: {claudeLevels}
                    </span>
                  )}
                  <Badge
                    variant="secondary"
                    className={levelsModified ? 'text-amber-500 border-amber-500/40' : ''}
                  >
                    {gridLevels}{levelsModified ? ' ✎' : ''}
                  </Badge>
                </div>
              </div>
              <Slider
                value={gridLevels}
                onValueChange={(v) => setGridLevels(Array.isArray(v) ? v[0] : v)}
                min={4}
                max={30}
                step={2}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>4</span>
                {claudeLevels !== null ? (
                  <span className="text-blue-400">
                    ▲ Claude sugiere {claudeLevels} niveles
                  </span>
                ) : null}
                <span>30</span>
              </div>
            </div>

            {/* Slider: Rango del Grid */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">Rango del Grid</span>
                <div className="flex items-center gap-1.5">
                  {claudeRange !== null && (
                    <span className="text-xs text-blue-400">
                      Claude: {claudeRange}%
                    </span>
                  )}
                  <Badge
                    variant="secondary"
                    className={rangeModified ? 'text-amber-500 border-amber-500/40' : ''}
                  >
                    {gridRange}%{rangeModified ? ' ✎' : ''}
                  </Badge>
                </div>
              </div>
              <Slider
                value={gridRange}
                onValueChange={(v) => setGridRange(Array.isArray(v) ? v[0] : v)}
                min={2}
                max={20}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>2%</span>
                {claudeRange !== null ? (
                  <span className="text-blue-400">
                    ▲ Claude sugiere {claudeRange}%
                  </span>
                ) : null}
                <span>20%</span>
              </div>
            </div>

          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay análisis disponible. El bot usará la configuración por defecto.
          </p>
        )}

        {backtestError && (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <TriangleAlert className="h-4 w-4 text-yellow-500 shrink-0" />
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Backtest no aprobado</p>
            </div>
            <ul className="text-xs text-yellow-600 dark:text-yellow-400 list-disc list-inside space-y-0.5">
              {backtestError.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose} disabled={starting || loadingForce}>
            Cancelar
          </Button>
          {backtestError && (
            <Button
              variant="outline"
              onClick={() => handleConfirm(true)}
              disabled={starting || loadingForce}
              className="gap-2 text-yellow-600 border-yellow-500/40 hover:bg-yellow-500/10"
            >
              {(starting || loadingForce) ? <Loader2 className="h-4 w-4 animate-spin" /> : <TriangleAlert className="h-4 w-4" />}
              Forzar Inicio
            </Button>
          )}
          <Button onClick={() => handleConfirm(false)} disabled={starting || loadingForce} className="gap-2">
            {(starting || loadingForce) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {starting ? 'Iniciando...' : 'Iniciar Bot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
