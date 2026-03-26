/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BINANCE_TESTNET } from '../../bot.config'

const g = globalThis as { _exchange?: any; _exchangePublic?: any }

export function getExchange(): any {
  if (g._exchange) return g._exchange

  // Importación dinámica para evitar problemas con Turbopack/Webpack en el build
  const ccxt = require('ccxt')

  const exchange = new ccxt.binance({
    apiKey: process.env.BINANCE_API_KEY ?? '',
    secret: process.env.BINANCE_SECRET ?? '',
    enableRateLimit: true,
    timeout: 30000,
    options: {
      defaultType: 'spot',
      adjustForTimeDifference: true,
      recvWindow: 60000,
    },
  })

  if (BINANCE_TESTNET) {
    exchange.setSandboxMode(true)
  }

  g._exchange = exchange
  return exchange
}

/**
 * Exchange de producción sin autenticación, solo para datos públicos (OHLCV).
 * Garantiza que el backtest use datos reales aunque BINANCE_TESTNET=true.
 */
export function getPublicExchange(): any {
  if (g._exchangePublic) return g._exchangePublic

  const ccxt = require('ccxt')

  const exchange = new ccxt.binance({
    enableRateLimit: true,
    options: {
      defaultType: 'spot',
      adjustForTimeDifference: true,
    },
  })

  g._exchangePublic = exchange
  return exchange
}
