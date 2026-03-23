'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, TrendingUp } from 'lucide-react'
import type { MarketAnalysis } from '@/lib/types'

interface StartModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (opts: { gridLevels: number; gridRangePercent: number }) => Promise<void>
  analysis: MarketAnalysis | null
  loading?: boolean
}

export function StartModal({ open, onClose, onConfirm, analysis, loading }: StartModalProps) {
  const [gridLevels, setGridLevels] = useState(analysis?.recommendedConfig.gridLevels ?? 10)
  const [gridRange, setGridRange] = useState(analysis?.recommendedConfig.gridRangePercent ?? 6)
  const [starting, setStarting] = useState(false)

  async function handleConfirm() {
    setStarting(true)
    try {
      await onConfirm({ gridLevels, gridRangePercent: gridRange })
      onClose()
    } finally {
      setStarting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-green-500" />
            Iniciar Bot de Trading
          </DialogTitle>
          <DialogDescription>
            Configura el grid antes de iniciar. Los valores recomendados se basan en el análisis de mercado actual.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analizando mercado...
          </div>
        ) : analysis ? (
          <div className="space-y-5">
            {/* Config recomendada */}
            <div className="rounded-lg border border-border/50 p-3 bg-muted/30 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Configuración recomendada</p>
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

            {/* Grid Levels */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Niveles del Grid</span>
                <Badge variant="secondary">{gridLevels}</Badge>
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
                <span>4 (mínimo)</span>
                <span>30 (máximo)</span>
              </div>
            </div>

            {/* Grid Range */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Rango del Grid</span>
                <Badge variant="secondary">{gridRange}%</Badge>
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
