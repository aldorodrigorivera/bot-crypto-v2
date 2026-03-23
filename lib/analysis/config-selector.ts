import { GRID_CONFIGS } from '../config'
import type { GridConfig, GridConfigName, TrendDirection } from '../types'

export function selectOptimalConfig(
  volatility24h: number,
  trend: TrendDirection,
  totalCapitalUSD: number
): { config: GridConfig; reason: string } {
  let name: GridConfigName
  let reason: string

  if (totalCapitalUSD < 100) {
    name = 'conservative'
    reason = 'Capital menor a $100 — modo conservador para minimizar riesgo'
  } else if (trend === 'bullish' || trend === 'bearish') {
    name = 'conservative'
    reason = `Tendencia ${trend} fuerte — modo conservador para reducir exposición`
  } else if (volatility24h < 3) {
    name = 'conservative'
    reason = `Volatilidad baja (${volatility24h.toFixed(1)}%) — mercado lateral suave`
  } else if (volatility24h < 6) {
    name = 'balanced'
    reason = `Volatilidad moderada (${volatility24h.toFixed(1)}%) — configuración balanceada`
  } else {
    name = 'aggressive'
    reason = `Alta volatilidad (${volatility24h.toFixed(1)}%) — máxima frecuencia de trades`
  }

  return { config: GRID_CONFIGS[name], reason }
}
