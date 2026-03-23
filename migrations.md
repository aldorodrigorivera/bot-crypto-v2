# Grid Trading Bot — Guía de Migración a Next.js

> Este documento es la especificación completa del proyecto BotCryptoIA para ser recreado en Next.js desde cero. Contiene todas las reglas de negocio, variables de entorno, esquema de base de datos, API endpoints, lógica de trading y arquitectura de componentes.

---

## Índice

1. [Resumen del Proyecto](#1-resumen-del-proyecto)
2. [Stack Propuesto (Next.js)](#2-stack-propuesto-nextjs)
3. [Variables de Entorno](#3-variables-de-entorno)
4. [Reglas de Negocio Críticas](#4-reglas-de-negocio-críticas)
5. [Arquitectura del Sistema](#5-arquitectura-del-sistema)
6. [Tipos TypeScript Completos](#6-tipos-typescript-completos)
7. [Esquema de Base de Datos (Back4App / Parse)](#7-esquema-de-base-de-datos-back4app--parse)
8. [Capa de Exchange (Binance / CCXT)](#8-capa-de-exchange-binance--ccxt)
9. [Lógica del Bot de Trading](#9-lógica-del-bot-de-trading)
10. [Sistema de Capas de Análisis](#10-sistema-de-capas-de-análisis)
11. [API Endpoints](#11-api-endpoints)
12. [Tiempo Real (WebSocket → SSE)](#12-tiempo-real-websocket--sse)
13. [Estructura de Archivos Next.js](#13-estructura-de-archivos-nextjs)
14. [Componentes del Dashboard](#14-componentes-del-dashboard)
15. [Configuración y Constantes](#15-configuración-y-constantes)
16. [Instrucciones de Implementación](#16-instrucciones-de-implementación)

---

## 1. Resumen del Proyecto

Bot de trading automatizado que opera en pares de criptomonedas (por defecto **XRP/USDC**) en **Binance Spot** usando la estrategia de **Grid Trading**.

### ¿Qué hace el bot?

1. Divide el precio actual en N niveles (grid) dentro de un rango porcentual
2. Coloca órdenes de **compra** por debajo del precio actual y **venta** por encima
3. Cuando se ejecuta una orden de compra, coloca automáticamente una orden de venta un nivel arriba (y viceversa)
4. Cada ciclo completo (compra + venta) genera una ganancia = diferencia de precio - comisiones (0.1% cada orden)
5. Un sistema de 3 capas analíticas decide si colocar cada orden y con qué tamaño

### Características principales

- Grid trading automático en Binance Spot (no futuros, no margin)
- 80% del balance es reserva intocable; solo se opera con el 20%
- 3 capas de análisis: Risk Score, Probabilidad técnica, Agente Claude AI
- Position sizing dinámico: tamaño de orden varía según señales del mercado
- Order splitting: cada orden se divide en micro-órdenes escalonadas
- Dashboard web en tiempo real con métricas, gráficos y controles
- Persistencia en Back4App (Parse Server en la nube)
- Soporte de modo mock para pruebas sin dinero real

---

## 2. Stack Propuesto (Next.js)

```
Next.js 14+ (App Router)
├── Runtime: Node.js v20+
├── Language: TypeScript v5+ (strict mode)
├── Styling: Tailwind CSS v3 + shadcn/ui
├── Charts: Recharts o Chart.js via react-chartjs-2
├── State: Zustand (estado global del bot) + React Query (datos de API)
├── Real-time: Server-Sent Events (SSE) via API route de Next.js
├── Trading: CCXT v4+ (Binance Spot API)
├── Database: Back4App (Parse JavaScript SDK)
├── AI: Anthropic SDK (@anthropic-ai/sdk)
├── Logging: Winston (solo en servidor)
├── Indicadores: technicalindicators npm package
└── Scheduling: node-cron (en Next.js custom server o Route Handler con keepAlive)
```

### Nota sobre WebSocket vs SSE

El proyecto actual usa WebSocket (puerto 3001 separado). En Next.js se recomienda usar **Server-Sent Events (SSE)** a través de un Route Handler porque:
- No requiere servidor custom separado
- Compatible con Edge Runtime y Vercel (si aplica)
- Un-directional (servidor → cliente) que es todo lo que se necesita
- Más simple de implementar

Si se prefiere WebSocket real, usar `socket.io` con un Next.js custom server en `server.ts`.

---

## 3. Variables de Entorno

Crear `.env.local` en la raíz del proyecto Next.js:

```bash
# ─── BINANCE ──────────────────────────────────────────────────────────────
BINANCE_API_KEY=tu_api_key_de_binance
BINANCE_SECRET=tu_secret_de_binance
BINANCE_TESTNET=true          # true = testnet.binance.vision | false = producción real

# Balance simulado (true = no consulta Binance, usa balance ficticio de 1000 base + 10000 USDC)
MOCK_BALANCE=true             # Cambiar a false para dinero real

# ─── BACK4APP (Base de Datos en la Nube) ──────────────────────────────────
BACK4APP_APP_ID=tu_app_id_de_back4app
BACK4APP_JS_KEY=tu_js_key_de_back4app
BACK4APP_SERVER_URL=https://parseapi.back4app.com/parse

# ─── CONFIGURACIÓN DEL BOT ────────────────────────────────────────────────
PAIR=XRP/USDC                 # Par de trading (BASE/QUOTE)
ACTIVE_PERCENT=20             # % del balance base que el bot puede operar (el resto es reserva)

# ─── GRID ─────────────────────────────────────────────────────────────────
GRID_LEVELS=10                # Número de niveles del grid
GRID_RANGE_PERCENT=6          # Rango total del grid en % respecto al precio actual

# ─── RIESGO ───────────────────────────────────────────────────────────────
STOP_LOSS_PERCENT=12          # % de caída desde precio inicial que detiene el bot
MAX_DAILY_TRADES=200          # Máximo de trades por día calendario

# ─── CAPAS DE ANÁLISIS ────────────────────────────────────────────────────
LAYER1_MIN_RISK_SCORE=30      # Score mínimo (0-100) para aprobar orden en Capa 1
LAYER2_MIN_PROBABILITY=45     # Probabilidad mínima (0-100) para aprobar en Capa 2
LAYER3_TRIGGER_VOLATILITY=2.0 # % de cambio de volatilidad en 10min que activa Capa 3
LAYER3_TRIGGER_IDLE_MINUTES=30 # Minutos sin trades que activa Capa 3
LAYER3_REVIEW_HOURS=4         # Re-análisis periódico del agente (horas)

# ─── POSITION SIZING ──────────────────────────────────────────────────────
SIZING_BASE_AMOUNT=0.001      # Tamaño base de cada orden en la moneda base (XRP)
SIZING_MAX_MULTIPLIER=1.5     # Multiplicador máximo (señal muy fuerte)
SIZING_MIN_MULTIPLIER=0.2     # Multiplicador mínimo (señal débil)
SIZING_CENTRAL_LEVELS_PERCENT=60 # % del capital para niveles centrales del grid

# ─── ORDER SPLITTING ──────────────────────────────────────────────────────
SPLIT_ENABLED=true            # Activar micro-órdenes
SPLIT_PARTS=3                 # En cuántas partes dividir cada orden
SPLIT_DISTRIBUTION=30,40,30   # % para cada micro-orden (debe sumar 100)
SPLIT_SPREAD_PERCENT=0.15     # Separación entre micro-órdenes en %

# ─── CLAUDE AI (Capa 3) ───────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...  # API Key de Anthropic (si no se configura, bot corre sin Capa 3)

# ─── SERVIDOR ─────────────────────────────────────────────────────────────
PORT=3000                     # Puerto de Next.js (default 3000)
LOG_LEVEL=info                # debug | info | warn | error
```

---

## 4. Reglas de Negocio Críticas

Estas reglas son **inquebrantables** y deben validarse en todos los paths de código:

### Capital

1. **80% = RESERVA INTOCABLE**: Del balance total de la moneda base (XRP), solo el 20% (configurable via `ACTIVE_PERCENT`) se usa para operar. El 80% restante nunca se vende.
2. **Split del capital activo**: El capital activo se divide 50/50 entre el lado compras (USDC) y el lado ventas (base currency). Necesitamos USDC para colocar buy limit orders (Binance congela fondos) y base currency para sell limit orders.
3. **Ganancias en base currency**: Las ganancias siempre se acumulan en XRP (o la base del par). El bot NUNCA convierte a moneda fiat.
4. **Solo Spot Trading**: Nunca margin, futuros, ni leverage.

### Grid

5. **Separación mínima entre niveles**: ≥ 0.25% (2.5× el fee de 0.1% por trade). Si dos niveles están más cerca, el grid no es rentable.
6. **Ganancia por ciclo**: `ciclo = precio_venta - precio_compra - 2 × 0.1% × precio_promedio`. Solo ciclos con ganancia > 0 se permiten.

### Riesgo

7. **Stop-loss de rango**: Si el precio cae por debajo del `gridMin`, el bot se detiene automáticamente.
8. **Stop-loss global**: Si el precio cae ≥ `STOP_LOSS_PERCENT` desde el precio inicial de la sesión, el bot se detiene.
9. **Límite de trades diarios**: Al alcanzar `MAX_DAILY_TRADES` en un día calendario, el bot pausa automáticamente hasta el día siguiente.

### API Keys

10. Las API Keys de Binance deben tener permisos de **lectura + trading spot ÚNICAMENTE**. Nunca habilitar permisos de retiro.

---

## 5. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App                               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    App Router (frontend)                   │   │
│  │  /dashboard → Dashboard UI con Zustand + React Query      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Routes (/api/*)                     │   │
│  │  /api/status  /api/bot/*  /api/trades/*  /api/config/*   │   │
│  │  /api/market  /api/layers  /api/efficiency  /api/events   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Core Services (lib/*)                        │   │
│  │  BotEngine  GridManager  RiskManager  Scheduler            │   │
│  │  Layer1     Layer2       Layer3Agent  PositionSizer        │   │
│  │  OrderSplitter  MarketAnalysis  BalanceManager             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Infrastructure                               │   │
│  │  Exchange (CCXT/Binance)  Database (Back4App)             │   │
│  │  SSE EventEmitter         Logger (Winston)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
    Binance API          Back4App Cloud       Anthropic API
```

### Objeto Runtime (estado en memoria del servidor)

```typescript
// Este objeto vive en memoria del proceso Node.js del servidor
// Se comparte entre todos los Route Handlers via módulo singleton
interface BotRuntime {
  isRunning: boolean
  isPaused: boolean
  botState: BotState | null
  activeOrders: Map<string, GridOrder>   // orderId → GridOrder
  currentConfig: GridConfig | null
  lastAnalysis: MarketAnalysis | null
  dailyTradesCount: number
  dailyTradesDate: string                // YYYY-MM-DD
  mainLoopInterval: ReturnType<typeof setInterval> | null
  lastLayer3At: Date | null
  ordersSkippedToday: number
  lastTradeAt: Date | null
  layer3Bias: 'bullish' | 'bearish' | 'neutral'
  layer3Action: string
}

// Inicialización
export const runtime: BotRuntime = {
  isRunning: false,
  isPaused: false,
  botState: null,
  activeOrders: new Map(),
  currentConfig: null,
  lastAnalysis: null,
  dailyTradesCount: 0,
  dailyTradesDate: '',
  mainLoopInterval: null,
  lastLayer3At: null,
  ordersSkippedToday: 0,
  lastTradeAt: null,
  layer3Bias: 'neutral',
  layer3Action: 'keep',
}
```

---

## 6. Tipos TypeScript Completos

Crear `lib/types.ts` con todas las interfaces:

```typescript
// ─── Enums y Union Types ───────────────────────────────────────────────────
export type GridConfigName = 'conservative' | 'balanced' | 'aggressive'
export type TrendDirection = 'bullish' | 'bearish' | 'sideways'
export type TrendStrength = 'weak' | 'moderate' | 'strong'
export type OrderSide = 'buy' | 'sell'
export type OrderStatus = 'open' | 'filled' | 'cancelled'
export type BotStopReason = 'manual' | 'stop_loss_range' | 'stop_loss_global' | 'daily_limit' | 'error'
export type AgentBias = 'bullish' | 'bearish' | 'neutral'
export type OrderSizingBias = 'aggressive' | 'normal' | 'conservative'
export type GridAction = 'keep' | 'shift_up' | 'shift_down' | 'widen' | 'narrow' | 'pause' | 'rebuild'

// ─── Configuración del Grid ────────────────────────────────────────────────
export interface GridConfig {
  name: GridConfigName
  label: string
  gridLevels: number
  gridRangePercent: number
  description: string
  idealFor: string
  minProfitPerCycle: number
}

// ─── Grid Level ────────────────────────────────────────────────────────────
export interface GridLevel {
  level: number
  price: number
  side: OrderSide
  amount: number
}

// ─── Balance ───────────────────────────────────────────────────────────────
export interface AccountBalance {
  totalBase: number
  freeBase: number
  usedBase: number
  totalUSDC: number
  freeUSDC: number
}

// ─── Análisis de Mercado ───────────────────────────────────────────────────
export interface MarketAnalysis {
  timestamp: Date
  pair: string
  currentPrice: number
  price24hHigh: number
  price24hLow: number
  priceChange24h: number          // en %
  volatility24h: number           // (high-low)/low * 100
  averageDailyRange: number       // promedio últimos 7 días
  trend: TrendDirection
  trendStrength: TrendStrength
  priceVsMA20: number             // % por encima/debajo de MA20
  priceVsMA50: number             // % por encima/debajo de MA50
  volume24h: number
  volumeChange: number            // vs día anterior en %
  totalBase: number
  reserveBase: number
  activeBase: number
  estimatedActiveUSDC: number
  recommendedConfig: GridConfig
  configReason: string
}

// ─── Estado del Bot ────────────────────────────────────────────────────────
export interface BotState {
  objectId?: string
  isRunning: boolean
  isPaused: boolean
  totalBase: number
  reserveBase: number
  activeBase: number
  activeUSDC: number
  gridMin: number
  gridMax: number
  gridLevels: number
  gridRangePercent: number
  configName: GridConfigName
  totalProfitBase: number
  totalProfitUSDC: number
  totalTrades: number
  startedAt: Date
  lastActiveAt: Date
  stopReason?: BotStopReason
  pair: string
  initialPrice: number
  capitalEfficiencyScore?: number
  agentBias?: AgentBias
  lastAgentTrigger?: string
  lastAgentAt?: Date
  ordersSkippedToday?: number
}

// ─── Orden del Grid ────────────────────────────────────────────────────────
export interface GridOrder {
  objectId?: string
  orderId: string
  level: number
  side: OrderSide
  price: number
  amount: number
  status: OrderStatus
  filledAt?: Date
  pairedOrderId?: string
}

// ─── Registro de Trade ─────────────────────────────────────────────────────
export interface TradeRecord {
  pair: string
  side: OrderSide
  price: number
  targetPrice?: number
  amount: number
  usdcValue: number
  fee: number
  profit: number                  // ganancia neta del ciclo (solo en sells)
  profitBase: number              // ganancia acumulada en base currency
  gridLevel: number
  orderId: string
  pairedOrderId?: string
  executedAt: Date
  configUsed: GridConfigName
  status?: 'placed' | 'filled'
  // v2 fields
  layer1Score?: number
  layer2Probability?: number
  sizeMultiplier?: number
  isMicroOrder?: boolean
  parentMicroGroupId?: string
  microOrderIndex?: number
}

// ─── Orden en el Exchange ──────────────────────────────────────────────────
export interface ExchangeOrder {
  id: string
  side: OrderSide
  price: number
  amount: number
  filled: number
  remaining: number
  status: 'open' | 'closed' | 'canceled' | 'expired' | 'rejected'
  timestamp: number
  symbol: string
}

// ─── Resumen de Trades ─────────────────────────────────────────────────────
export interface TradesSummary {
  totalTrades: number
  totalProfitBase: number
  totalProfitUSDC: number
  todayTrades: number
  todayProfitBase: number
  todayProfitUSDC: number
  todayFees: number
}

// ─── Historial de Ganancias ────────────────────────────────────────────────
export interface DailyProfit {
  date: string                    // YYYY-MM-DD
  profitBase: number
  profitUSDC: number
  trades: number
}

// ─── Capas de Análisis ────────────────────────────────────────────────────
export interface Layer1Input {
  orderSide: OrderSide
  orderPrice: number
  currentPrice: number
  ohlcv: number[][]
  orderBook: { bids: number[][]; asks: number[][] }
  recentTrades: Array<{ side: string; amount: number }>
  gridRange: { min: number; max: number }
}

export interface Layer1Output {
  riskScore: number               // 0-100
  approved: boolean
  maxSizeMultiplier: number
  subScores: {
    volatility: number
    position: number
    orderBook: number
    volume: number
  }
  blockedReason?: string
}

export interface Layer2Output {
  probability: number             // 0-100
  marketBias: AgentBias
  sizeMultiplier: number          // 0.0 a 1.2
  approved: boolean
  signals: {
    rsi: { value: number; contribution: number }
    macd: { signal: string; contribution: number }
    bollinger: { position: string; contribution: number }
    vwap: { deviation: number; contribution: number }
    momentum: { pattern: string; contribution: number }
    orderFlow: { imbalance: number; contribution: number }
  }
  skipReason?: string
}

export interface Layer3AgentResponse {
  market_bias: AgentBias
  confidence: number
  grid_adjustment: {
    action: GridAction
    shift_percent: number
    new_range_percent: number
    new_levels: number
    reason: string
  }
  order_sizing_bias: OrderSizingBias
  capital_redistribution: {
    suggested: boolean
    central_levels_percent: number
  }
  risk_flags: string[]
  next_review_minutes: number
  reasoning: string
}

// ─── Micro-Órdenes ────────────────────────────────────────────────────────
export interface MicroOrder {
  parentOrderId: string
  microIndex: number
  side: OrderSide
  price: number
  amount: number
  percent: number
  status: 'open' | 'filled' | 'cancelled'
  binanceOrderId?: string
}

// ─── Registros de Base de Datos ────────────────────────────────────────────
export interface LayerAnalysisRecord {
  objectId?: string
  layer: 1 | 2
  orderSide: OrderSide
  orderPrice: number
  approved: boolean
  score: number
  sizeMultiplier: number
  subScores: object
  evaluatedAt: Date
}

export interface GridEfficiencyRecord {
  objectId?: string
  efficiencyScore: number
  activeLevels: number
  totalLevels: number
  capitalInActive: number
  capitalTotal: number
  tradesLast4h: number
  recordedAt: Date
}

// ─── Configuración de la App ───────────────────────────────────────────────
export interface AppConfig {
  binance: {
    apiKey: string
    secret: string
    testnet: boolean
  }
  back4app: {
    appId: string
    jsKey: string
    serverUrl: string
  }
  bot: {
    pair: string
    activePercent: number
    gridLevels: number
    gridRangePercent: number
    stopLossPercent: number
    maxDailyTrades: number
    layer1MinRiskScore: number
    layer2MinProbability: number
    layer3TriggerVolatility: number
    layer3TriggerIdleMinutes: number
    layer3ReviewHours: number
    sizingBaseAmount: number
    sizingMaxMultiplier: number
    sizingMinMultiplier: number
    sizingCentralLevelsPercent: number
    splitEnabled: boolean
    splitParts: number
    splitDistribution: number[]
    splitSpreadPercent: number
  }
  server: {
    port: number
  }
  logLevel: string
  anthropicApiKey: string
  mockBalance: boolean
}

// ─── Eventos SSE ──────────────────────────────────────────────────────────
export type SSEEventType =
  | 'price_update'
  | 'trade_executed'
  | 'order_placed'
  | 'layer_analysis'
  | 'agent_response'
  | 'bot_status_change'
  | 'grid_rebuild'
  | 'risk_alert'
  | 'efficiency_update'

export interface SSEEvent {
  type: SSEEventType
  timestamp: string
  data: object
}

// ─── Runtime del Bot ──────────────────────────────────────────────────────
export interface BotRuntime {
  isRunning: boolean
  isPaused: boolean
  botState: BotState | null
  activeOrders: Map<string, GridOrder>
  currentConfig: GridConfig | null
  lastAnalysis: MarketAnalysis | null
  dailyTradesCount: number
  dailyTradesDate: string
  mainLoopInterval: ReturnType<typeof setInterval> | null
  lastLayer3At: Date | null
  ordersSkippedToday: number
  lastTradeAt: Date | null
  layer3Bias: AgentBias
  layer3Action: string
}
```

---

## 7. Esquema de Base de Datos (Back4App / Parse)

### Inicialización

```typescript
// lib/database/client.ts
import Parse from 'parse'

let initialized = false

export function initParse(): void {
  if (initialized) return
  Parse.initialize(
    process.env.BACK4APP_APP_ID!,
    process.env.BACK4APP_JS_KEY!
  )
  Parse.serverURL = process.env.BACK4APP_SERVER_URL!
  initialized = true
}
```

### Colección: `BotState` (1 registro máximo por pair)

| Campo Parse (string)     | Campo TypeScript         | Tipo    | Descripción                              |
| ------------------------ | ------------------------ | ------- | ---------------------------------------- |
| `isRunning`              | `isRunning`              | Boolean | Si el bot está activo                    |
| `isPaused`               | `isPaused`               | Boolean | Si está pausado por Capa 3               |
| `totalBTC`               | `totalBase`              | Number  | Balance total de la moneda base          |
| `reserveBTC`             | `reserveBase`            | Number  | 80% intocable                            |
| `activeBTC`              | `activeBase`             | Number  | 20% operativo                            |
| `activeUSDC`             | `activeUSDC`             | Number  | USDC disponible para compras             |
| `gridMin`                | `gridMin`                | Number  | Precio mínimo del grid                   |
| `gridMax`                | `gridMax`                | Number  | Precio máximo del grid                   |
| `gridLevels`             | `gridLevels`             | Number  | Número de niveles                        |
| `gridRangePercent`       | `gridRangePercent`       | Number  | Rango del grid en %                      |
| `configName`             | `configName`             | String  | conservative/balanced/aggressive         |
| `totalProfitBTC`         | `totalProfitBase`        | Number  | Ganancia total acumulada                 |
| `totalProfitUSDC`        | `totalProfitUSDC`        | Number  | Ganancia total en USDC                   |
| `totalTrades`            | `totalTrades`            | Number  | Total de trades completados              |
| `startedAt`              | `startedAt`              | Date    | Cuándo inició la sesión actual           |
| `lastActiveAt`           | `lastActiveAt`           | Date    | Último ciclo activo                      |
| `stopReason`             | `stopReason`             | String  | Motivo de detención                      |
| `pair`                   | `pair`                   | String  | Par de trading (ej: XRP/USDC)            |
| `initialPrice`           | `initialPrice`           | Number  | Precio al inicio (para stop-loss global) |
| `capitalEfficiencyScore` | `capitalEfficiencyScore` | Number  | 0-100                                    |
| `agentBias`              | `agentBias`              | String  | bullish/bearish/neutral                  |
| `lastAgentTrigger`       | `lastAgentTrigger`       | String  | Último trigger que activó Capa 3         |
| `lastAgentAt`            | `lastAgentAt`            | Date    | Última vez que corrió Capa 3             |
| `ordersSkippedToday`     | `ordersSkippedToday`     | Number  | Órdenes saltadas hoy                     |

**IMPORTANTE**: Los campos de DB usan nombres legacy (`totalBTC`, `reserveBTC`, `activeBTC`, `totalProfitBTC`) pero en TypeScript se llaman `totalBase`, `reserveBase`, `activeBase`, `totalProfitBase`. Mantener esta distinción para compatibilidad con datos existentes.

### Colección: `Trade`

| Campo                | Tipo    | Descripción                                         |
| -------------------- | ------- | --------------------------------------------------- |
| `pair`               | String  | Par de trading                                      |
| `side`               | String  | buy/sell                                            |
| `price`              | Number  | Precio de ejecución                                 |
| `targetPrice`        | Number  | Precio objetivo orden opuesta                       |
| `amount`             | Number  | Cantidad de base currency                           |
| `usdcValue`          | Number  | Valor en USDC                                       |
| `fee`                | Number  | Comisión pagada                                     |
| `profit`             | Number  | Ganancia neta del ciclo (sells)                     |
| `profitBTC`          | Number  | Ganancia acumulada en base (campo legacy)           |
| `gridLevel`          | Number  | Nivel del grid donde ocurrió                        |
| `orderId`            | String  | ID de Binance                                       |
| `pairedOrderId`      | String  | ID de la orden complementaria                       |
| `executedAt`         | Date    | Timestamp de ejecución                              |
| `configUsed`         | String  | Nombre de config (conservative/balanced/aggressive) |
| `status`             | String  | placed/filled                                       |
| `layer1Score`        | Number  | Score de Capa 1                                     |
| `layer2Probability`  | Number  | Probabilidad de Capa 2                              |
| `sizeMultiplier`     | Number  | Multiplicador de tamaño aplicado                    |
| `isMicroOrder`       | Boolean | Si es parte de un split                             |
| `parentMicroGroupId` | String  | ID del grupo de micro-órdenes                       |
| `microOrderIndex`    | Number  | Índice dentro del grupo (0, 1, 2)                   |

### Colección: `GridOrder`

| Campo           | Tipo   | Descripción                     |
| --------------- | ------ | ------------------------------- |
| `orderId`       | String | ID de Binance                   |
| `level`         | Number | Nivel en el grid (0, 1, 2, ...) |
| `side`          | String | buy/sell                        |
| `price`         | Number | Precio de la orden              |
| `amount`        | Number | Cantidad                        |
| `status`        | String | open/filled/cancelled           |
| `filledAt`      | Date   | Cuándo se ejecutó               |
| `pairedOrderId` | String | ID de la orden opuesta          |

### Colección: `MarketAnalysis`

| Campo               | Tipo   | Descripción                    |
| ------------------- | ------ | ------------------------------ |
| `pair`              | String | Par analizado                  |
| `currentPrice`      | Number | Precio al momento del análisis |
| `volatility24h`     | Number | % de volatilidad               |
| `trend`             | String | bullish/bearish/sideways       |
| `trendStrength`     | String | weak/moderate/strong           |
| `volume24h`         | Number | Volumen                        |
| `recommendedConfig` | String | Nombre de config recomendada   |
| `configReason`      | String | Motivo de la recomendación     |
| `analyzedAt`        | Date   | Timestamp                      |

### Colección: `GridConfig` (configuración persistente)

| Campo              | Tipo   | Descripción      |
| ------------------ | ------ | ---------------- |
| `pair`             | String | Par de trading   |
| `gridLevels`       | Number | Niveles del grid |
| `gridRangePercent` | Number | Rango en %       |

### Colección: `LayerAnalysis`

| Campo            | Tipo    | Descripción                             |
| ---------------- | ------- | --------------------------------------- |
| `layer`          | Number  | 1 o 2                                   |
| `orderSide`      | String  | buy/sell                                |
| `orderPrice`     | Number  | Precio de la orden evaluada             |
| `approved`       | Boolean | Si fue aprobada                         |
| `score`          | Number  | Score (Layer 1) o probability (Layer 2) |
| `sizeMultiplier` | Number  | Multiplicador resultante                |
| `subScores`      | Object  | Desglose de sub-scores                  |
| `evaluatedAt`    | Date    | Timestamp                               |

### Colección: `GridEfficiency`

| Campo             | Tipo   | Descripción                 |
| ----------------- | ------ | --------------------------- |
| `efficiencyScore` | Number | 0-100                       |
| `activeLevels`    | Number | Niveles con órdenes activas |
| `totalLevels`     | Number | Total de niveles del grid   |
| `capitalInActive` | Number | Capital en órdenes activas  |
| `capitalTotal`    | Number | Capital total activo        |
| `tradesLast4h`    | Number | Trades en las últimas 4h    |
| `recordedAt`      | Date   | Timestamp                   |

---

## 8. Capa de Exchange (Binance / CCXT)

```typescript
// lib/exchange/binance.ts
import ccxt from 'ccxt'

// Singleton de la instancia CCXT
let exchangeInstance: ccxt.binance | null = null

export function getExchange(): ccxt.binance {
  if (exchangeInstance) return exchangeInstance

  exchangeInstance = new ccxt.binance({
    apiKey: process.env.BINANCE_API_KEY!,
    secret: process.env.BINANCE_SECRET!,
    enableRateLimit: true,
    options: {
      defaultType: 'spot',              // NUNCA futuros ni margin
      adjustForTimeDifference: true,
    },
  })

  if (process.env.BINANCE_TESTNET === 'true') {
    exchangeInstance.setSandboxMode(true)  // Apunta a testnet.binance.vision
  }

  return exchangeInstance
}
```

### Mock Mode (`MOCK_BALANCE=true`)

Cuando `MOCK_BALANCE=true`, TODAS las operaciones de exchange retornan datos simulados:

- **`readAccountBalance()`** → `{ totalBase: 1000, freeBase: 500, usedBase: 500, totalUSDC: 10000, freeUSDC: 5000 }`
- **`placeLimitOrder()`** → Retorna ExchangeOrder fake con ID `MOCK-{timestamp}-{counter}`
- **`placeMarketOrder()`** → Retorna ExchangeOrder fake con status `closed`
- **`fetchOpenOrders()`** → Retorna `[]`
- **`fetchClosedOrders()`** → Retorna `[]`
- **`cancelOrder()`/`cancelAllOrders()`** → No-op
- **`verifyBinanceConnection()`** → Retorna sin error

---

## 9. Lógica del Bot de Trading

### 9.1 Grid Management (`lib/bot/grid.ts`)

#### `buildGridLevels(currentPrice, config, amountPerLevel) → GridLevel[]`

Construye los niveles del grid centrados en el precio actual:

```
gridMin = currentPrice * (1 - gridRangePercent/200)
gridMax = currentPrice * (1 + gridRangePercent/200)
stepSize = (gridMax - gridMin) / (gridLevels - 1)

Para cada nivel i de 0 a gridLevels-1:
  price_i = gridMin + i * stepSize
  side = price_i < currentPrice ? 'buy' : 'sell'

VALIDACIÓN: stepSize / currentPrice * 100 >= MIN_LEVEL_SEPARATION (0.25%)
```

#### `calculateAmountPerLevel(activeUSDC, config, currentPrice) → number`

```
estimatedBuyLevels = gridLevels / 2
amountPerLevel = (activeUSDC / currentPrice) / estimatedBuyLevels
```

#### `getOppositeOrderPrice(filledOrder, gridLevels) → number`

```
Si la orden fue BUY en precio P:
  Buscar el nivel de venta inmediatamente superior a P

Si la orden fue SELL en precio P:
  Buscar el nivel de compra inmediatamente inferior a P
```

#### `calculateCycleProfit(buyPrice, sellPrice, amount) → number`

```
grossProfit = (sellPrice - buyPrice) * amount
fees = 2 * BINANCE_FEE_PERCENT/100 * ((buyPrice + sellPrice)/2) * amount
netProfit = grossProfit - fees
```

### 9.2 Risk Manager (`lib/bot/risk.ts`)

#### `checkRiskRules(runtime, currentPrice) → { shouldStop: boolean, reason?: BotStopReason, warning?: string }`

```
Regla 1: if currentPrice < runtime.botState.gridMin
  → shouldStop = true, reason = 'stop_loss_range'

Regla 2: priceDrop = (botState.initialPrice - currentPrice) / botState.initialPrice * 100
  if priceDrop >= config.stopLossPercent
  → shouldStop = true, reason = 'stop_loss_global'

Regla 3 (warning): if currentPrice < gridMin + 0.1 * (gridMax - gridMin)
  → warning = 'Precio en zona de peligro'

Regla 4: if dailyTradesCount >= maxDailyTrades
  → shouldStop = true, reason = 'daily_limit'
```

#### `executeEmergencyStop(runtime, reason)`

1. Cancela todas las órdenes abiertas en Binance
2. Llama `markBotAsStopped(reason)` en Back4App
3. Limpia `runtime` (isRunning = false, clearInterval del main loop)
4. Emite SSE `bot_status_change { status: 'stopped', reason }`

### 9.3 Bot Engine (`lib/bot/engine.ts`)

#### `runBotCycle(runtime) → CycleResult`

Llamado cada 30 segundos por el main loop:

```typescript
// 1. Obtener órdenes cerradas (ejecutadas) de Binance
const closedOrders = await fetchClosedOrders(pair)

// 2. Filtrar solo las que están en nuestro activeOrders Map
const newlyFilled = closedOrders.filter(o =>
  runtime.activeOrders.has(o.id) &&
  runtime.activeOrders.get(o.id)!.status === 'open'
)

// 3. Para cada orden ejecutada:
for (const filled of newlyFilled) {

  // 3a. Calcular profit si es SELL
  const profit = filled.side === 'sell'
    ? calculateCycleProfit(pairedBuyPrice, filled.price, filled.amount)
    : 0

  // 3b. Determinar precio de la orden opuesta
  const oppositePrice = getOppositeOrderPrice(filled, runtime.currentConfig)
  const oppositeSide = filled.side === 'buy' ? 'sell' : 'buy'

  // 3c. Capa 1: Risk Score (siempre corre, <5ms)
  const layer1 = await runLayer1Analysis({
    orderSide: oppositeSide,
    orderPrice: oppositePrice,
    currentPrice,
    ohlcv,
    orderBook,
    recentTrades,
    gridRange: { min: gridMin, max: gridMax }
  })

  if (!layer1.approved) {
    // Guardar registro de rechazo, incrementar ordersSkipped
    continue
  }

  // 3d. Capa 2: Probabilidad técnica (solo si Capa 1 aprobó, <100ms)
  const layer2 = await runLayer2Analysis(ohlcv, orderBook, oppositeSide)

  if (!layer2.approved) {
    continue
  }

  // 3e. Position sizing
  const multiplier = calculateSizeMultiplier({
    layer1,
    layer2,
    agentBias: runtime.layer3Bias,
    gridLevel: filledLevel,
    gridLevels: config.gridLevels,
    centralLevelsPercent: config.sizingCentralLevelsPercent
  })

  const amount = calculateOrderAmount(config.sizingBaseAmount, multiplier)

  // 3f. Order splitting
  const microOrders = splitOrder({
    pair, side: oppositeSide, price: oppositePrice, amount,
    splitEnabled: config.splitEnabled,
    splitParts: config.splitParts,
    splitDistribution: config.splitDistribution,
    spreadPercent: config.splitSpreadPercent
  })

  // 3g. Colocar micro-órdenes en Binance
  for (const micro of microOrders) {
    const placed = await placeLimitOrder(pair, micro.side, micro.amount, micro.price)
    // Guardar en activeOrders y Back4App
    // Emitir SSE 'order_placed'
  }

  // 3h. Guardar Trade record, emitir SSE 'trade_executed'
  // 3i. Actualizar BotState (totalProfitUSDC, totalTrades, etc.)
}

// 4. Emitir precio actual
broadcastSSE('price_update', { price: currentPrice })

return { updatedState, updatedOrders, ordersSkipped }
```

### 9.4 Position Sizer (`lib/analysis/positionSizer.ts`)

```typescript
function calculateSizeMultiplier(params): number {
  const { layer1, layer2, agentBias, gridLevel, gridLevels, centralLevelsPercent } = params

  // Base: distancia del nivel al centro (niveles centrales reciben más capital)
  const center = gridLevels / 2
  const distanceFromCenter = Math.abs(gridLevel - center)
  const maxDistance = gridLevels / 2
  const centralBonus = (centralLevelsPercent / 100) * (1 - distanceFromCenter / maxDistance)

  // Combinar multiplicadores
  let multiplier = layer2.sizeMultiplier * layer1.maxSizeMultiplier * (1 + centralBonus * 0.5)

  // Aplicar sesgo del agente
  if (agentBias === 'aggressive') multiplier *= 1.2
  else if (agentBias === 'conservative') multiplier *= 0.7

  // Clamp entre min y max configurados
  return Math.max(config.sizingMinMultiplier, Math.min(config.sizingMaxMultiplier, multiplier))
}
```

### 9.5 Order Splitter (`lib/bot/orderSplitter.ts`)

```typescript
function splitOrder(params): Array<{ side, price, amount }> {
  const { side, price, amount, splitEnabled, splitParts, splitDistribution, spreadPercent } = params

  if (!splitEnabled || splitParts <= 1) {
    return [{ side, price, amount }]
  }

  // Normalizar distribución para que sume 100%
  const totalDist = splitDistribution.reduce((a, b) => a + b, 0)
  const normalizedDist = splitDistribution.map(d => d / totalDist)

  return normalizedDist.map((pct, i) => {
    // BUY: scouts debajo del precio | SELL: scouts arriba del precio
    const offset = (i - Math.floor(splitParts / 2)) * (spreadPercent / 100) * price
    const microPrice = side === 'buy' ? price - Math.abs(offset) : price + Math.abs(offset)
    const microAmount = amount * pct
    return { side, price: roundToDecimals(microPrice, 6), amount: roundToDecimals(microAmount, 6) }
  })
}
```

### 9.6 Scheduler / Orquestador (`lib/bot/scheduler.ts`)

#### `startBot(opts: StartBotOptions)`

```typescript
interface StartBotOptions {
  resume?: boolean             // Reanudar sesión anterior (no crear nueva)
  gridLevels?: number          // Override GRID_LEVELS
  gridRangePercent?: number    // Override GRID_RANGE_PERCENT
}
```

Flujo de inicio:
1. Verificar que el bot no esté ya corriendo
2. Si `resume=true`, cargar BotState previo desde Back4App
3. Si es sesión nueva: ejecutar análisis de mercado
4. Leer balance (real o mock)
5. Calcular distribución 80/20
6. Asegurar USDC disponible para lado compras (convertir base si es necesario)
7. Construir niveles del grid
8. Colocar todas las órdenes iniciales
9. Guardar BotState en Back4App
10. Iniciar main loop (`setInterval` cada 30s)
11. Iniciar cron de re-análisis (cada 4h)
12. Trigger de Capa 3 en background (trigger='bot_start')

#### Main Loop (cada 30 segundos)

```
1. Obtener precio actual
2. Verificar reglas de riesgo → si falla, executeEmergencyStop()
3. runBotCycle() → procesar órdenes ejecutadas
4. Actualizar runtime.botState
5. Guardar BotState en Back4App
6. Verificar triggers de Capa 3
7. Emitir SSE bot_status_change con métricas actuales
```

#### Reanalysis Cron (cada 4 horas: `0 */4 * * *`)

```
1. runMarketAnalysis()
2. Actualizar runtime.lastAnalysis
3. Calcular eficiencia del capital
4. Guardar GridEfficiency en Back4App
5. Si config recomendada ≠ config actual → log informativo (NO cambio automático)
```

#### Layer 3 Triggers

El agente se activa cuando:
- `trigger = 'bot_start'` → Al iniciar
- `trigger = 'periodic'` → Cada `LAYER3_REVIEW_HOURS` horas
- `trigger = 'high_volatility'` → Cambio de volatilidad > `LAYER3_TRIGGER_VOLATILITY`%
- `trigger = 'idle_too_long'` → Sin trades por > `LAYER3_TRIGGER_IDLE_MINUTES` minutos
- `trigger = 'low_efficiency'` → Eficiencia de capital < 40%
- `trigger = 'consecutive_skips'` → > 10 órdenes saltadas consecutivas
- `trigger = 'user_requested'` → Botón en dashboard

**Rate limit**: Mínimo 15 minutos entre llamadas al agente.

---

## 10. Sistema de Capas de Análisis

### Capa 1: Risk Score (`lib/analysis/layer1-risk.ts`)

```
Objetivo: Filtrado rápido (<5ms) antes de cada orden

Input: OHLCV (50 velas 1h), OrderBook, últimos trades, posición en grid

Pesos:
  Volatilidad (35%): ATR(5) / ATR(20) ratio
    ratio < 0.8 → 90 (baja volatilidad, ideal para grid)
    ratio 0.8-1.2 → 70
    ratio 1.2-1.6 → 45
    ratio > 1.6 → 20 (demasiado volátil)

  Posición (30%): Distancia a soporte/resistencia + posición en rango
    En extremos del grid → más score (buena zona de reversión)
    En centro del grid → score medio
    Fuera del grid → score 0 (bloquea orden)

  Order Book (25%): ratio = bidVolume / askVolume (top 5 niveles)
    BUY order con ratio > 1.5 → 80 (soporte fuerte)
    SELL order con ratio < 0.7 → 80 (resistencia fuerte)
    Ratio neutro → 50

  Volumen (10%): volumeActual / volumePromedio20
    > 1.5 → 90 (actividad alta)
    0.8-1.5 → 70
    < 0.5 → 40 (poca liquidez)

riskScore = suma ponderada de sub-scores
approved = riskScore >= LAYER1_MIN_RISK_SCORE (default: 30)
maxSizeMultiplier = riskScore / 100 * 0.7 + 0.3  (range: 0.3-1.0)
```

### Capa 2: Market Probability (`lib/analysis/layer2-probability.ts`)

```
Objetivo: Análisis técnico probabilístico (<100ms)
Requiere: OHLCV (100 velas), OrderBook

6 Señales (contribuciones en puntos):

1. RSI(14) (±28 pts):
   BUY order:  RSI < 30 → +28, RSI < 40 → +15, RSI > 70 → -28, RSI > 60 → -10
   SELL order: RSI > 70 → +28, RSI > 60 → +15, RSI < 30 → -28, RSI < 40 → -10

2. MACD (±15 pts):
   Cruce alcista (MACD > Signal) → +15 para BUY
   Cruce bajista (MACD < Signal) → +15 para SELL
   Histograma creciendo → +8

3. Bollinger Bands(20, 2) (±18 pts):
   Precio cerca banda inferior → +18 para BUY (oportunidad de rebote)
   Precio cerca banda superior → +18 para SELL
   Precio en medio → ±0

4. VWAP (±12 pts):
   Precio < VWAP * 0.995 → +12 para BUY (barato respecto al promedio)
   Precio > VWAP * 1.005 → +12 para SELL
   Cerca del VWAP → ±0

5. Momentum / Patrones de velas (±15 pts):
   3 velas rojas seguidas → +15 para BUY ('red_exhaustion' - posible reversión)
   3 velas verdes seguidas → +15 para SELL ('green_exhaustion')

6. Order Flow (±15 pts):
   imbalance = (buyVol - sellVol) / totalVol
   imbalance > 0.2 → +15 para BUY
   imbalance < -0.2 → +15 para SELL

probability = 50 + suma_contribuciones  (clampado entre 15 y 85)
approved = probability >= LAYER2_MIN_PROBABILITY (default: 45)
sizeMultiplier = (probability - 50) / 50 * 0.7 + 0.5  (range: 0.0-1.2)
```

### Capa 3: Claude AI Agent (`lib/analysis/layer3-agent.ts`)

```typescript
// Usa Anthropic SDK con tool_use para garantizar JSON válido
const RECOMMENDATION_TOOL: Anthropic.Tool = {
  name: 'grid_recommendation',
  description: 'Provide strategic recommendation for the grid trading bot',
  input_schema: {
    type: 'object',
    required: ['market_bias', 'confidence', 'grid_adjustment', 'order_sizing_bias',
               'capital_redistribution', 'risk_flags', 'next_review_minutes', 'reasoning'],
    properties: {
      market_bias: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
      confidence: { type: 'number', minimum: 0, maximum: 100 },
      grid_adjustment: {
        type: 'object',
        required: ['action', 'shift_percent', 'new_range_percent', 'new_levels', 'reason'],
        properties: {
          action: { type: 'string', enum: ['keep', 'shift_up', 'shift_down', 'widen', 'narrow', 'pause', 'rebuild'] },
          shift_percent: { type: 'number' },
          new_range_percent: { type: 'number' },
          new_levels: { type: 'number' },
          reason: { type: 'string' }
        }
      },
      order_sizing_bias: { type: 'string', enum: ['aggressive', 'normal', 'conservative'] },
      capital_redistribution: {
        type: 'object',
        properties: {
          suggested: { type: 'boolean' },
          central_levels_percent: { type: 'number' }
        }
      },
      risk_flags: { type: 'array', items: { type: 'string' } },
      next_review_minutes: { type: 'number' },
      reasoning: { type: 'string' }
    }
  }
}

// Model: claude-haiku-4-5-20251001 (rápido y económico para decisiones de trading)
// tool_choice: { type: 'tool', name: 'grid_recommendation' } — garantiza JSON válido
// Timeout: 12 segundos
// Fallback: neutral keep action si Claude no está disponible o hay error
```

#### System prompt de la Capa 3

```
Eres un experto en grid trading y market making especializado en criptomonedas.
Analiza el contexto de mercado proporcionado y da una recomendación estratégica.
Tu objetivo es maximizar la eficiencia del capital y proteger contra pérdidas.
Responde siempre usando la herramienta grid_recommendation.
```

#### Acciones disponibles de la Capa 3

| Acción                    | Descripción                   | Efecto                                                     |
| ------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `keep`                    | Mantener configuración actual | Solo actualiza metadata (bias, lastAgentAt)                |
| `pause`                   | Pausar el bot                 | `runtime.isPaused = true`, guarda en Back4App              |
| `rebuild`                 | Reconstruir el grid           | Detiene bot → cancela órdenes → reinicia con nuevos params |
| `shift_up` / `shift_down` | Desplazar el grid             | Log informativo (requiere intervención manual)             |
| `widen` / `narrow`        | Ampliar/estrechar rango       | Log informativo (requiere intervención manual)             |

---

## 11. API Endpoints

Todos los endpoints van en `app/api/` (Next.js App Router).

### Bot Control

```
GET  /api/bot/preview         → Análisis de mercado sin iniciar bot
POST /api/bot/start           → Body: { resume?: boolean, gridLevels?: number, gridRangePercent?: number }
POST /api/bot/stop            → Detener bot (mantiene órdenes en Binance)
POST /api/bot/rebalance       → Stop → Start con misma config
POST /api/bot/analyze         → Forzar análisis de mercado
POST /api/bot/agent/trigger   → Forzar llamada a Capa 3 (user_requested)
POST /api/bot/resume          → Reanudar bot pausado por Capa 3
```

### Estado y Datos

```
GET /api/status               → Estado completo del bot + precio + liveBalance
GET /api/trades               → ?limit=50 (max 200) — últimos trades
GET /api/trades/summary       → Totales + hoy (trades, profit, fees)
GET /api/profit/history       → Ganancias diarias últimos 30 días
```

### Grid y Config

```
GET   /api/grid/orders        → Órdenes activas del grid
GET   /api/config             → Config actual del grid desde Back4App
PATCH /api/config             → Body: { gridLevels?: number, gridRangePercent?: number }
GET   /api/config/check       → Compara config actual vs recomendada
```

### Mercado y Capas

```
GET /api/market/analysis      → Último análisis de mercado
GET /api/layers/latest        → Estado Capa 3: bias, action, skippedToday, isPaused
GET /api/layers/history       → ?limit=50 — historial evaluaciones Capa 1/2
GET /api/efficiency           → ?days=7 — eficiencia del capital
```

### Tiempo Real (SSE)

```
GET /api/events               → Stream SSE (text/event-stream)
```

### Formato de respuesta estándar

```typescript
// Todas las respuestas siguen este formato
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Ejemplo exitoso:
{ "success": true, "data": { ... } }

// Ejemplo error:
{ "success": false, "error": "Mensaje de error" }
```

### `/api/status` — Respuesta completa

```typescript
{
  success: true,
  data: {
    isRunning: boolean,
    isPaused: boolean,
    botState: BotState | null,
    currentConfig: GridConfig | null,
    currentPrice: number,
    openOrdersCount: number,
    pair: string,
    mode: 'TESTNET' | 'PRODUCCIÓN',
    liveBalance: {        // Balance en vivo del exchange (siempre disponible)
      totalBase: number,
      activeBase: number,
      activeUSDC: number,
    } | null
  }
}
```

---

## 12. Tiempo Real (WebSocket → SSE)

### Implementación SSE en Next.js

```typescript
// app/api/events/route.ts
import { NextRequest } from 'next/server'
import { sseEmitter } from '@/lib/sse'

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Enviar ping inicial
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'))

      const listener = (event: SSEEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          sseEmitter.off('event', listener)
        }
      }

      sseEmitter.on('event', listener)

      req.signal.addEventListener('abort', () => {
        sseEmitter.off('event', listener)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

### EventEmitter singleton

```typescript
// lib/sse.ts
import { EventEmitter } from 'events'
import type { SSEEventType, SSEEvent } from './types'

class SSEEmitter extends EventEmitter {}

// Singleton compartido en todo el proceso Node.js
const globalForSSE = globalThis as unknown as { sseEmitter: SSEEmitter }
export const sseEmitter = globalForSSE.sseEmitter ?? new SSEEmitter()
if (!globalForSSE.sseEmitter) globalForSSE.sseEmitter = sseEmitter

export function broadcastSSE(type: SSEEventType, data: object): void {
  const event: SSEEvent = {
    type,
    timestamp: new Date().toISOString(),
    data,
  }
  sseEmitter.emit('event', event)
}
```

### Tipos de eventos SSE

| Evento              | Datos                                                 | Cuándo                       |
| ------------------- | ----------------------------------------------------- | ---------------------------- |
| `price_update`      | `{ price, pair }`                                     | Cada 5s (siempre)            |
| `trade_executed`    | `{ side, price, amount, profit, pair }`               | Al ejecutarse una orden      |
| `order_placed`      | `{ side, price, amount, orderId }`                    | Al colocar una nueva orden   |
| `layer_analysis`    | `{ layer, approved, score, reason }`                  | Por cada evaluación Capa 1/2 |
| `agent_response`    | `Layer3AgentResponse`                                 | Cuando responde la Capa 3    |
| `bot_status_change` | `{ status, reason?, totalProfitUSDC?, totalTrades? }` | Cambio de estado del bot     |
| `grid_rebuild`      | `{ pair, newConfig }`                                 | Al reconstruir el grid       |
| `risk_alert`        | `{ message }`                                         | Risk flags de Capa 3         |
| `efficiency_update` | `{ score }`                                           | Actualización de eficiencia  |

### Consumidor SSE en React

```typescript
// hooks/useSSE.ts
import { useEffect, useRef } from 'react'

export function useSSE(onMessage: (event: SSEEvent) => void) {
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const connect = () => {
      const es = new EventSource('/api/events')
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as SSEEvent
          onMessage(event)
        } catch {}
      }

      es.onerror = () => {
        es.close()
        setTimeout(connect, 5000)  // Reconectar en 5s
      }
    }

    connect()
    return () => esRef.current?.close()
  }, [])
}
```

---

## 13. Estructura de Archivos Next.js

```
bot-nextjs/
├── app/
│   ├── layout.tsx                    ← Root layout con providers
│   ├── page.tsx                      ← Redirect a /dashboard
│   └── dashboard/
│       └── page.tsx                  ← Dashboard principal
│
├── app/api/
│   ├── status/route.ts               ← GET /api/status
│   ├── events/route.ts               ← GET /api/events (SSE)
│   ├── bot/
│   │   ├── start/route.ts            ← POST /api/bot/start
│   │   ├── stop/route.ts             ← POST /api/bot/stop
│   │   ├── rebalance/route.ts        ← POST /api/bot/rebalance
│   │   ├── analyze/route.ts          ← POST /api/bot/analyze
│   │   ├── resume/route.ts           ← POST /api/bot/resume
│   │   ├── preview/route.ts          ← GET /api/bot/preview
│   │   └── agent/trigger/route.ts    ← POST /api/bot/agent/trigger
│   ├── trades/
│   │   ├── route.ts                  ← GET /api/trades
│   │   └── summary/route.ts          ← GET /api/trades/summary
│   ├── grid/
│   │   └── orders/route.ts           ← GET /api/grid/orders
│   ├── config/
│   │   ├── route.ts                  ← GET, PATCH /api/config
│   │   └── check/route.ts            ← GET /api/config/check
│   ├── market/
│   │   └── analysis/route.ts         ← GET /api/market/analysis
│   ├── profit/
│   │   └── history/route.ts          ← GET /api/profit/history
│   ├── layers/
│   │   ├── latest/route.ts           ← GET /api/layers/latest
│   │   └── history/route.ts          ← GET /api/layers/history
│   └── efficiency/route.ts           ← GET /api/efficiency
│
├── lib/
│   ├── types.ts                      ← Todos los tipos TypeScript
│   ├── config.ts                     ← Config central desde env
│   ├── logger.ts                     ← Winston logger
│   ├── runtime.ts                    ← Singleton BotRuntime (estado en memoria)
│   ├── sse.ts                        ← SSE EventEmitter + broadcastSSE()
│   │
│   ├── exchange/
│   │   ├── binance.ts                ← Singleton CCXT
│   │   └── orders.ts                 ← place/cancel/fetch orders + mock mode
│   │
│   ├── analysis/
│   │   ├── market.ts                 ← runMarketAnalysis()
│   │   ├── balance.ts                ← readAccountBalance(), calculateCapitalDistribution()
│   │   ├── config-selector.ts        ← selectOptimalConfig() (3 configs predefinidas)
│   │   ├── layer1-risk.ts            ← runLayer1Analysis()
│   │   ├── layer2-probability.ts     ← runLayer2Analysis()
│   │   ├── layer3-agent.ts           ← runLayer3Agent() + Claude API
│   │   └── positionSizer.ts          ← calculateSizeMultiplier(), calculateOrderAmount()
│   │
│   ├── bot/
│   │   ├── engine.ts                 ← runBotCycle()
│   │   ├── grid.ts                   ← buildGridLevels(), calculateAmountPerLevel()
│   │   ├── risk.ts                   ← checkRiskRules(), executeEmergencyStop()
│   │   ├── scheduler.ts              ← startBot(), stopBot(), resumeBot()
│   │   └── orderSplitter.ts          ← splitOrder()
│   │
│   └── database/
│       ├── client.ts                 ← initParse() singleton
│       ├── botState.ts               ← getBotState(), saveBotState(), markBotAsStopped()
│       ├── trades.ts                 ← saveTrade(), getRecentTrades(), getTradesSummary()
│       ├── gridOrders.ts             ← saveGridOrder(), getActiveGridOrders(), clearAllGridOrders()
│       ├── marketAnalysis.ts         ← saveMarketAnalysis(), getLatestMarketAnalysis()
│       ├── config.ts                 ← getGridConfig(), saveGridConfig()
│       ├── layerAnalysis.ts          ← saveLayerAnalysis(), getRecentLayerAnalysis()
│       └── gridEfficiency.ts         ← saveGridEfficiency(), getGridEfficiencyHistory()
│
├── components/
│   ├── dashboard/
│   │   ├── StatusCard.tsx            ← Estado bot + precio + indicador Live
│   │   ├── CapitalCards.tsx          ← Total, Capital Activo, Ganancia Total, etc.
│   │   ├── GridPanel.tsx             ← Rango del grid, niveles, config, barra de progreso
│   │   ├── TradesTable.tsx           ← Últimos 20 trades con SWR
│   │   ├── LayersPanel.tsx           ← Capa 3: bias, acción, saltadas
│   │   ├── ProfitChart.tsx           ← Gráfico barras ganancias diarias (Recharts)
│   │   ├── MarketPanel.tsx           ← Tendencia, volatilidad, volumen
│   │   ├── StartModal.tsx            ← Modal inicio bot con análisis previo
│   │   └── ConfigPanel.tsx           ← Sliders grid levels y range
│   │
│   └── ui/                           ← shadcn/ui components
│
├── hooks/
│   ├── useSSE.ts                     ← Hook para consumir SSE
│   ├── useBotStore.ts                ← Zustand store del estado del bot
│   └── useDashboard.ts               ← React Query para datos del dashboard
│
├── store/
│   └── bot.ts                        ← Zustand store global
│
├── .env.local                        ← Variables de entorno
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

---

## 14. Componentes del Dashboard

### Zustand Store

```typescript
// store/bot.ts
import { create } from 'zustand'

interface BotStore {
  // Estado
  botStatus: 'loading' | 'running' | 'paused' | 'stopped'
  isPaused: boolean
  currentPrice: number
  priceDirection: 'up' | 'down' | 'neutral'
  sseConnected: boolean

  // Capital
  totalBase: number
  activeUSDC: number
  totalProfitUSDC: number
  todayProfitUSDC: number
  totalTrades: number
  todayTrades: number
  ordersSkippedToday: number

  // Grid
  gridMin: number
  gridMax: number
  gridLevels: number
  gridConfig: string
  openOrders: number

  // Capas
  layer3Bias: 'bullish' | 'bearish' | 'neutral'
  layer3LastAction: string
  capitalEfficiency: number

  // Mercado
  pair: string
  mode: string

  // Acciones
  updateFromSSE: (event: SSEEvent) => void
  updateFromStatus: (data: StatusResponse) => void
  setSSEConnected: (connected: boolean) => void
}
```

### Datos clave del Dashboard

**Header:**
- Precio actual con indicador verde/rojo (up/down)
- Indicador Live (SSE conectado)
- Badge de estado: CORRIENDO / EN PAUSA / DETENIDO
- Badge modo: TESTNET / PRODUCCIÓN

**Cards de Capital (5 cards):**
1. **Total {BASE}** = totalBase (desde botState o liveBalance)
2. **Capital Activo** = activeUSDC en USDC
3. **Ganancia Total** = totalProfitUSDC con color verde/rojo
4. **Trades Hoy** = todayTrades (con ordersSkippedToday como sub-label)
5. **Total Trades** = totalTrades

**Panel del Grid:**
- Rango: gridMin → gridMax con barra de progreso del precio actual
- Niveles y configuración activa
- Órdenes abiertas

**Panel de Capas:**
- Sesgo del agente (BULLISH/BEARISH/NEUTRAL)
- Acción recomendada
- Órdenes saltadas hoy
- Banner de pausa si isPaused

**Botones de control:**
- Iniciar Bot (abre modal con análisis previo)
- Detener Bot (con confirmación)
- Rebalancear (con confirmación)
- Analizar Mercado
- Consultar Agente
- Reanudar (solo visible cuando isPaused = true)

---

## 15. Configuración y Constantes

```typescript
// lib/config.ts

export const BINANCE_FEE_PERCENT = 0.1       // 0.1% por operación en Binance
export const MIN_LEVEL_SEPARATION = 0.25     // % mínimo entre niveles del grid
export const MAIN_LOOP_INTERVAL_MS = 30_000  // 30 segundos entre ciclos del bot
export const REANALYSIS_CRON = '0 */4 * * *' // Cada 4 horas
export const LAYER3_MIN_INTERVAL_MS = 15 * 60 * 1000  // 15 min entre llamadas Capa 3
export const PRICE_BROADCAST_INTERVAL_MS = 5_000  // Broadcast precio cada 5s

// 3 configuraciones predefinidas del grid
export const GRID_CONFIGS: Record<GridConfigName, GridConfig> = {
  conservative: {
    name: 'conservative',
    label: 'Conservador 🟢',
    gridLevels: 8,
    gridRangePercent: 6,
    description: 'Pocos niveles, rango moderado. Ideal para mercados laterales suaves.',
    idealFor: 'Baja volatilidad, tendencias moderadas',
    minProfitPerCycle: 0.4,
  },
  balanced: {
    name: 'balanced',
    label: 'Balanceado 🟡',
    gridLevels: 12,
    gridRangePercent: 8,
    description: 'Balance entre frecuencia y rango. Funciona bien en la mayoría de condiciones.',
    idealFor: 'Volatilidad moderada',
    minProfitPerCycle: 0.47,
  },
  aggressive: {
    name: 'aggressive',
    label: 'Agresivo 🔴',
    gridLevels: 20,
    gridRangePercent: 10,
    description: 'Muchos niveles, rango amplio. Máxima frecuencia de trades.',
    idealFor: 'Alta volatilidad, mercados activos',
    minProfitPerCycle: 0.3,
  },
}

// Función de selección de config
// conservative: capital < $100 | tendencia fuerte | volatilidad < 3%
// balanced: volatilidad 3-6%
// aggressive: volatilidad >= 6%
```

---

## 16. Instrucciones de Implementación

### Setup inicial

```bash
npx create-next-app@latest bot-nextjs --typescript --tailwind --app --src-dir=false
cd bot-nextjs

# Dependencias de trading
npm install ccxt@4 parse @anthropic-ai/sdk technicalindicators

# UI
npm install zustand @tanstack/react-query recharts
npx shadcn@latest init
npx shadcn@latest add card badge button dialog slider progress

# Servidor
npm install winston node-cron

# Dev
npm install -D @types/node-cron
```

### Notas críticas de implementación

1. **Singleton del Runtime**: El objeto `runtime` debe vivir en `lib/runtime.ts` como singleton global usando el patrón `globalThis` para sobrevivir hot-reloads en development:
   ```typescript
   const globalForRuntime = globalThis as any
   export const runtime: BotRuntime = globalForRuntime.botRuntime ?? createInitialRuntime()
   if (!globalForRuntime.botRuntime) globalForRuntime.botRuntime = runtime
   ```

2. **No usar Edge Runtime**: Los Route Handlers que usen CCXT, Parse, Winston o node-cron deben tener `export const runtime = 'nodejs'` al inicio del archivo.

3. **Scheduler en Next.js**: `setInterval` y `node-cron` solo funcionan en el proceso Node.js, no en Edge. Usar un Route Handler con inicialización lazy o un middleware de inicialización en `middleware.ts`.

4. **Back4App Parse SDK**: Usar `parse/node` (no `parse`) para el lado servidor. Inicializar en un singleton que detecte si ya está inicializado.

5. **CCXT en Next.js**: Funciona correctamente en el lado servidor. El singleton del exchange debe usar el mismo patrón `globalThis`.

6. **Rate Limiting**: Implementar con `next-rate-limit` o manualmente en middleware. El dashboard hace muchas requests — configurar al menos 120 requests/minuto.

7. **Seguridad**:
   - El dashboard solo debe ser accesible en localhost (no deployar en Vercel público con credenciales reales)
   - Las API Keys de Binance solo deben estar en variables de servidor (no `NEXT_PUBLIC_*`)
   - CSP headers via `next.config.js`

8. **Compatibilidad con datos existentes de Back4App**: Los campos de la colección `BotState` usan nombres legacy (`totalBTC`, `reserveBTC`, `activeBTC`, `totalProfitBTC`). Al leer/escribir mantener esa distinción:
   ```typescript
   // Escribir al DB:
   obj.set('totalBTC', state.totalBase)      // campo DB = 'totalBTC'
   // Leer del DB:
   totalBase: obj.get('totalBTC') ?? 0       // prop TS = totalBase
   ```

9. **Manejo de errores en API routes**: Nunca exponer stack traces. Siempre retornar `{ success: false, error: 'mensaje genérico' }` al cliente.

10. **Mock completo**: Cuando `MOCK_BALANCE=true`, mockear:
    - `readAccountBalance()`
    - `placeLimitOrder()`
    - `placeMarketOrder()`
    - `fetchOpenOrders()`
    - `fetchClosedOrders()`
    - `cancelOrder()` / `cancelAllOrders()`
    - `verifyBinanceConnection()`

---

*Documento generado el 2026-03-22. Versión del proyecto fuente: BotCryptoIA v2.*
