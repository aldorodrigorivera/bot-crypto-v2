/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BINANCE_TESTNET, BINANCE_DEMO } from '../../bot.config'

const CURRENT_MODE = BINANCE_DEMO ? 'demo' : BINANCE_TESTNET ? 'testnet' : 'live'

const g = globalThis as { _exchange?: any; _exchangePublic?: any; _exchangeMode?: string }

export function getExchange(): any {
  // Bust cache si el modo cambió (e.g., hot reload tras cambiar bot.config.ts)
  if (g._exchange && g._exchangeMode !== CURRENT_MODE) {
    g._exchange = undefined
  }

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

  if (BINANCE_DEMO) {
    // Demo Mode de Binance — NO usar setSandboxMode (apuntaría a testnet.binance.vision)
    // Endpoint oficial según PDF: https://demo-api.binance.com/api
    // Solo patchear public/private — demo NO soporta endpoints /sapi/
    const demoBase = 'https://demo-api.binance.com'
    Object.assign(exchange.urls.api, {
      public:  `${demoBase}/api`,
      private: `${demoBase}/api`,
      v1:      `${demoBase}/api/v1`,
    })
    // fetchCurrencies llama a sapi/capital/config/getall — no existe en demo
    exchange.has['fetchCurrencies'] = false
    // Forzar fetchBalance a usar GET /api/v3/account en vez de sapi
    exchange.options['fetchBalance'] = 'account'
  } else if (BINANCE_TESTNET) {
    exchange.setSandboxMode(true)
  }

  g._exchange = exchange
  g._exchangeMode = CURRENT_MODE
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
