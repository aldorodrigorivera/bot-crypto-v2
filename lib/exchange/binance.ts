/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BINANCE_TESTNET } from '../../bot.config'

const g = globalThis as { _exchange?: any }

export function getExchange(): any {
  if (g._exchange) return g._exchange

  // Importación dinámica para evitar problemas con Turbopack/Webpack en el build
  const ccxt = require('ccxt')

  const exchange = new ccxt.binance({
    apiKey: process.env.BINANCE_API_KEY ?? '',
    secret: process.env.BINANCE_SECRET ?? '',
    enableRateLimit: true,
    options: {
      defaultType: 'spot',
      adjustForTimeDifference: true,
    },
  })

  if (BINANCE_TESTNET) {
    exchange.setSandboxMode(true)
  }

  g._exchange = exchange
  return exchange
}
