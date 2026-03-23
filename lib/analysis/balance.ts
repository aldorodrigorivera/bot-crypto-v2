import { readAccountBalance } from '../exchange/orders'
import { getAppConfig } from '../config'
import type { AccountBalance } from '../types'

export interface CapitalDistribution {
  totalBase: number
  reserveBase: number
  activeBase: number
  estimatedActiveUSDC: number
  freeUSDC: number
}

export async function calculateCapitalDistribution(
  pair: string,
  currentPrice: number
): Promise<CapitalDistribution> {
  const config = getAppConfig()
  const balance: AccountBalance = await readAccountBalance(pair)

  const activePercent = config.bot.activePercent / 100
  const activeBase = balance.totalBase * activePercent
  const reserveBase = balance.totalBase - activeBase

  // Capital activo se divide 50/50 entre base y USDC
  const estimatedActiveUSDC = (activeBase / 2) * currentPrice

  return {
    totalBase: balance.totalBase,
    reserveBase,
    activeBase,
    estimatedActiveUSDC,
    freeUSDC: balance.freeUSDC,
  }
}
