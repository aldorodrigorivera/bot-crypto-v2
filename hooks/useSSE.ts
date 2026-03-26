'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useBotStore } from '@/store/bot'
import type { SSEEvent } from '@/lib/types'

export function useSSE() {
  const esRef = useRef<EventSource | null>(null)
  const updateFromSSE = useBotStore(s => s.updateFromSSE)
  const setSSEConnected = useBotStore(s => s.setSSEConnected)
  const addRiskAlert = useBotStore(s => s.addRiskAlert)

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      const es = new EventSource('/api/events')
      esRef.current = es

      es.onopen = () => setSSEConnected(true)

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as SSEEvent
          if (event.type !== 'connected' as string) {
            updateFromSSE(event)

            if (event.type === 'risk_alert') {
              const d = event.data as {
                message: string
                kind?: 'rate_limit'
                waitMs?: number
                ordersCount?: number
                ordersLimit?: number
                openCount?: number
                maxOrders?: number
                resumeAt?: number
              }
              if (d.kind === 'rate_limit' && d.waitMs != null) {
                const detail = `${d.ordersCount}/${d.ordersLimit} órdenes en 10s — esperando ${d.waitMs}ms`
                toast.warning(d.message, { description: detail, position: 'bottom-right', duration: d.waitMs + 1000 })
                addRiskAlert(d.message, detail)
              } else if (d.openCount != null) {
                const detail = `${d.openCount}/${d.maxOrders} órdenes abiertas — reanuda en ≤${d.resumeAt}`
                toast.warning(d.message, { description: detail, position: 'bottom-right', duration: 6000 })
                addRiskAlert(d.message, detail)
              } else {
                toast.warning(d.message, { position: 'bottom-right', duration: 5000 })
                addRiskAlert(d.message, (d as { detail?: string }).detail)
              }
            }
          }
        } catch {}
      }

      es.onerror = () => {
        es.close()
        setSSEConnected(false)
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout)
      esRef.current?.close()
      setSSEConnected(false)
    }
  }, [updateFromSSE, setSSEConnected, addRiskAlert])
}
