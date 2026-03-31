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

  // Rango dinámico: el grid debe cubrir ~50% de la volatilidad real para capturar
  // oscilaciones frecuentes sin ser demasiado amplio. Mínimo 2%, máximo según volatilidad.
  // Ejemplo: 5.7% vol → 2.85% rango → precio solo necesita moverse 0.5% para tocar un nivel.
  const dynamicRange = (vol: number): number =>
    Math.round(Math.max(2, Math.min(vol * 0.5, 30)) * 10) / 10

  if (volatility24h < 3) {
    name = 'conservative'
    const range = dynamicRange(Math.max(volatility24h, 2))
    reason = `Volatilidad baja (${volatility24h.toFixed(1)}%) — mercado lateral suave`
    return { config: { ...GRID_CONFIGS[name], gridRangePercent: range }, reason }
  } else if (volatility24h < 6) {
    name = 'balanced'
    const range = dynamicRange(volatility24h)
    reason = `Volatilidad moderada (${volatility24h.toFixed(1)}%) — rango ajustado a ${range}% para capturar oscilaciones laterales`
    return { config: { ...GRID_CONFIGS[name], gridRangePercent: range }, reason }
  } else if (volatility24h < 15) {
    name = 'aggressive'
    const range = dynamicRange(volatility24h)
    reason = `Alta volatilidad (${volatility24h.toFixed(1)}%) — rango ajustado a ${range}%`
    return { config: { ...GRID_CONFIGS[name], gridRangePercent: range }, reason }
  } else {
    // Volatilidad extrema: usar rango diario promedio como referencia.
    const referenceRange = averageDailyRange && averageDailyRange > 0
      ? averageDailyRange
      : volatility24h * 0.6
    const range = Math.min(Math.ceil(referenceRange * 1.2), 30)
    name = 'aggressive'
    reason =
      `Volatilidad extrema (${volatility24h.toFixed(1)}%) — ` +
      `rango dinámico ${range}% basado en movimiento típico diario ` +
      `(${referenceRange.toFixed(1)}%), ampliado para evitar ruptura de rango`
    return {
      config: { ...GRID_CONFIGS[name], gridRangePercent: range },
      reason,
    }
  }
}
