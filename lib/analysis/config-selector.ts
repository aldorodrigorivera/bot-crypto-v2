import { GRID_CONFIGS } from '../config'
import type { GridConfig, GridConfigName, TrendDirection } from '../types'

export function selectOptimalConfig(
  volatility24h: number,
  trend: TrendDirection,
  totalCapitalUSD: number,
  averageDailyRange?: number
): { config: GridConfig; reason: string } {
  let name: GridConfigName
  let reason: string

  if (totalCapitalUSD < 100) {
    name = 'conservative'
    reason = 'Capital menor a $100 — modo conservador para minimizar riesgo'
    return { config: GRID_CONFIGS[name], reason }
  }

  if (volatility24h < 3) {
    name = 'conservative'
    reason = `Volatilidad baja (${volatility24h.toFixed(1)}%) — mercado lateral suave`
  } else if (volatility24h < 6) {
    name = 'balanced'
    reason = `Volatilidad moderada (${volatility24h.toFixed(1)}%) — configuración balanceada`
  } else if (volatility24h < 15) {
    name = 'aggressive'
    reason = `Alta volatilidad (${volatility24h.toFixed(1)}%) — máxima frecuencia de trades`
  } else {
    // Volatilidad extrema: el rango del grid debe cubrir al menos el movimiento típico diario.
    // Usamos el rango diario promedio (7 días) como referencia; si no está disponible, derivamos
    // de la volatilidad actual. El rango dinámico cubre ~1.2× el movimiento típico, cap en 30%.
    const referenceRange = averageDailyRange && averageDailyRange > 0
      ? averageDailyRange
      : volatility24h * 0.6 // estimación conservadora cuando no hay historial
    const dynamicRange = Math.min(Math.ceil(referenceRange * 1.2), 30)
    name = 'aggressive' // más niveles = más oportunidades dentro del rango amplio
    reason =
      `Volatilidad extrema (${volatility24h.toFixed(1)}%) — ` +
      `rango dinámico ${dynamicRange}% basado en movimiento típico diario ` +
      `(${referenceRange.toFixed(1)}%), ampliado para evitar ruptura de rango`
    return {
      config: { ...GRID_CONFIGS[name], gridRangePercent: dynamicRange },
      reason,
    }
  }

  return { config: GRID_CONFIGS[name], reason }
}
