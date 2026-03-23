import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Declarar paquetes pesados de servidor como externos (no bundlizar)
  serverExternalPackages: ['ccxt', 'parse', 'winston', 'node-cron', 'technicalindicators'],

  // Silencia el error de Turbopack cuando hay webpack config
  turbopack: {},

  // Webpack config para compatibilidad con módulos nativos de Node
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        crypto: false,
      }
    }
    return config
  },

  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
