'use client'

import { useGridOrders } from '@/hooks/useDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TradesTable() {
  const { data: orders, isLoading } = useGridOrders()

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Órdenes Abiertas
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Cargando órdenes...
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Sin órdenes abiertas
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs pl-6">Lado</TableHead>
                  <TableHead className="text-xs text-right">Precio</TableHead>
                  <TableHead className="text-xs text-right">Cantidad</TableHead>
                  <TableHead className="text-xs text-right">Nivel</TableHead>
                  <TableHead className="text-xs text-right pr-6">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order, i) => (
                  <TableRow key={order.orderId ?? i} className="hover:bg-muted/30">
                    <TableCell className="pl-6">
                      <Badge
                        variant={order.side === 'buy' ? 'outline' : 'secondary'}
                        className={cn(
                          'text-xs font-semibold',
                          order.side === 'buy'
                            ? 'text-green-600 border-green-600/30'
                            : 'text-red-500 border-red-500/30'
                        )}
                      >
                        {order.side === 'buy' ? 'COMPRA' : 'VENTA'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      ${order.price.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {order.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      #{order.level}
                    </TableCell>
                    <TableCell className="text-right text-xs pr-6">
                      <span className="text-yellow-500 font-medium">abierta</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
