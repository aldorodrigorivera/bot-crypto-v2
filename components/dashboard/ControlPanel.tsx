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
import { Play, Square, RefreshCw, BarChart2, Brain, RotateCcw, Loader2, Wallet, CalendarDays } from 'lucide-react'
import type { StartupPreview } from '@/lib/types'

export function ControlPanel() {
  const { botStatus, isPaused, setBotUSDC, lastSession } = useBotStore(useShallow(s => ({
    botStatus: s.botStatus,
    isPaused: s.isPaused,
    setBotUSDC: s.setBotUSDC,
    lastSession: s.lastSession,
  })))
  const { refetch: refetchStatus } = useStatus()

  const [startOpen, setStartOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [previewData, setPreviewData] = useState<StartupPreview | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<null | 'stop' | 'rebalance'>(null)
  const [loading, setLoading] = useState<string | null>(null)

  // Toast cuando el bot se detiene y hay resumen de sesión
  useEffect(() => {
    if (!lastSession) return
    const { durationMinutes, totalTrades, profitTrades, lossTrades, totalProfitUSDC } = lastSession
    const h = Math.floor(durationMinutes / 60)
    const m = durationMinutes % 60
    const duration = h > 0 ? `${h}h ${m}m` : `${m}m`
    const isProfit = totalProfitUSDC >= 0

    toast[isProfit ? 'success' : 'warning']('Sesión finalizada — todos los trades cerrados', {
      description: `Duración: ${duration} · Trades: ${totalTrades} · ✅ ${profitTrades} con ganancia · ❌ ${lossTrades} con pérdida · Profit: ${isProfit ? '+' : ''}${totalProfitUSDC.toFixed(4)} USDC`,
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

  async function handleStart(opts: { gridLevels: number; gridRangePercent: number }) {
    setLoading('start')
    try {
      await callApi('/api/bot/start', 'POST', opts)
      await refetchStatus()
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

  async function handleRefreshUSDC() {
    setLoading('usdc')
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      if (data.success) {
        const d = data.data as import('@/lib/types').StatusResponse
        const totalUSDC = d.liveBalance?.totalUSDC ?? 0
        const profitUSDC = d.botState?.totalProfitUSDC ?? 0
        const totalLive = totalUSDC + profitUSDC
        const pct = d.activePercent ?? 20
        const botUSDC = totalLive * (pct / 100)
        setBotUSDC(botUSDC)
        toast.success('USDC para Bot actualizado', {
          description: `Total: $${totalLive.toFixed(2)} → Bot (${pct}%): $${botUSDC.toFixed(2)}`,
          position: 'bottom-right',
        })
        await refetchStatus()
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

        {/* Actualizar USDC */}
        <Button
          variant="outline"
          onClick={handleRefreshUSDC}
          disabled={loading !== null}
          className="gap-2"
        >
          {loading === 'usdc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          Actualizar USDC para Bot
        </Button>

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
