import Anthropic from '@anthropic-ai/sdk'
import { logger } from '../logger'
import type { Layer3AgentResponse, AgentBias, BotRuntime, MarketAnalysis } from '../types'

const FALLBACK: Layer3AgentResponse = {
  market_bias: 'neutral',
  confidence: 50,
  grid_adjustment: {
    action: 'keep',
    shift_percent: 0,
    new_range_percent: 6,
    new_levels: 10,
    reason: 'Fallback — Agente no disponible',
  },
  order_sizing_bias: 'normal',
  capital_redistribution: { suggested: false, central_levels_percent: 60 },
  risk_flags: [],
  next_review_minutes: 60,
  reasoning: 'Claude AI no disponible — usando configuración neutral por defecto',
}

const RECOMMENDATION_TOOL: Anthropic.Tool = {
  name: 'grid_recommendation',
  description: 'Provide strategic recommendation for the grid trading bot',
  input_schema: {
    type: 'object' as const,
    required: [
      'market_bias', 'confidence', 'grid_adjustment', 'order_sizing_bias',
      'capital_redistribution', 'risk_flags', 'next_review_minutes', 'reasoning',
    ],
    properties: {
      market_bias: { type: 'string' as const, enum: ['bullish', 'bearish', 'neutral'] },
      confidence: { type: 'number' as const, minimum: 0, maximum: 100 },
      grid_adjustment: {
        type: 'object' as const,
        required: ['action', 'shift_percent', 'new_range_percent', 'new_levels', 'reason'],
        properties: {
          action: { type: 'string' as const, enum: ['keep', 'shift_up', 'shift_down', 'widen', 'narrow', 'pause', 'rebuild'] },
          shift_percent: { type: 'number' as const },
          new_range_percent: { type: 'number' as const },
          new_levels: { type: 'number' as const },
          reason: { type: 'string' as const },
        },
      },
      order_sizing_bias: { type: 'string' as const, enum: ['aggressive', 'normal', 'conservative'] },
      capital_redistribution: {
        type: 'object' as const,
        properties: {
          suggested: { type: 'boolean' as const },
          central_levels_percent: { type: 'number' as const },
        },
      },
      risk_flags: { type: 'array' as const, items: { type: 'string' as const } },
      next_review_minutes: { type: 'number' as const },
      reasoning: { type: 'string' as const },
    },
  },
}

export async function runLayer3Agent(
  runtime: BotRuntime,
  analysis: MarketAnalysis,
  trigger: string,
  timeoutMs = 12_000
): Promise<Layer3AgentResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logger.warn('ANTHROPIC_API_KEY no configurada — Capa 3 desactivada')
    return FALLBACK
  }

  try {
    const client = new Anthropic({ apiKey, timeout: timeoutMs })

    const botState = runtime.botState
    const sessionDurationMinutes = botState?.startedAt
      ? Math.round((Date.now() - new Date(botState.startedAt).getTime()) / 60_000)
      : 0
    const context = `
Par: ${analysis.pair}
Precio actual: ${analysis.currentPrice.toFixed(4)}
Cambio 24h: ${analysis.priceChange24h.toFixed(2)}%
Volatilidad 24h: ${analysis.volatility24h.toFixed(2)}%
Tendencia: ${analysis.trend} (${analysis.trendStrength})
Volumen 24h: ${analysis.volume24h.toLocaleString()}
Precio vs MA20: ${analysis.priceVsMA20.toFixed(2)}%
Precio vs MA50: ${analysis.priceVsMA50.toFixed(2)}%

Estado del bot:
- Corriendo: ${runtime.isRunning}
- Trades hoy: ${runtime.dailyTradesCount}
- Órdenes activas: ${runtime.activeOrders.size}
- Sesgo Capa 3 previo: ${runtime.layer3Bias}
- Último trade: ${runtime.lastTradeAt?.toISOString() ?? 'nunca'}
- Pérdidas consecutivas: ${runtime.consecutiveLosses}
- Duración de sesión (min): ${sessionDurationMinutes}

Capital:
- Total base: ${botState?.totalBase?.toFixed(2) ?? 'N/A'} ${analysis.pair.split('/')[0]}
- Capital activo USDC: ${botState?.activeUSDC?.toFixed(2) ?? 'N/A'}
- Ganancia de sesión USDC: ${(botState?.totalProfitUSDC ?? 0).toFixed(4)}
- Peak ganancia sesión USDC: ${runtime.peakProfitUSDC.toFixed(4)}

Grid actual:
- Min: ${botState?.gridMin?.toFixed(4) ?? 'N/A'} | Max: ${botState?.gridMax?.toFixed(4) ?? 'N/A'}
- Niveles: ${botState?.gridLevels ?? 'N/A'} | Config: ${botState?.configName ?? 'N/A'}

Trigger de esta evaluación: ${trigger}
`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `Eres un experto en grid trading y market making especializado en criptomonedas.
Analiza el contexto de mercado proporcionado y da una recomendación estratégica.
Tu objetivo es maximizar la eficiencia del capital y proteger contra pérdidas.
Responde siempre usando la herramienta grid_recommendation.`,
      messages: [{ role: 'user', content: context }],
      tools: [RECOMMENDATION_TOOL],
      tool_choice: { type: 'tool', name: 'grid_recommendation' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return FALLBACK

    const result = toolUse.input as Layer3AgentResponse
    logger.info('Capa 3 respuesta', {
      bias: result.market_bias,
      action: result.grid_adjustment.action,
      confidence: result.confidence,
      trigger,
    })

    return result
  } catch (err) {
    logger.error('Error en Capa 3 (Claude):', err)
    return FALLBACK
  }
}
