import Anthropic from '@anthropic-ai/sdk'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { logger } from '../logger'
import type { TradingSession } from '../types'
import * as botConfig from '../../bot.config'
import { runtime as botRuntime } from '../runtime'

const STOP_REASON_ES: Record<string, string> = {
  manual: 'Parada manual por el operador',
  stop_loss_range: 'Stop-loss activado — precio salió del rango del grid',
  stop_loss_global: 'Stop-loss global — caída ≥ límite desde precio inicial',
  daily_limit: 'Límite diario de trades alcanzado',
  error: 'Error inesperado del sistema',
}

/**
 * Genera un reporte en Markdown con análisis de la sesión usando Claude Haiku.
 * Guarda el archivo en docs/sessions/Session_YYYY-MM-DD_HH-MM-SS.md
 * No lanza excepciones — falla silenciosamente.
 */
export async function generateSessionReport(session: TradingSession): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logger.warn('ANTHROPIC_API_KEY no definida — saltando reporte de sesión')
    return
  }

  const stoppedAt = new Date(session.stoppedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const datePart = `${stoppedAt.getFullYear()}-${pad(stoppedAt.getMonth() + 1)}-${pad(stoppedAt.getDate())}`
  const timePart = `${pad(stoppedAt.getHours())}-${pad(stoppedAt.getMinutes())}-${pad(stoppedAt.getSeconds())}`
  const filename = `Session_${datePart}_${timePart}.md`

  const docsDir = join(process.cwd(), 'docs', 'sessions')
  await mkdir(docsDir, { recursive: true })

  const winRate = session.totalTrades > 0
    ? ((session.profitTrades / Math.max(session.profitTrades + session.lossTrades, 1)) * 100).toFixed(1)
    : '0.0'
  const avgProfitPerTrade = session.totalTrades > 0
    ? (session.totalProfitUSDC / session.totalTrades).toFixed(6)
    : '0.000000'

  const systemPrompt = `Eres un analista experto en trading de criptomonedas con grid-trading en Binance Spot.
Tu tarea es analizar sesiones de trading y proporcionar recomendaciones accionables para mejorar el rendimiento.
Responde siempre en español. Sé concreto, usa datos numéricos y evita frases genéricas.`

  const userPrompt = `Analiza la siguiente sesión de grid-trading y genera un reporte completo en Markdown.

## Datos de la sesión
- **Par**: ${session.pair}
- **Inicio**: ${new Date(session.startedAt).toLocaleString('es-MX')}
- **Fin**: ${stoppedAt.toLocaleString('es-MX')}
- **Duración**: ${session.durationMinutes} minutos (${(session.durationMinutes / 60).toFixed(1)}h)
- **Configuración del grid**: ${session.configName}
- **Motivo de parada**: ${STOP_REASON_ES[session.stopReason] ?? session.stopReason}

## Métricas de rendimiento
- **Total de trades ejecutados**: ${session.totalTrades}
- **Trades con ganancia**: ${session.profitTrades}
- **Trades con pérdida**: ${session.lossTrades}
- **Win rate**: ${winRate}%
- **Ganancia neta USDC**: ${session.totalProfitUSDC >= 0 ? '+' : ''}${session.totalProfitUSDC.toFixed(6)} USDC
- **Ganancia neta base (${session.pair.split('/')[0]})**: ${session.totalProfitBase >= 0 ? '+' : ''}${session.totalProfitBase.toFixed(8)}
- **Promedio de ganancia por trade**: ${avgProfitPerTrade} USDC

Genera un reporte Markdown con estas secciones:

1. **Resumen ejecutivo** — 2-3 oraciones con lo más relevante de la sesión
2. **Análisis del rendimiento** — interpreta las métricas: ¿fue buena sesión? ¿qué patrones se observan?
3. **Diagnóstico de pérdidas** — si hubo trades con pérdida o la sesión terminó por stop-loss, explica las posibles causas
4. **Recomendaciones de mejora** — mínimo 4 puntos concretos y específicos para:
   - Evitar pérdidas en futuras sesiones
   - Mejorar el win rate
   - Optimizar la configuración del grid (niveles, rango, config: conservative/balanced/aggressive)
   - Gestión del riesgo (cuándo pausar, cuándo parar)
5. **Estrategia sugerida para la próxima sesión** — qué cambios aplicar inmediatamente

Usa formato Markdown claro con emojis para facilitar la lectura. Sé específico con los números.`

  try {
    const client = new Anthropic({ apiKey, timeout: 60_000 })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const analysisText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n')

    const configSnapshot = Object.entries(botConfig)
      .map(([k, v]) => `| \`${k}\` | \`${JSON.stringify(v)}\` |`)
      .join('\n')

    const snap = botRuntime.startSnapshot
    const claudeSection = snap ? `
## Parámetros de Inicio

| Parámetro | Valor |
|-----------|-------|
| Niveles del Grid (slider) | ${snap.gridLevels} |
| Rango del Grid (slider) | ${snap.gridRangePercent}% |
${snap.analysis ? `| Config recomendada (mercado) | ${snap.analysis.recommendedConfig.label} |
| Volatilidad 24h | ${snap.analysis.volatility24h.toFixed(1)}% |
| Tendencia | ${snap.analysis.trend} |
| Razón | ${snap.analysis.configReason} |` : ''}
${snap.claudeRecommendation ? `
### Claude AI al inicio
- **Bias**: ${snap.claudeRecommendation.market_bias} (${snap.claudeRecommendation.confidence}% confianza)
- **Razonamiento**: ${snap.claudeRecommendation.reasoning}
- **Niveles sugeridos**: ${snap.claudeRecommendation.grid_adjustment.new_levels}
- **Rango sugerido**: ${snap.claudeRecommendation.grid_adjustment.new_range_percent}%
${snap.claudeRecommendation.risk_flags.length > 0 ? `- **Alertas**: ${snap.claudeRecommendation.risk_flags.join(' · ')}` : ''}` : ''}
` : ''

    const markdown = `# Reporte de Sesión — ${session.pair}
**Fecha:** ${datePart} ${timePart.replace(/-/g, ':')}
**Motivo de parada:** ${STOP_REASON_ES[session.stopReason] ?? session.stopReason}

---

## Métricas Rápidas

| Métrica | Valor |
|---------|-------|
| Duración | ${session.durationMinutes}m (${(session.durationMinutes / 60).toFixed(1)}h) |
| Total trades | ${session.totalTrades} |
| Con ganancia ✅ | ${session.profitTrades} |
| Con pérdida ❌ | ${session.lossTrades} |
| Win rate | ${winRate}% |
| Ganancia neta | ${session.totalProfitUSDC >= 0 ? '+' : ''}${session.totalProfitUSDC.toFixed(6)} USDC |
| Grid config | ${session.configName} |

---

${claudeSection}

---

${analysisText}

---

## Configuración bot.config.ts (snapshot de la sesión)

| Variable | Valor |
|----------|-------|
${configSnapshot}

---
*Reporte generado automáticamente por Claude Haiku el ${stoppedAt.toLocaleString('es-MX')}*
`

    const filePath = join(docsDir, filename)
    await writeFile(filePath, markdown, 'utf-8')
    logger.info(`Reporte de sesión guardado: docs/sessions/${filename}`)
  } catch (err) {
    logger.error('Error generando reporte de sesión con Claude:', err)
  }
}
