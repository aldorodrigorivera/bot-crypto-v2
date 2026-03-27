'use client'

import { useBotStore } from '@/store/bot'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TrendingUp, TrendingDown, Minus, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatusCard() {
  const {
    botStatus, isPaused, currentPrice, priceDirection,
    sseConnected, pair, mode, gridConfig,
    todayTrades, dailyTradesLimit,
  } = useBotStore(useShallow(s => ({
    botStatus: s.botStatus,
    isPaused: s.isPaused,
    currentPrice: s.currentPrice,
    priceDirection: s.priceDirection,
    sseConnected: s.sseConnected,
    pair: s.pair,
    mode: s.mode,
    gridConfig: s.gridConfig,
    todayTrades: s.todayTrades,
    dailyTradesLimit: s.dailyTradesLimit,
  })))

  const dailyPercent = dailyTradesLimit > 0
    ? Math.min(100, Math.round((todayTrades / dailyTradesLimit) * 100))
    : 0

  const statusLabel = botStatus === 'running' ? 'CORRIENDO'
    : botStatus === 'paused' ? 'EN PAUSA'
    : botStatus === 'stopped' ? 'DETENIDO'
    : 'CARGANDO'

  const statusVariant = botStatus === 'running' ? 'default'
    : botStatus === 'paused' ? 'secondary'
    : 'destructive'

  const PriceIcon = priceDirection === 'up' ? TrendingUp
    : priceDirection === 'down' ? TrendingDown
    : Minus

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Precio */}
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm text-muted-foreground" suppressHydrationWarning>{pair}</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold tabular-nums" suppressHydrationWarning>
                  ${currentPrice.toFixed(4)}
                </span>
                <PriceIcon
                  className={cn(
                    'h-5 w-5',
                    priceDirection === 'up' ? 'text-green-500' :
                    priceDirection === 'down' ? 'text-red-500' :
                    'text-muted-foreground'
                  )}
                />
              </div>
            </div>
          </div>

          {/* Título + Badges */}
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-sm font-bold tracking-tight leading-none">BotCryptoIA</p>
              <p className="text-xs text-muted-foreground">Grid Trading Dashboard</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant={statusVariant} className="text-xs font-semibold px-3 py-1 cursor-default">
                  {statusLabel}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-semibold">Estado del bot</p>
                <p className="text-muted-foreground">CORRIENDO: el bot monitorea precios y coloca órdenes activamente.</p>
                <p className="text-muted-foreground">EN PAUSA: detuvo operaciones temporalmente (límite diario o rebuid loop).</p>
                <p className="text-muted-foreground">DETENIDO: sin actividad. Todas las órdenes fueron canceladas.</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-default">
                  {gridConfig.toUpperCase()}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-semibold">Configuración del grid</p>
                <p className="text-muted-foreground">CONSERVATIVE: rango estrecho (~6%), ideal para baja volatilidad. Menos riesgo, menos ganancia por ciclo.</p>
                <p className="text-muted-foreground">BALANCED: rango medio (~8%), balance entre captura de movimiento y seguridad.</p>
                <p className="text-muted-foreground">AGGRESSIVE: rango amplio (8–30%), adaptado a alta volatilidad. Más ganancia potencial, más exposición.</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={mode === 'PRODUCCIÓN' ? 'destructive' : 'secondary'}
                  className={cn(
                    'text-xs cursor-default',
                    mode === 'DEMO' && 'border-blue-500/50 text-blue-400 bg-blue-500/10'
                  )}
                >
                  {mode}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {mode === 'DEMO'
                  ? <><p className="font-semibold">Modo DEMO (demo.binance.com)</p><p className="text-muted-foreground">Entorno oficial de Binance con precios similares al mercado real. Sin dinero real. Puedes resetear el balance desde la UI de Binance.</p></>
                  : mode === 'TESTNET'
                  ? <><p className="font-semibold">Modo TESTNET</p><p className="text-muted-foreground">Entorno de pruebas de Binance con precios independientes al mercado real. Balance se resetea mensualmente.</p></>
                  : <><p className="font-semibold">Modo PRODUCCIÓN</p><p className="text-orange-400">Opera con dinero real en Binance. Cada orden usa fondos reales de tu cuenta.</p></>
                }
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  'flex items-center gap-1 text-xs rounded-full px-2 py-1 border cursor-default',
                  sseConnected
                    ? 'text-green-600 border-green-600/30 bg-green-500/10'
                    : 'text-muted-foreground border-border'
                )}>
                  {sseConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  <span>{sseConnected ? 'LIVE' : 'OFFLINE'}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-semibold">Conexión en tiempo real (SSE)</p>
                {sseConnected
                  ? <p className="text-muted-foreground">El dashboard está recibiendo actualizaciones del servidor en tiempo real vía Server-Sent Events.</p>
                  : <p className="text-muted-foreground">Sin conexión en tiempo real. Los datos pueden estar desactualizados. Recarga la página para reconectar.</p>
                }
              </TooltipContent>
            </Tooltip>
          </div>
          </div>
        </div>

        {/* Indicador de trades diarios — solo visible cuando el bot corre */}
        {botStatus === 'running' && (
          <div className="mt-4 flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground whitespace-nowrap cursor-default">
                  Trades hoy: {todayTrades}/{dailyTradesLimit}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-semibold">Límite diario de trades</p>
                <p className="text-muted-foreground">Número de órdenes ejecutadas hoy vs. el máximo configurado (MAX_DAILY_TRADES).</p>
                <p className="text-muted-foreground">Al alcanzar el límite, el bot se pausa automáticamente hasta la siguiente jornada.</p>
              </TooltipContent>
            </Tooltip>
            <Progress
              value={dailyPercent}
              className={cn(
                'h-1.5 flex-1',
                dailyPercent >= 90 ? '[&>div]:bg-red-500'
                  : dailyPercent >= 70 ? '[&>div]:bg-yellow-500'
                  : '[&>div]:bg-green-500'
              )}
            />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {dailyPercent}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
