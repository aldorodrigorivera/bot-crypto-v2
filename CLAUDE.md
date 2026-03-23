# BotCryptoIA — Grid Trading Bot en Next.js

## Descripción del Proyecto

Bot de trading automatizado de criptomonedas (XRP/USDC por defecto) en Binance Spot usando estrategia de Grid Trading. Dashboard web en tiempo real con métricas, gráficos y controles.

## Stack Tecnológico

- **Framework**: Next.js 14+ con App Router
- **Lenguaje**: TypeScript strict mode
- **Estilos**: Tailwind CSS + shadcn/ui (SIEMPRE usar shadcn para componentes UI)
- **Gráficos**: Recharts (integrado con shadcn)
- **Estado global**: Zustand (`store/bot.ts`)
- **Datos de API**: TanStack React Query
- **Tiempo real**: Server-Sent Events (SSE) via `/api/events`
- **Exchange**: CCXT v4 (Binance Spot únicamente)
- **Base de datos**: Back4App (Parse JavaScript SDK)
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`) — claude-haiku-4-5-20251001
- **Logging**: Winston (solo lado servidor)
- **Indicadores técnicos**: technicalindicators npm package
- **Scheduling**: node-cron

## Estructura de Archivos

```
app/                      → Next.js App Router pages y API routes
  api/                    → API routes (NUNCA Edge Runtime en estas rutas)
  dashboard/              → Dashboard principal
lib/
  types.ts               → TODOS los tipos TypeScript del proyecto
  config.ts              → Config centralizada desde env vars + constantes
  logger.ts              → Winston logger (singleton)
  runtime.ts             → Estado en memoria del bot (singleton globalThis)
  sse.ts                 → SSE EventEmitter + broadcastSSE()
  exchange/              → CCXT Binance singleton + mock mode
  database/              → Back4App Parse SDK (7 módulos)
  analysis/              → Análisis de mercado y capas 1/2/3
  bot/                   → Motor del bot (engine, grid, risk, scheduler)
components/
  dashboard/             → Componentes del dashboard
  ui/                    → shadcn/ui components (NO modificar directamente)
store/                   → Zustand stores
hooks/                   → Custom React hooks
```

## Reglas de Negocio Críticas

### Capital
1. **80% RESERVA INTOCABLE**: Solo el 20% (`ACTIVE_PERCENT`) se opera
2. Capital activo se divide 50/50 entre USDC (compras) y base currency (ventas)
3. Ganancias siempre en base currency (XRP). NUNCA convertir a fiat
4. **Solo Spot Trading**: Nunca margin, futuros ni leverage

### Grid
5. Separación mínima entre niveles: ≥ 0.25% (2.5× el fee de 0.1%)
6. Solo ciclos con ganancia neta positiva: `(sellPrice - buyPrice) × amount - 2×fees > 0`

### Riesgo (Auto-stop)
7. Si precio < `gridMin` → stop (`stop_loss_range`)
8. Si precio cae ≥ `STOP_LOSS_PERCENT` desde inicio → stop (`stop_loss_global`)
9. Si `dailyTradesCount >= MAX_DAILY_TRADES` → pause hasta mañana

## Patrones Importantes

### Singleton con globalThis (hot-reload safe)
```typescript
const g = globalThis as any
export const runtime: BotRuntime = g.botRuntime ?? createInitialRuntime()
if (!g.botRuntime) g.botRuntime = runtime
```

### Nunca Edge Runtime en API routes que usen:
- CCXT, Parse SDK, Winston, node-cron
- Agregar: `export const runtime = 'nodejs'` al inicio del archivo

### Mock Mode (MOCK_BALANCE=true)
Todas las operaciones de exchange retornan datos simulados. Útil para desarrollo.

### Campos Legacy de Base de Datos (Back4App)
La colección `BotState` usa nombres distintos entre DB y TypeScript:
```
DB: totalBTC       → TS: totalBase
DB: reserveBTC     → TS: reserveBase
DB: activeBTC      → TS: activeBase
DB: totalProfitBTC → TS: totalProfitBase
```

### Formato de Respuesta API
```typescript
{ success: true, data: { ... } }
{ success: false, error: "mensaje genérico sin stack trace" }
```

## Variables de Entorno

Ver `.env.local` para todas las variables. Las que empiezan con `NEXT_PUBLIC_` son expuestas al cliente — las API keys de Binance y Anthropic NUNCA deben ser `NEXT_PUBLIC_`.

## Comandos de Desarrollo

```bash
npm run dev      # Servidor de desarrollo en http://localhost:3000
npm run build    # Build de producción
npm run start    # Servidor de producción
npm run lint     # ESLint
```

## Principios de Código

- **TypeScript strict**: Todos los tipos en `lib/types.ts`, no usar `any` salvo para globalThis patterns
- **Componentes UI**: SIEMPRE usar shadcn/ui. Gráficos con Recharts
- **Estilos**: SOLO Tailwind CSS, no CSS modules ni styled-components
- **Seguridad**: API Keys solo en variables de servidor (sin `NEXT_PUBLIC_`). Nunca exponer stack traces
- **Errores**: Manejo robusto con fallbacks. La Capa 3 (Claude) falla silenciosamente con `neutral/keep`
- **Performance**: React Query para caché de datos. Zustand para estado reactivo del bot

## Capas de Análisis del Bot

| Capa | Descripción | Tiempo | Trigger |
|------|-------------|--------|---------|
| Layer 1 | Risk Score (0-100) con ATR, OrderBook, Volume | <5ms | Cada orden |
| Layer 2 | Probabilidad técnica: RSI, MACD, Bollinger, VWAP | <100ms | Si Layer 1 aprueba |
| Layer 3 | Claude AI Agent (claude-haiku-4-5-20251001) | <12s | Volatilidad/idle/periódico |

## Dashboard — Componentes Principales

- `StatusCard` — Estado bot + precio live + indicador SSE
- `CapitalCards` — 5 cards: Total BASE, Capital Activo, Ganancia Total, Trades Hoy, Total Trades
- `GridPanel` — Rango grid con barra de progreso del precio
- `TradesTable` — Últimos 20 trades (React Query, refresh automático)
- `LayersPanel` — Bias de Capa 3, acción, órdenes saltadas
- `ProfitChart` — Gráfico barras Recharts de ganancias diarias
- `MarketPanel` — Tendencia, volatilidad, volumen
- `StartModal` — Modal inicio con análisis previo
- `ConfigPanel` — Sliders para grid levels y range
