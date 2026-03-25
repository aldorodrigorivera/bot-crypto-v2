'use client'

import { useState, useMemo } from 'react'
import { useTodayTrades } from '@/hooks/useDashboard'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ArrowUpDown, ArrowUp, ArrowDown, TableIcon, Loader2 } from 'lucide-react'
import type { TradeRecord } from '@/lib/types'

// ─── Input component (inline para evitar imports extra) ───────────────────
function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (!sorted) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 inline" />
  return sorted === 'asc'
    ? <ArrowUp className="ml-1 h-3 w-3 text-primary inline" />
    : <ArrowDown className="ml-1 h-3 w-3 text-primary inline" />
}

// ─── Definición de columnas ───────────────────────────────────────────────
const columns: ColumnDef<TradeRecord>[] = [
  {
    accessorKey: 'executedAt',
    header: ({ column }) => (
      <button className="flex items-center" onClick={() => column.toggleSorting()}>
        Hora <SortIcon sorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ getValue }) => {
      const d = new Date(getValue() as Date)
      return (
        <span className="tabular-nums text-muted-foreground">
          {d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      )
    },
    sortingFn: 'datetime',
  },
  {
    accessorKey: 'side',
    header: 'Tipo',
    cell: ({ getValue }) => {
      const side = getValue() as string
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-semibold w-16 justify-center',
            side === 'buy'
              ? 'text-green-500 border-green-500/30 bg-green-500/5'
              : 'text-red-400 border-red-400/30 bg-red-400/5'
          )}
        >
          {side === 'buy' ? 'COMPRA' : 'VENTA'}
        </Badge>
      )
    },
    filterFn: (row, _, filterValue) =>
      filterValue === 'all' || row.original.side === filterValue,
  },
  {
    accessorKey: 'price',
    header: ({ column }) => (
      <button className="flex items-center" onClick={() => column.toggleSorting()}>
        Precio <SortIcon sorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ getValue }) => (
      <span className="tabular-nums">${Number(getValue()).toFixed(4)}</span>
    ),
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <button className="flex items-center" onClick={() => column.toggleSorting()}>
        Cantidad <SortIcon sorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ getValue }) => (
      <span className="tabular-nums">{Number(getValue()).toFixed(4)}</span>
    ),
  },
  {
    accessorKey: 'usdcValue',
    header: ({ column }) => (
      <button className="flex items-center" onClick={() => column.toggleSorting()}>
        Valor USDC <SortIcon sorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ getValue }) => (
      <span className="tabular-nums">${Number(getValue()).toFixed(2)}</span>
    ),
  },
  {
    accessorKey: 'fee',
    header: 'Fee',
    cell: ({ getValue }) => (
      <span className="tabular-nums text-muted-foreground">${Number(getValue()).toFixed(5)}</span>
    ),
  },
  {
    accessorKey: 'profit',
    header: ({ column }) => (
      <button className="flex items-center" onClick={() => column.toggleSorting()}>
        Ganancia <SortIcon sorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ getValue }) => {
      const v = Number(getValue())
      if (v === 0) return <span className="text-muted-foreground">—</span>
      return (
        <span className={cn('tabular-nums font-medium', v > 0 ? 'text-green-500' : 'text-red-400')}>
          {v > 0 ? '+' : ''}{v.toFixed(5)}
        </span>
      )
    },
  },
  {
    accessorKey: 'gridLevel',
    header: 'Nivel',
    cell: ({ getValue }) => (
      <span className="text-muted-foreground tabular-nums">#{getValue() as number}</span>
    ),
  },
  {
    accessorKey: 'layer1Score',
    header: 'L1',
    cell: ({ getValue }) => {
      const v = getValue() as number | undefined
      if (v == null) return <span className="text-muted-foreground">—</span>
      return <span className="tabular-nums text-xs">{v}</span>
    },
  },
  {
    accessorKey: 'layer2Probability',
    header: 'L2 %',
    cell: ({ getValue }) => {
      const v = getValue() as number | undefined
      if (v == null) return <span className="text-muted-foreground">—</span>
      return <span className="tabular-nums text-xs">{v.toFixed(0)}%</span>
    },
  },
  {
    accessorKey: 'configUsed',
    header: 'Config',
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground capitalize">{getValue() as string}</span>
    ),
  },
]

// ─── Componente principal ─────────────────────────────────────────────────
export function TradesDataTable() {
  const { data: trades, isLoading } = useTodayTrades()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'executedAt', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sideFilter, setSideFilter] = useState('all')

  const filteredData = useMemo(() => {
    if (!trades) return []
    if (sideFilter === 'all') return trades
    return trades.filter(t => t.side === sideFilter)
  }, [trades, sideFilter])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            Trades de hoy
            <span className="text-muted-foreground font-normal capitalize">{today}</span>
            {!isLoading && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {filteredData.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={sideFilter} onValueChange={(v) => setSideFilter(v ?? 'all')}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="buy">Compras</SelectItem>
                <SelectItem value="sell">Ventas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="h-32 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando trades...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Sin trades hoy
          </div>
        ) : (
          <div className="overflow-auto max-h-120">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                {table.getHeaderGroups().map(hg => (
                  <TableRow key={hg.id} className="hover:bg-transparent border-border/50">
                    {hg.headers.map(header => (
                      <TableHead
                        key={header.id}
                        className="text-xs text-muted-foreground first:pl-6 last:pr-6 whitespace-nowrap"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map(row => (
                  <TableRow key={row.id} className="hover:bg-muted/20 border-border/30">
                    {row.getVisibleCells().map(cell => (
                      <TableCell
                        key={cell.id}
                        className="text-xs py-2 first:pl-6 last:pr-6 whitespace-nowrap"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
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
