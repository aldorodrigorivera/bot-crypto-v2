export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { sseEmitter } from '@/lib/sse'
import { logger } from '@/lib/logger'
import type { SSEEvent } from '@/lib/types'

export async function GET(req: NextRequest) {
  logger.info('GET /api/events — cliente SSE conectado')

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'))

      const listener = (event: SSEEvent) => {
        logger.debug('SSE broadcast', { type: event.type })
        const data = `data: ${JSON.stringify(event)}\n\n`
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          sseEmitter.off('event', listener)
        }
      }

      sseEmitter.on('event', listener)

      req.signal.addEventListener('abort', () => {
        sseEmitter.off('event', listener)
        try { controller.close() } catch {}
        logger.info('GET /api/events — cliente SSE desconectado')
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
