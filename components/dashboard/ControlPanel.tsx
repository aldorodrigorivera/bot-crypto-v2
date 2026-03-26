'use client'

import { useEffect, useState } from 'react'
import { useBotStore } from '@/store/bot'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { StartModal } from './StartModal'
import { SessionsModal } from './SessionsModal'
import { useStatus } from '@/hooks/useDashboard'
import { toast } from 'sonner'
import { Play, Square, RefreshCw, BarChart2, Brain, RotateCcw, Loader2, CalendarDays, FileText, AlertCircle, X, Trash2, Bell } from 'lucide-react'
import type { StartupPreview } from '@/lib/types'

export function ControlPanel() {
  const { botStatus, isPaused, lastSession, riskAlerts, clearRiskAlerts, dismissRiskAlert } = useBotStore(useShallow(s => ({
    botStatus: s.botStatus,
    isPaused: s.isPaused,
    lastSession: s.lastSession,
    riskAlerts: s.riskAlerts,
    clearRiskAlerts: s.clearRiskAlerts,
    dismissRiskAlert: s.dismissRiskAlert,
  })))
  const { refetch: refetchStatus } = useStatus()

  const [startOpen, setStartOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [previewData, setPreviewData] = useState<StartupPreview | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<null | 'stop' | 'rebalance' | 'cancel-all'>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [sessionReportError, setSessionReportError] = useState<string | null>(null)

  // Toast cuando el bot se detiene y hay resumen de sesión
  useEffect(() => {
    if (!lastSession) return
    const { durationMinutes, totalTrades, profitTrades, lossTrades, totalProfitUSDC } = lastSession
    const h = Math.floor(durationMinutes / 60)
    const m = durationMinutes % 60
    const duration = h > 0 ? `${h}h ${m}m` : `${m}m`
    const isProfit = totalProfitUSDC >= 0

    toast[isProfit ? 'success' : 'warning']('Sesión finalizada — todos los trades cerrados', {
      description: `Duración: ${duration} · Trades: ${totalTrades} · ✅ ${profitTrades} con ganancia · ❌ ${lossTrades} con pérdida · Profit: ${isProfit ? '+' : ''}${totalProfitUSDC.toFixed(4)} USDT`,
      position: 'bottom-right',
      duration: 12000,
    })
  }, [lastSession])

  async function callApi(endpoint: string, method = 'POST', body?: object) {
    const res = await fetch(endpoint, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }

  async function handleOpenStartModal() {
    setPreviewData(null)
    setStartOpen(true)
    setLoading('preview')
    try {
      const res = await callApi('/api/bot/preview', 'GET')
      if (res.success) setPreviewData(res.data as StartupPreview)
    } finally {
      setLoading(null)
    }
  }

  async function handleStart(
    opts: { gridLevels: number; gridRangePercent: number },
    forceStart = false
  ): Promise<{ ok: boolean; backtestFailed?: boolean; reasons?: string[] }> {
    setLoading('start')
    try {
      const res = await callApi('/api/bot/start', 'POST', {
        ...opts,
        analysis: previewData?.analysis ?? null,
        claudeRecommendation: previewData?.claudeRecommendation ?? null,
        forceStart,
      })
      if (!res.success) {
        if (res.data?.backtestFailed) {
          return { ok: false, backtestFailed: true, reasons: res.data.failedReasons }
        }
        toast.error('Error iniciando el bot', { description: res.error, position: 'bottom-right' })
        return { ok: false }
      }
      await refetchStatus()
      return { ok: true }
    } finally {
      setLoading(null)
    }
  }

  async function handleStop() {
    setConfirmDialog(null)
    setLoading('stop')
    try {
      await callApi('/api/bot/stop')
      await refetchStatus()
    } finally {
      setLoading(null)
    }
  }

  async function handleRebalance() {
    setConfirmDialog(null)
    setLoading('rebalance')
    try {
      await callApi('/api/bot/rebalance')
      await refetchStatus()
    } finally {
      setLoading(null)
    }
  }

  async function handleAnalyze() {
    setLoading('analyze')
    try {
      await callApi('/api/bot/analyze')
      await refetchStatus()
    } finally {
      setLoading(null)
    }
  }

  async function handleAgent() {
    setLoading('agent')
    try {
      await callApi('/api/bot/agent/trigger')
    } finally {
      setLoading(null)
    }
  }

  async function handleGenerateReport() {
    setSessionReportError(null)
    setLoading('report')
    try {
      const res = await callApi('/api/bot/session-report')
      if (res.success) {
        toast.success('Reporte de sesión generado', {
          description: 'El reporte fue guardado en docs/sessions/',
          position: 'bottom-right',
        })
      } else {
        setSessionReportError(res.error ?? 'Error generando el reporte de sesión')
      }
    } catch {
      setSessionReportError('Error de conexión al generar el reporte')
    } finally {
      setLoading(null)
    }
  }

  async function handleCancelAll() {
    setConfirmDialog(null)
    setLoading('cancel-all')
    try {
      const res = await callApi('/api/bot/cancel-all')
      if (res.success) {
        toast.success(`Órdenes canceladas en Binance`, {
          description: res.data?.message,
          position: 'bottom-right',
        })
        await refetchStatus()
      } else {
        toast.error('Error cancelando órdenes', { description: res.error, position: 'bottom-right' })
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleResume() {
    setLoading('resume')
    try {
      await callApi('/api/bot/resume')
      await refetchStatus()
    } finally {
      setLoading(null)
    }
  }

  const isRunning = botStatus === 'running'
  const isStopped = botStatus === 'stopped'

  return (
    <>
      {sessionReportError && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{sessionReportError}</span>
          <button onClick={() => setSessionReportError(null)} className="shrink-0 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {/* Iniciar */}
        {(isStopped || botStatus === 'loading') && (
          <Button
            onClick={handleOpenStartModal}
            disabled={loading !== null}
            className="gap-2"
          >
            {loading === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Iniciar Bot
          </Button>
        )}

        {/* Detener */}
        {isRunning && (
          <Button
            variant="destructive"
            onClick={() => setConfirmDialog('stop')}
            disabled={loading !== null}
            className="gap-2"
          >
            {loading === 'stop' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            Detener Bot
          </Button>
        )}

        {/* Reanudar */}
        {isPaused && (
          <Button
            variant="outline"
            onClick={handleResume}
            disabled={loading !== null}
            className="gap-2 text-green-600 border-green-600/30 hover:bg-green-500/10"
          >
            {loading === 'resume' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Reanudar
          </Button>
        )}

        {/* Rebalancear */}
        {isRunning && (
          <Button
            variant="outline"
            onClick={() => setConfirmDialog('rebalance')}
            disabled={loading !== null}
            className="gap-2"
          >
            {loading === 'rebalance' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Rebalancear
          </Button>
        )}

        {/* Analizar */}
        <Button
          variant="outline"
          onClick={handleAnalyze}
          disabled={loading !== null}
          className="gap-2"
        >
          {loading === 'analyze' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
          Analizar
        </Button>

        {/* Agente */}
        <Button
          variant="outline"
          onClick={handleAgent}
          disabled={loading !== null}
          className="gap-2"
        >
          {loading === 'agent' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          Consultar Agente
        </Button>

        {/* Generar reporte */}
        {isStopped && (
          <Button
            variant="outline"
            onClick={handleGenerateReport}
            disabled={loading !== null}
            className="gap-2"
          >
            {loading === 'report' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generar reporte de sesión
          </Button>
        )}

        {/* Cancelar todas las órdenes en Binance */}
        {isStopped && (
          <Button
            variant="outline"
            onClick={() => setConfirmDialog('cancel-all')}
            disabled={loading !== null}
            className="gap-2 text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
          >
            {loading === 'cancel-all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Cancelar órdenes Binance
          </Button>
        )}

        {/* Ver Sesiones */}
        <Button
          variant="outline"
          onClick={() => setSessionsOpen(true)}
          disabled={loading !== null}
          className="gap-2"
        >
          <CalendarDays className="h-4 w-4" />
          Ver Sesiones
        </Button>
      </div>

      {/* Modal sesiones */}
      <SessionsModal open={sessionsOpen} onClose={() => setSessionsOpen(false)} />

      {/* Modal inicio — se abre de inmediato con spinner mientras carga el análisis */}
      <StartModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onConfirm={handleStart}
        analysis={previewData?.analysis ?? null}
        claudeRecommendation={previewData?.claudeRecommendation ?? null}
        loading={loading === 'preview'}
        loadingForce={loading === 'start'}
      />

      {/* Confirm stop */}
      <Dialog open={confirmDialog === 'stop'} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detener Bot</DialogTitle>
            <DialogDescription>
              Se detendrá el bot y se cancelarán todas las órdenes abiertas en Binance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleStop}>Confirmar Detención</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm cancel-all */}
      <Dialog open={confirmDialog === 'cancel-all'} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar todas las órdenes</DialogTitle>
            <DialogDescription>
              Se cancelarán TODAS las órdenes abiertas en Binance para XRP/USDT, incluyendo las de sesiones anteriores. Esto libera el USDT bloqueado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleCancelAll}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Panel de alertas de riesgo */}
      {riskAlerts.length > 0 && (
        <div className="mt-4 rounded-md border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-500/20">
            <div className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                Alertas del sistema ({riskAlerts.length})
              </span>
            </div>
            <button
              onClick={clearRiskAlerts}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpiar todo
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-yellow-500/10">
            {riskAlerts.map(alert => (
              <div key={alert.id} className="flex items-start gap-2 px-3 py-2 hover:bg-yellow-500/5 group">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 leading-relaxed wrap-break-word">
                    {alert.message}
                  </p>
                  {alert.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => dismissRiskAlert(alert.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm rebalance */}
      <Dialog open={confirmDialog === 'rebalance'} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rebalancear Grid</DialogTitle>
            <DialogDescription>
              Se detendrá el bot y se reiniciará con análisis de mercado actualizado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button onClick={handleRebalance}>Confirmar Rebalanceo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
