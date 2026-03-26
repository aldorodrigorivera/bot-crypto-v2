'use client'

import { useGridOrders } from '@/hooks/useDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LayoutGrid, ArrowRight, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EnrichedOrder {
  orderId: string
  level: number
  side: 'buy' | 'sell'
  price: number
  amount: number
  status: string
  pairedPrice: number | null
  estimatedProfit: number | null
}

export function TradesTable() {
  const { data: rawOrders, isLoading } = useGridOrders()
  const orders = rawOrders as EnrichedOrder[] | undefined

  const buys = orders?.filter(o => o.side === 'buy') ?? []
  const sells = orders?.filter(o => o.side === 'sell') ?? []

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Órdenes Abiertas
          {orders && (
            <span className="text-xs text-muted-foreground font-normal">
              {sells.length} ventas · {buys.length} compras
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Cargando órdenes...
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Sin órdenes abiertas
          </div>
        ) : (
          <div className="space-y-1.5 max-h-85 overflow-y-auto pr-1">
            {orders.map((order) => (
              <OrderRow key={order.orderId} order={order} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OrderRow({ order }: { order: EnrichedOrder }) {
  const isBuy = order.side === 'buy'

  return (
    <div className={cn(
      'rounded-md border px-3 py-2 text-xs space-y-1',
      isBuy
        ? 'border-green-500/20 bg-green-500/5'
        : 'border-red-500/20 bg-red-500/5'
    )}>
      {/* Fila principal: badge + flujo de precios */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-semibold shrink-0',
            isBuy
              ? 'text-green-500 border-green-500/30'
              : 'text-red-400 border-red-400/30'
          )}
        >
          {isBuy ? 'COMPRA' : 'VENTA'}
        </Badge>

        {isBuy ? (
          // Compra: esperando comprar a X → venderá más arriba
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>Esperando comprar a</span>
            <span className="font-semibold text-green-400">${order.price.toFixed(4)}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="text-muted-foreground/70 italic">venderá al siguiente nivel</span>
          </div>
        ) : order.pairedPrice !== null ? (
          // Venta con origen conocido: compró a X → vende a Y
          <div className="flex items-center gap-1 text-muted-foreground flex-wrap">
            <span>Compró a</span>
            <span className="font-semibold text-green-400">${order.pairedPrice.toFixed(4)}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span>vende a</span>
            <span className="font-semibold text-red-400">${order.price.toFixed(4)}</span>
          </div>
        ) : (
          // Venta inicial sin origen conocido
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>Vende a</span>
            <span className="font-semibold text-red-400">${order.price.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* Fila secundaria: cantidad + ganancia estimada + nivel */}
      <div className="flex items-center gap-3 text-muted-foreground">
        <span>{order.amount.toFixed(2)} XRP · ${(order.price * order.amount).toFixed(2)} USDT</span>
        {order.estimatedProfit !== null && (
          <span className={cn(
            'flex items-center gap-0.5 font-medium',
            order.estimatedProfit > 0 ? 'text-green-500' : 'text-red-400'
          )}>
            <TrendingUp className="h-3 w-3" />
            {order.estimatedProfit > 0 ? '+' : ''}{order.estimatedProfit.toFixed(4)} USDT ganancia estimada
          </span>
        )}
        <span className="ml-auto text-muted-foreground/50">nivel #{order.level}</span>
      </div>
    </div>
  )
}
