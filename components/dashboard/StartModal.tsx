'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, Brain, TriangleAlert } from 'lucide-react'
import type { MarketAnalysis, Layer3AgentResponse } from '@/lib/types'

interface StartModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (opts: { gridLevels: number; gridRangePercent: number }) => Promise<void>
  analysis: MarketAnalysis | null
  claudeRecommendation: Layer3AgentResponse | null
  loading?: boolean
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
  open, onClose, onConfirm, analysis, claudeRecommendation, loading,
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

  // Actualizar sliders cuando llega el análisis (modal abre antes que los datos)
  useEffect(() => {
    if (!analysis) return
    setGridLevels(claudeLevels ?? analysis.recommendedConfig.gridLevels)
    setGridRange(claudeRange ?? analysis.recommendedConfig.gridRangePercent)
  }, [analysis, claudeRecommendation]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm() {
    setStarting(true)
    try {
      await onConfirm({ gridLevels, gridRangePercent: gridRange })
      onClose()
    } finally {
      setStarting(false)
    }
  }

  const levelsModified = claudeLevels !== null && gridLevels !== claudeLevels
  const rangeModified = claudeRange !== null && gridRange !== claudeRange

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
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
                  <div className="flex items-start gap-1.5 pt-0.5">
                    <TriangleAlert className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      {claudeRecommendation.risk_flags.join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Análisis de mercado base */}
            <div className="rounded-lg border border-border/50 p-3 bg-muted/30 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Análisis de mercado</p>
                <Badge variant="outline">{analysis.recommendedConfig.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{analysis.configReason}</p>
              <div className="flex gap-3 pt-1 text-xs">
                <span className="text-muted-foreground">
                  Volatilidad: <strong className="text-foreground">{analysis.volatility24h.toFixed(1)}%</strong>
                </span>
                <span className="text-muted-foreground">
                  Tendencia: <strong className="text-foreground">{analysis.trend}</strong>
                </span>
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={starting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={starting} className="gap-2">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {starting ? 'Iniciando...' : 'Iniciar Bot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
