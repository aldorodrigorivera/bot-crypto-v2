/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */

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

  if (process.env.BINANCE_TESTNET === 'true') {
    exchange.setSandboxMode(true)
  }

  g._exchange = exchange
  return exchange
}
