export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runtime as botRuntime } from '@/lib/runtime'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  logger.debug('GET /api/layers/latest')
  try {
    const data = {
      bias: botRuntime.layer3Bias,
      action: botRuntime.layer3Action,
      skippedToday: botRuntime.ordersSkippedToday,
      isPaused: botRuntime.isPaused,
      lastLayer3At: botRuntime.lastLayer3At,
      agentBias: botRuntime.botState?.agentBias ?? 'neutral',
      lastAgentTrigger: botRuntime.botState?.lastAgentTrigger,
    }
    logger.debug('GET /api/layers/latest OK', { bias: data.bias, action: data.action, skipped: data.skippedToday })
    return NextResponse.json<ApiResponse>({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo estado de capas'
    logger.error('GET /api/layers/latest ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
