'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { TradingSession } from '@/lib/types'

const STOP_REASON_LABELS: Record<string, string> = {
  manual: 'Manual',
  stop_loss_range: 'Stop Loss (Rango)',
  stop_loss_global: 'Stop Loss (Global)',
  daily_limit: 'Límite Diario',
  error: 'Error',
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  open: boolean
  onClose: () => void
}

export function SessionsModal({ open, onClose }: Props) {
  const [sessions, setSessions] = useState<TradingSession[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/sessions?days=7')
      .then(r => r.json())
      .then(res => {
        if (res.success) setSessions(res.data as TradingSession[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  const totalProfit = sessions.reduce((acc, s) => acc + s.totalProfitUSDC, 0)
  const totalTrades = sessions.reduce((acc, s) => acc + s.totalTrades, 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-225 max-h-[82vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sesiones de Trading — Últimos 7 días</DialogTitle>
          <DialogDescription>
            Resumen de cada sesión con ganancias, duración y trades ejecutados.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">
            No hay sesiones registradas en los últimos 7 días.
          </p>
        ) : (
          <>
            {/* Resumen agregado */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Sesiones</p>
                <p className="text-xl font-bold">{sessions.length}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Trades</p>
                <p className="text-xl font-bold">{totalTrades}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Ganancia 7 días</p>
                <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(4)} USDC
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead className="text-center">Trades</TableHead>
                  <TableHead className="text-center">✅ Ganancia</TableHead>
                  <TableHead className="text-center">❌ Pérdida</TableHead>
                  <TableHead className="text-right">Profit USDC</TableHead>
                  <TableHead>Motivo parada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s, i) => (
                  <TableRow key={s.objectId ?? i}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(s.startedAt)}
                    </TableCell>
                    <TableCell className="text-xs">{formatDuration(s.durationMinutes)}</TableCell>
                    <TableCell className="text-center text-xs">{s.totalTrades}</TableCell>
                    <TableCell className="text-center text-xs text-green-500 font-medium">
                      {s.profitTrades}
                    </TableCell>
                    <TableCell className="text-center text-xs text-red-500 font-medium">
                      {s.lossTrades}
                    </TableCell>
                    <TableCell className={`text-right text-xs font-semibold ${s.totalProfitUSDC >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {s.totalProfitUSDC >= 0 ? '+' : ''}{s.totalProfitUSDC.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.stopReason === 'manual' ? 'secondary' : 'destructive'} className="text-xs">
                        {STOP_REASON_LABELS[s.stopReason] ?? s.stopReason}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
