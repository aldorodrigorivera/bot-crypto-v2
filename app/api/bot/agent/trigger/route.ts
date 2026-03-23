export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { runLayer3Agent } from '@/lib/analysis/layer3-agent'
import { runtime as botRuntime } from '@/lib/runtime'
import { broadcastSSE } from '@/lib/sse'
import { saveBotState } from '@/lib/database/botState'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function POST() {
  logger.info('POST /api/bot/agent/trigger — activando Capa 3 manualmente')
  try {
    if (!botRuntime.lastAnalysis) {
      logger.warn('POST /api/bot/agent/trigger — sin análisis de mercado previo')
      return NextResponse.json<ApiResponse>({ success: false, error: 'Sin análisis de mercado previo' }, { status: 400 })
    }

    const response = await runLayer3Agent(botRuntime, botRuntime.lastAnalysis, 'user_requested')
    botRuntime.layer3Bias = response.market_bias
    botRuntime.layer3Action = response.grid_adjustment.action
    botRuntime.lastLayer3At = new Date()

    broadcastSSE('agent_response', response)

    if (botRuntime.botState) {
      botRuntime.botState.agentBias = response.market_bias
      botRuntime.botState.lastAgentTrigger = 'user_requested'
      botRuntime.botState.lastAgentAt = new Date()
      await saveBotState(botRuntime.botState).catch(() => {})
    }

    logger.info('POST /api/bot/agent/trigger OK', {
      bias: response.market_bias,
      action: response.grid_adjustment.action,
      riskFlags: response.risk_flags,
    })
    return NextResponse.json<ApiResponse>({ success: true, data: response })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error consultando agente'
    logger.error('POST /api/bot/agent/trigger ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
