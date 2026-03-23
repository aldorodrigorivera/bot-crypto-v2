'use client'

import { useBotStore } from '@/store/bot'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatusCard() {
  const {
    botStatus, isPaused, currentPrice, priceDirection,
    sseConnected, pair, mode, gridConfig,
  } = useBotStore()

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
              <p className="text-sm text-muted-foreground">{pair}</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold tabular-nums">
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
            <Badge variant={statusVariant} className="text-xs font-semibold px-3 py-1">
              {statusLabel}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {gridConfig.toUpperCase()}
            </Badge>
            <Badge
              variant={mode === 'TESTNET' ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {mode}
            </Badge>
            <div className={cn(
              'flex items-center gap-1 text-xs rounded-full px-2 py-1 border',
              sseConnected
                ? 'text-green-600 border-green-600/30 bg-green-500/10'
                : 'text-muted-foreground border-border'
            )}>
              {sseConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{sseConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
