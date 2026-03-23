import { EventEmitter } from 'events'
import type { SSEEventType, SSEEvent } from './types'

class SSEEmitter extends EventEmitter {}

const g = globalThis as { sseEmitter?: SSEEmitter }
export const sseEmitter: SSEEmitter = g.sseEmitter ?? new SSEEmitter()
if (!g.sseEmitter) g.sseEmitter = sseEmitter

// Aumentar límite de listeners para evitar warnings
sseEmitter.setMaxListeners(100)

export function broadcastSSE(type: SSEEventType, data: object): void {
  const event: SSEEvent = {
    type,
    timestamp: new Date().toISOString(),
    data,
  }
  sseEmitter.emit('event', event)
}
