import { getAppConfig } from '../config'
import type { Layer1Output, Layer2Output, AgentBias, OrderSizingBias, SizeMultiplierInput } from '../types'

export function calculateSizeMultiplier(input: SizeMultiplierInput): number {
  const config = getAppConfig()
  const { layer1, layer2, layer3Bias, layer3SizingBias, isNearCenter, centralLevelsPercent } = input

  // Base: combinar Layer1 y Layer2
  let multiplier = (layer1.maxSizeMultiplier + layer2.sizeMultiplier) / 2

  // Ajuste por sesgo de Capa 3
  if (layer3SizingBias === 'aggressive') multiplier *= 1.2
  else if (layer3SizingBias === 'conservative') multiplier *= 0.7

  // Ajuste por posición en grid (niveles centrales tienen más capital)
  if (isNearCenter) {
    const centralBonus = centralLevelsPercent / 100
    multiplier *= (1 + centralBonus * 0.3)
  }

  // Clampear entre min y max
  const min = config.bot.sizingMinMultiplier
  const max = config.bot.sizingMaxMultiplier
  return Math.min(max, Math.max(min, multiplier))
}

export function calculateOrderAmount(
  baseAmount: number,
  multiplier: number
): number {
  const config = getAppConfig()
  const base = config.bot.sizingBaseAmount
  return (base + baseAmount * multiplier)
}
