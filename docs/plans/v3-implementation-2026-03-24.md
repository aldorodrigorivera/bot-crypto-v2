# Plan de Implementación — Grid Trading Bot v3

**Fecha:** 2026-03-24
**Basado en:** `docs/requirements/v3.md`
**Autor del análisis:** Claude Code (claude-sonnet-4-6)

---

## 1. Resumen Ejecutivo

v3 agrega tres capacidades al bot existente:

1. **Backtesting Engine** — valida históricamente que la configuración de grid funciona antes de operar con dinero real
2. **Incubation Manager** — puente entre backtest y operación real a tamaño completo (escalado gradual)
3. **Multi-Config Runner** — compara las 3 configs (conservative/balanced/aggressive) y elige la mejor

### Adaptación de Arquitectura

El `requirements/v3.md` fue escrito asumiendo una arquitectura Express + Alpine.js + HTMX.
El proyecto real usa **Next.js 14+ App Router + React + Zustand + SSE**.
Este plan adapta cada módulo al stack real:

| v3 requirements dice | Proyecto real usa |
|---|---|
| `src/routes/dashboard.ts` (Express) | `app/api/**/route.ts` (Next.js) |
| WebSocket events | SSE via `lib/sse.ts` + `broadcastSSE()` |
| Alpine.js store | Zustand store (`store/bot.ts`) |
| HTMX partials | React components con React Query |
| `src/database/` | `lib/database/` |
| `src/bot/scheduler.ts` | `lib/bot/scheduler.ts` |

---

## 2. Análisis de Impacto — Archivos Existentes

### Archivos que NO se tocan (regla crítica)
```
lib/analysis/layer1-risk.ts
lib/analysis/layer2-probability.ts
lib/analysis/layer3-agent.ts
lib/analysis/market.ts
lib/analysis/positionSizer.ts
lib/analysis/config-selector.ts
lib/analysis/balance.ts
lib/bot/risk.ts
lib/bot/session.ts
lib/bot/orderSplitter.ts
lib/bot/sessionReport.ts
lib/exchange/binance.ts
lib/exchange/orders.ts
lib/database/botState.ts
lib/database/trades.ts
lib/database/gridOrders.ts
lib/database/tradingSessions.ts
lib/database/marketAnalysis.ts
lib/database/layerAnalysis.ts
lib/database/gridEfficiency.ts
lib/database/config.ts
lib/database/client.ts
lib/logger.ts
lib/sse.ts
lib/runtime.ts
app/api/bot/*
app/api/market/*
app/api/layers/*
app/api/grid/*
app/api/trades/*
app/api/events/*
app/api/profit/*
app/api/sessions/*
app/api/efficiency/*
app/api/config/*
app/api/status/*
```

### Archivos que SE MODIFICAN
```
lib/config.ts          → agregar vars de backtest/incubación
lib/types.ts           → agregar nuevas interfaces
lib/bot/scheduler.ts   → insertar flujo de backtest pre-arranque
lib/bot/engine.ts      → integrar incubationMultiplier al sizing
lib/bot/grid.ts        → SOLO si se extrae buildGridLevels a función pura compartida
store/bot.ts           → agregar estado backtest e incubación
.env.local / .env.example → nuevas variables de entorno
```

### Archivos NUEVOS a crear
```
# Backtesting
lib/backtesting/dataLoader.ts
lib/backtesting/simulator.ts
lib/backtesting/metrics.ts
lib/backtesting/runner.ts
lib/backtesting/engine.ts

# Grid lógica compartida (extraída de grid.ts)
lib/bot/gridBuilder.ts         → función pura buildGrid() compartida

# Incubación
lib/incubation/manager.ts
lib/incubation/scaler.ts
lib/incubation/monitor.ts

# Base de datos
lib/database/backtestResults.ts
lib/database/incubationState.ts

# API Routes (Next.js)
app/api/backtest/latest/route.ts
app/api/backtest/history/route.ts
app/api/backtest/run/route.ts
app/api/incubation/status/route.ts
app/api/incubation/history/route.ts
app/api/metrics/performance/route.ts

# Dashboard components
components/dashboard/BacktestPanel.tsx
components/dashboard/IncubationPanel.tsx
components/dashboard/PerformanceComparisonPanel.tsx
```

---

## ⚠️ CORRECCIONES AL PLAN ORIGINAL — Revisión del código fuente real

Tras leer los archivos críticos se encontraron **5 errores que romperían el build**:

### Corrección 1 — `SSEEventType` debe actualizarse (TypeScript strict)

`broadcastSSE()` en `lib/sse.ts` acepta `type: SSEEventType`. Llamar
`broadcastSSE('backtest_started', {})` sin añadir `'backtest_started'` al union
en `lib/types.ts` **falla en TypeScript strict**. Los nuevos tipos SSE deben
agregarse al union antes de usarlos.

### Corrección 2 — `AppConfig` interface debe actualizarse

`getAppConfig()` retorna `AppConfig` (tipado en `lib/types.ts`). Agregar
`backtest`, `incubation`, `multiConfig` solo en `lib/config.ts` sin actualizar
la interface en `lib/types.ts` **rompe TypeScript strict**.

### Corrección 3 — `gridBuilder.ts` es innecesario

`buildGridLevels()` en `lib/bot/grid.ts` **ya es una función pura** (no usa
estado, no tiene side-effects, solo importa constantes). El simulador puede
importarla directamente. Crear `gridBuilder.ts` es complejidad innecesaria.

### Corrección 4 — `BotRuntime` no puede tener una instancia de clase `IncubationManager`

`BotRuntime` está en `lib/types.ts`. Si añadimos `incubationManager: IncubationManager`
allí, `lib/types.ts` importaría de `lib/incubation/manager.ts` que a su vez
importaría de `lib/types.ts` → **circular import, falla en build**.

**Solución:** Agregar `incubationSizeMultiplier: number` (valor primitivo) al
`BotRuntime`. El módulo de incubación actualiza ese campo; `engine.ts` lo lee.
Sin importaciones circulares.

### Corrección 5 — `BotStopReason` union necesita el nuevo valor

La incubación puede abortar el bot con `stopReason = 'incubation_loss_limit'`.
Este valor no existe en `BotStopReason`. Hay que añadirlo o el tipado fallará
en `executeEmergencyStop` y en `markBotAsStopped`.

---

## 3. Nuevos Tipos (lib/types.ts)

Modificar `lib/types.ts` — todas las secciones que se tocan:

```typescript
// 1. Agregar a BotStopReason (línea 7 actual):
export type BotStopReason = 'manual' | 'stop_loss_range' | 'stop_loss_global'
  | 'daily_limit' | 'error' | 'profit_target_reached' | 'trailing_stop_profit'
  | 'incubation_loss_limit'  // ← NUEVO

// 2. Agregar a SSEEventType (línea 11 actual):
export type SSEEventType =
  | 'price_update' | 'trade_executed' | 'order_placed' | 'layer_analysis'
  | 'agent_response' | 'bot_status_change' | 'grid_rebuild' | 'risk_alert'
  | 'efficiency_update'
  // NUEVOS v3:
  | 'backtest_started'
  | 'backtest_completed'
  | 'incubation_update'
  | 'incubation_phase_change'
  | 'incubation_completed'
  | 'incubation_aborted'

// 3. Agregar a AppConfig (tras el bloque 'bot:', línea ~318 actual):
//    (también agregar los campos correspondientes a getAppConfig() en lib/config.ts)
backtest: {
  enabled: boolean
  days: number
  minTrades: number
  minWinRate: number
  minProfitFactor: number
  maxDrawdown: number
  minSharpe: number
}
incubation: {
  enabled: boolean
  minSize: number
  durationDays: number
  minTrades: number
  targetWinRate: number
  maxLossPercent: number
}
multiConfig: {
  enabled: boolean
}

// 4. Agregar a BotRuntime (tras 'pauseUntil', línea ~353 actual):
//    Solo valores primitivos — NO instancias de clase (evita circular imports)
lastBacktestFailed: boolean
lastBacktestMetrics: BacktestMetrics | null
incubationSizeMultiplier: number   // 1.0 = sin efecto; < 1 = incubación activa

// 5. Agregar al final del archivo — nuevas interfaces:

// ─── BACKTESTING ──────────────────────────────────────────────────────────────

interface OHLCVCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface SimulatedTrade {
  type: 'buy' | 'sell'
  price: number
  amount: number
  timestamp: number
  fee: number
  profit?: number      // solo en sells
  cycleId: string
}

interface SimulationResult {
  trades: SimulatedTrade[]
  finalCapital: number
  startCapital: number
  totalReturn: number
  durationDays: number
}

interface BacktestMetrics {
  winRate: number
  profitFactor: number
  sharpeRatio: number
  maxDrawdown: number
  totalTrades: number
  completedCycles: number
  totalReturn: number
  avgProfitPerCycle: number
  avgDuration: number
  totalFeesPaid: number
  netProfitUSDC: number
  gridBreaks: number
  passed: boolean
  failedReasons: string[]
  score: number
}

interface MultiConfigResult {
  conservative: BacktestMetrics
  balanced: BacktestMetrics
  aggressive: BacktestMetrics
  winner: GridConfigName
  winnerReason: string
}

// ─── INCUBACIÓN ───────────────────────────────────────────────────────────────

type IncubationPhase = 'micro' | 'small' | 'medium' | 'normal'

interface IncubationState {
  isActive: boolean
  startedAt: Date
  currentPhase: IncubationPhase
  realTrades: number
  realWinRate: number
  realProfitFactor: number
  currentSizeMultiplier: number
  totalRealProfitBTC: number
  totalRealLossBTC: number
  passedAt?: Date
  phaseHistory?: Array<{ phase: IncubationPhase; startedAt: Date; reason: string }>
  abortedAt?: Date
  abortReason?: string
}
```

---

## 4. Nuevas Variables de Entorno

Agregar a `.env.local` y `.env.example`:

```env
# ─── BACKTESTING ────────────────────────────────────────────────
BACKTEST_ENABLED=true
BACKTEST_DAYS=90
BACKTEST_MIN_TRADES=50
BACKTEST_MIN_WIN_RATE=55
BACKTEST_MIN_PROFIT_FACTOR=1.3
BACKTEST_MAX_DRAWDOWN=15
BACKTEST_MIN_SHARPE=0.8

# ─── INCUBACIÓN ─────────────────────────────────────────────────
INCUBATION_ENABLED=true
INCUBATION_MIN_SIZE=0.0001
INCUBATION_DURATION_DAYS=7
INCUBATION_MIN_TRADES=30
INCUBATION_TARGET_WIN_RATE=55
INCUBATION_MAX_LOSS_PERCENT=5

# ─── MULTI-CONFIG ───────────────────────────────────────────────
MULTI_CONFIG_ENABLED=false
```

Agregar a `getAppConfig()` en `lib/config.ts`:
```typescript
backtest: {
  enabled: process.env.BACKTEST_ENABLED !== 'false',
  days: parseInt(process.env.BACKTEST_DAYS ?? '90'),
  minTrades: parseInt(process.env.BACKTEST_MIN_TRADES ?? '50'),
  minWinRate: parseFloat(process.env.BACKTEST_MIN_WIN_RATE ?? '55'),
  minProfitFactor: parseFloat(process.env.BACKTEST_MIN_PROFIT_FACTOR ?? '1.3'),
  maxDrawdown: parseFloat(process.env.BACKTEST_MAX_DRAWDOWN ?? '15'),
  minSharpe: parseFloat(process.env.BACKTEST_MIN_SHARPE ?? '0.8'),
},
incubation: {
  enabled: process.env.INCUBATION_ENABLED !== 'false',
  minSize: parseFloat(process.env.INCUBATION_MIN_SIZE ?? '0.0001'),
  durationDays: parseInt(process.env.INCUBATION_DURATION_DAYS ?? '7'),
  minTrades: parseInt(process.env.INCUBATION_MIN_TRADES ?? '30'),
  targetWinRate: parseFloat(process.env.INCUBATION_TARGET_WIN_RATE ?? '55'),
  maxLossPercent: parseFloat(process.env.INCUBATION_MAX_LOSS_PERCENT ?? '5'),
},
multiConfig: {
  enabled: process.env.MULTI_CONFIG_ENABLED === 'true',
},
```

---

## 5. Plan Fase por Fase

### FASE 1 — Base de Datos (sin romper nada)

**Objetivo:** Crear los 2 módulos de database nuevos antes de que sean necesarios.

#### 1.1 `lib/database/backtestResults.ts`

```typescript
// Colección: BacktestResult en Back4App
// Campos: pair, configName, gridLevels, gridRangePercent, periodDays,
//         startDate, endDate, totalTrades, completedCycles,
//         winRate, profitFactor, sharpeRatio, maxDrawdown,
//         totalReturn, netProfitUSDC, totalFeesPaid, gridBreaks,
//         score, passed, failedReasons (Array), ranAt, usedForLaunch

export async function saveBacktestResult(result: BacktestRecord): Promise<void>
export async function getLatestBacktestResult(): Promise<BacktestRecord | null>
export async function getBacktestHistory(limit?: number): Promise<BacktestRecord[]>
```

#### 1.2 `lib/database/incubationState.ts`

```typescript
// Colección: IncubationState en Back4App
// Campos: isActive, currentPhase, startedAt, realTrades,
//         realWinRate, realProfitFactor, currentSizeMultiplier,
//         totalRealProfitBTC, totalRealLossBTC, phaseHistory (Array),
//         passedAt, abortedAt, abortReason

export async function getIncubationState(): Promise<IncubationState | null>
export async function saveIncubationState(state: IncubationState): Promise<void>
export async function clearIncubationState(): Promise<void>
```

**Patrón a seguir:** Igual que `lib/database/botState.ts` — Parse Object con `upsert` via `objectId` fijo o `query.first()`.

---

### FASE 2 — Backtesting Engine (módulo completamente nuevo)

**Objetivo:** Motor completo de backtesting que no interactúa con código existente.

#### 2.1 ~~`lib/bot/gridBuilder.ts`~~ — CANCELADO (ver Corrección 3)

`buildGridLevels()` en `lib/bot/grid.ts` **ya es una función pura**. No tiene
side-effects, solo usa `MIN_LEVEL_SEPARATION` de config y tipos. El simulador
simplemente la importa directamente:

```typescript
// En lib/backtesting/simulator.ts:
import { buildGridLevels, calculateCycleProfit } from '../bot/grid'
// No se crea gridBuilder.ts
```

#### 2.2 `lib/backtesting/dataLoader.ts`

```typescript
// Cache en memoria con expiración 30 minutos
const cache = new Map<string, { data: OHLCVCandle[]; expiresAt: number }>()

export async function loadHistoricalData(config: {
  pair: string
  timeframe: '15m'
  days: number
}): Promise<OHLCVCandle[]>
// Usa getExchange() de lib/exchange/binance.ts
// Fetches en lotes de 1000 velas (límite Binance)
// Loguea progreso via logger de lib/logger.ts
```

#### 2.3 `lib/backtesting/simulator.ts`

```typescript
export async function simulateGrid(config: {
  candles: OHLCVCandle[]
  gridLevels: number
  gridRangePercent: number
  baseAmount: number
  feePercent: number
  pair: string
}): Promise<SimulationResult>
```

**Algoritmo detallado:**
1. Inicialización: tomar `candles[0].open` como precio inicial
2. `buildGrid()` de `lib/bot/gridBuilder.ts` para construir niveles
3. Por cada vela, evaluar HIGH (ventas) y LOW (compras) en ese orden
4. Si precio sale del rango → registrar `gridBreak`, reconstruir grid centrado en `close`
5. Aplicar fee 0.1% en cada orden ejecutada
6. Calcular `profit` de cada ciclo = `(sellPrice - buyPrice) × amount - fee_buy - fee_sell`

#### 2.4 `lib/backtesting/metrics.ts`

```typescript
export function calculateMetrics(
  result: SimulationResult,
  benchmarks: AppConfig['backtest']
): BacktestMetrics

// Cálculos:
// winRate: ciclos con profit > 0 / totalCycles × 100
// profitFactor: sumGains / abs(sumLosses) — si sumLosses=0 → Infinity
// sharpeRatio: avgReturn / stdReturn × sqrt(estimatedCyclesPerYear)
// maxDrawdown: equity curve peak-to-trough analysis
// score: (winRate × 0.30) + (min(PF,3)/3×100 × 0.30) + (min(sharpe,3)/3×100 × 0.20) + ((20-min(DD,20))/20×100 × 0.20)
```

#### 2.5 `lib/backtesting/runner.ts`

Solo activo si `MULTI_CONFIG_ENABLED=true`.

```typescript
export async function runMultiConfigBacktest(
  candles: OHLCVCandle[]
): Promise<MultiConfigResult>
// Corre simulator.ts 3 veces (conservative, balanced, aggressive)
// en PARALELO con Promise.all()
// Calcula métricas para cada una
// Retorna winner = config con mayor score
// Si winner.passed = false → ninguna pasó (bot no debe arrancar)
```

#### 2.6 `lib/backtesting/engine.ts`

Orquestador principal. Es el único punto de entrada para el backtest desde `scheduler.ts`.

```typescript
export interface BacktestRunResult {
  metrics: BacktestMetrics
  configName: GridConfigName
  multiConfig?: MultiConfigResult
  formattedOutput: string   // el bloque visual para console
}

export async function runBacktest(
  overrideConfig?: GridConfigName
): Promise<BacktestRunResult>
// 1. Leer config desde getAppConfig()
// 2. Si BACKTEST_ENABLED=false → retornar mock passed=true
// 3. dataLoader.ts → obtener candles
// 4. Si MULTI_CONFIG_ENABLED → runner.ts → elegir ganadora
// 5. Si no → simular con config actual
// 6. metrics.ts → calcular métricas
// 7. saveBacktestResult() → guardar en Back4App
// 8. Formatear output de consola (el bloque visual)
// 9. Retornar BacktestRunResult
```

---

### FASE 3 — Integración con el Arranque

**Objetivo:** Insertar el backtest en `scheduler.ts` respetando el flujo existente.

#### 3.1 Modificación a `lib/bot/scheduler.ts`

**Punto de inserción:** Después del análisis de mercado y antes de la inicialización del grid.

```typescript
// FLUJO EXISTENTE (no cambiar):
// 1. Verificar balances y condiciones
// 2. Análisis de mercado → getMarketAnalysis()
// 3. Selección de config → selectGridConfig()
// 4. [INSERTAR AQUÍ] ─────────────────────────────────────────

// NUEVO BLOQUE (agregar):
if (config.backtest.enabled) {
  broadcastSSE('backtest_started', {})
  const btResult = await runBacktest()
  console.log(btResult.formattedOutput)   // output visual en consola
  broadcastSSE('backtest_completed', btResult.metrics)

  if (!btResult.metrics.passed) {
    // En modo servidor Next.js no hay readline interactivo
    // → Loguear advertencia prominente pero NO bloquear
    // → Guardar flag en runtime para que el dashboard lo muestre
    logger.warn('BACKTEST NO APROBADO', { reasons: btResult.metrics.failedReasons })
    runtime.lastBacktestFailed = true
    runtime.lastBacktestReasons = btResult.metrics.failedReasons
  }
}

// 5. Continuar con el flujo normal de scheduler
```

> **Nota sobre readline:** `requirements/v3.md` describe una pregunta interactiva `(s/n)` en consola. En el contexto de Next.js esto no aplica. En su lugar, el backtest fallido se registra en `runtime` y se expone via SSE/API para que el dashboard muestre la alerta al operador. El bot **arranca de todas formas** pero con advertencia visible.

> **Alternativa más fiel:** Si se quiere bloqueo real, la validación puede hacerse en `POST /api/bot/start` — retornar `{ success: false, backtestFailed: true, reasons: [...] }` y que el frontend muestre el modal de confirmación antes de reintentar con `{ forceStart: true }`.

**Recomendación:** Implementar la variante API (más robusta y no bloquea el servidor).

#### 3.2 Agregar a BotRuntime en `lib/runtime.ts` (ver Corrección 4)

Solo valores primitivos — nada de instancias de clase ni importaciones cruzadas:

```typescript
// En lib/types.ts, interface BotRuntime (tras 'pauseUntil'):
lastBacktestFailed: boolean
lastBacktestMetrics: BacktestMetrics | null
incubationSizeMultiplier: number   // 1.0 = sin efecto

// En lib/runtime.ts, createInitialRuntime():
lastBacktestFailed: false,
lastBacktestMetrics: null,
incubationSizeMultiplier: 1.0,
```

---

### FASE 4 — Incubación

**Objetivo:** Sistema de escalado gradual de tamaño de órdenes.

#### 4.1 `lib/incubation/manager.ts` (patrón singleton como runtime.ts)

Exporta funciones, no clase. Evita instancias en `BotRuntime` (Corrección 4).

```typescript
// Estado interno en memoria (no en BotRuntime para no crear circular imports)
let _state: IncubationState | null = null

export async function loadIncubationState(): Promise<void>
// Lee IncubationState de Back4App
// Si existe y isActive=true → retomar desde donde estaba
// Si no → crear estado inicial fase 'micro'
// Actualiza runtime.incubationSizeMultiplier con el valor persistido

export function getIncubationState(): IncubationState | null
// Retorna _state (para uso en API endpoints)

export async function recordIncubationTrade(profit: number, isWin: boolean): Promise<void>
// Actualiza realTrades, realWinRate, realProfitFactor en _state
// Llama a evaluateScaling() de scaler.ts
// Si escala → actualiza runtime.incubationSizeMultiplier + broadcastSSE
// Si completa → runtime.incubationSizeMultiplier = 1.0 + broadcastSSE
// Si aborta → llama executeEmergencyStop() + broadcastSSE
// Guarda en Back4App cada 10 trades
```

**Persistencia entre reinicios:** En `startBot()` de `scheduler.ts`:
```typescript
if (config.incubation.enabled) {
  await loadIncubationState()
  // runtime.incubationSizeMultiplier se actualiza dentro de loadIncubationState()
}
```

**En `engine.ts`**, al registrar un trade de tipo sell completado:
```typescript
if (filledSide === 'sell' && config.incubation.enabled) {
  await recordIncubationTrade(profit, profit > 0).catch(() => {})
}
```

#### 4.2 `lib/incubation/scaler.ts`

```typescript
// Lógica pura de evaluación de criterios de escalado
export function evaluateScaling(state: IncubationState, config: AppConfig['incubation']): {
  shouldScale: boolean
  nextPhase?: IncubationPhase
  shouldAbort: boolean
  abortReason?: string
}
// MICRO → SMALL: >= 10 trades Y winRate >= 50%
// SMALL → MEDIUM: >= 20 trades Y winRate >= 53% Y pérdida < maxLossPercent
// MEDIUM → NORMAL: >= minTrades Y >= durationDays Y winRate >= targetWinRate Y pérdida < maxLossPercent
// ABORT: pérdida > maxLossPercent en cualquier fase
```

#### 4.3 `lib/incubation/monitor.ts`

```typescript
export function getIncubationStatus(state: IncubationState, config: AppConfig['incubation']): {
  progressToNextPhase: number  // 0-100%
  tradesNeeded: number
  daysNeeded: number
  winRateNeeded: number
  currentLossPercent: number
}
// Cálculo de qué le falta para pasar a la siguiente fase
// Usado por el API endpoint /api/incubation/status
```

#### 4.4 Integración en `lib/bot/engine.ts` (ver Corrección 4)

No se usa clase en runtime. Se lee el valor primitivo `runtime.incubationSizeMultiplier`:

```typescript
// engine.ts línea ~239 (existente):
const orderAmount = baseAmount * multiplier

// MODIFICACIÓN (2 líneas, no rompe nada):
const incubationMultiplier = runtime.incubationSizeMultiplier ?? 1.0
const orderAmount = baseAmount * multiplier * incubationMultiplier
```

El módulo de incubación actualiza `runtime.incubationSizeMultiplier` cuando
cambia de fase. `engine.ts` no importa nada de `lib/incubation/`.

---

### FASE 5 — API Routes (Next.js)

Cada archivo nuevo sigue el patrón de los existentes en `app/api/`:

#### `app/api/backtest/latest/route.ts`
```typescript
export const runtime = 'nodejs'
// GET → getLatestBacktestResult() + runtime.lastBacktestMetrics
```

#### `app/api/backtest/history/route.ts`
```typescript
export const runtime = 'nodejs'
// GET → getBacktestHistory(20)
```

#### `app/api/backtest/run/route.ts`
```typescript
export const runtime = 'nodejs'
// POST { configName?, days? } → runBacktest(configName) en background
// Responde inmediatamente con { success: true, message: "Backtest iniciado" }
// El resultado llega via SSE 'backtest_completed'
```

#### `app/api/incubation/status/route.ts`
```typescript
export const runtime = 'nodejs'
// GET → runtime.incubationState + getIncubationStatus()
```

#### `app/api/incubation/history/route.ts`
```typescript
export const runtime = 'nodejs'
// GET → leer phaseHistory de IncubationState en Back4App
```

#### `app/api/metrics/performance/route.ts`
```typescript
export const runtime = 'nodejs'
// GET → comparar BacktestMetrics (último backtest) vs métricas reales
//       calculadas desde getTradesSummary() de lib/database/trades.ts
// Retornar tabla comparativa: winRate, profitFactor, avgProfitPerCycle, feesPercent
// Divergencia = abs(real - backtest) / backtest × 100
```

---

### FASE 6 — Dashboard (Componentes React)

#### 6.1 Nuevas variables en Zustand store (`store/bot.ts`)

```typescript
// Agregar al BotStore existente:
backtest: {
  passed: boolean
  score: number
  winRate: number
  profitFactor: number
  maxDrawdown: number
  sharpe: number
  isRunning: boolean
  lastRunAt: string | null
  configName: string | null
  failedReasons: string[]
}
incubation: {
  isActive: boolean
  phase: IncubationPhase
  progressPercent: number
  realWinRate: number
  realPF: number
  daysIn: number
  tradesIn: number
}
```

#### 6.2 Nuevos SSE events en `lib/sse.ts`

Los eventos existentes no se modifican. Se agregan nuevos tipos en el switch del cliente:

```typescript
// Tipos SSE nuevos (en lib/types.ts si hay enum de eventos):
'backtest_started'    → payload: {}
'backtest_completed'  → payload: BacktestMetrics & { configName: string }
'incubation_update'   → payload: IncubationState
'incubation_phase_change' → payload: { newPhase, progressPercent }
'incubation_completed'    → payload: { passedAt: string }
'incubation_aborted'      → payload: { reason: string }
```

#### 6.3 `components/dashboard/BacktestPanel.tsx`

- Muestra: Win Rate, Profit Factor, Max Drawdown, Sharpe, Score, Veredicto
- Botón "Re-run" → POST `/api/backtest/run` → muestra spinner mientras `backtest.isRunning`
- Conectado a Zustand `backtest.*`
- React Query con `refetchInterval: 60000`
- Solo muestra si hay datos de backtest (`lastRunAt !== null`)

#### 6.4 `components/dashboard/IncubationPanel.tsx`

- Solo visible cuando `incubation.isActive = true`
- Muestra: fase actual (con indicador visual de progreso), trades reales vs mínimos, win rate real vs backtest, días en incubación, pérdida acumulada
- Conectado a Zustand `incubation.*`

#### 6.5 `components/dashboard/PerformanceComparisonPanel.tsx`

- Solo visible cuando `trades >= 20` (real)
- Tabla comparativa: Backtest vs Real para winRate, PF, avgProfitPerCycle, feesPercent
- Si divergencia > 20% en alguna métrica → mostrar alerta
- React Query a `/api/metrics/performance`

#### 6.6 Integración en `app/dashboard/page.tsx` o componente principal

```tsx
// Agregar entre MarketPanel y GridPanel (per requirements):
<BacktestPanel />
{/* Incubation solo si isActive */}
{incubation.isActive && <IncubationPanel />}
{/* Performance solo si hay suficientes trades */}
{totalTrades >= 20 && <PerformanceComparisonPanel />}
```

---

### FASE 7 — Testing y Verificación

Verificaciones manuales tras implementar:

```
[ ] npm run build --webpack sin errores TypeScript
[ ] Con BACKTEST_ENABLED=false: bot arranca igual que v2, sin cambios
[ ] Con BACKTEST_ENABLED=true: backtest corre, output en consola correcto
[ ] Con MULTI_CONFIG_ENABLED=true: las 3 configs se comparan, winner se selecciona
[ ] Con INCUBATION_ENABLED=false: sizeMultiplier = 1.0, sin cambios en sizing
[ ] Con INCUBATION_ENABLED=true: sizeMultiplier empieza en INCUBATION_MIN_SIZE
[ ] SSE events 'backtest_completed' e 'incubation_phase_change' llegan al cliente
[ ] BacktestPanel se muestra correctamente en el dashboard
[ ] IncubationPanel solo visible cuando isActive=true
[ ] Colecciones BacktestResult e IncubationState se crean en Back4App
[ ] Reinicio del bot con incubación activa → retoma desde el estado guardado
[ ] POST /api/backtest/run funciona desde el dashboard
[ ] GET /api/metrics/performance retorna comparación válida con >= 20 trades
```

---

## 6. Dependencias entre Fases

```
FASE 1 (DB) ──────────────────────────────────────────► independiente
FASE 2 (Backtest) ─► depende de FASE 1 (para saveBacktestResult)
FASE 3 (Scheduler) ─► depende de FASE 2 (para runBacktest)
FASE 4 (Incubación) ─► depende de FASE 1 (para saveIncubationState)
FASE 5 (API) ──────► depende de FASE 2 + FASE 4
FASE 6 (Dashboard) ─► depende de FASE 5
FASE 7 (Testing) ───► depende de todo lo anterior
```

**Orden de ejecución obligatorio:** 1 → 2 → 3 → 4 → 5 → 6 → 7

---

## 7. Riesgos e Incertidumbres

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| CCXT rate limiting al descargar 90 días de OHLCV | Alta | Cache de 30min + retry con backoff en `dataLoader.ts` |
| Back4App sin colecciones creadas (errores primera ejecución) | Baja | `saveBacktestResult` hace upsert, crea la colección implícitamente |
| `scheduler.ts` sin readline interactivo en Next.js | Confirmada | `forceStart` flag en `/api/bot/start`; backtest fallido no bloquea servidor |
| TypeScript strict: orden de edición importa | Alta | Empezar SIEMPRE por `lib/types.ts`; luego `lib/config.ts`; luego el resto |
| `calculateAmountPerLevel` en el simulador usa `activeUSDC` real | Media | El simulador usa `baseAmount × gridLevels` como capital ficticio, no balance real |

---

## 8. Archivos a Crear/Modificar — Lista Final

### Crear (19 archivos nuevos)
```
lib/backtesting/dataLoader.ts
lib/backtesting/simulator.ts
lib/backtesting/metrics.ts
lib/backtesting/runner.ts
lib/backtesting/engine.ts
lib/incubation/manager.ts
lib/incubation/scaler.ts
lib/incubation/monitor.ts
lib/database/backtestResults.ts
lib/database/incubationState.ts
app/api/backtest/latest/route.ts
app/api/backtest/history/route.ts
app/api/backtest/run/route.ts
app/api/incubation/status/route.ts
app/api/incubation/history/route.ts
app/api/metrics/performance/route.ts
components/dashboard/BacktestPanel.tsx
components/dashboard/IncubationPanel.tsx
components/dashboard/PerformanceComparisonPanel.tsx
```
(20 archivos nuevos)

### Modificar (8 archivos existentes)
```
lib/types.ts         → +BotStopReason 'incubation_loss_limit'
                       +SSEEventType (6 eventos nuevos)
                       +AppConfig.backtest/incubation/multiConfig sections
                       +BotRuntime.lastBacktestFailed, lastBacktestMetrics, incubationSizeMultiplier
                       +nuevas interfaces: OHLCVCandle, BacktestMetrics, IncubationState, etc.
lib/config.ts        → +3 secciones en getAppConfig() (backtest, incubation, multiConfig)
lib/runtime.ts       → +3 campos en createInitialRuntime()
lib/bot/scheduler.ts → +backtest pre-arranque + loadIncubationState (~30 líneas)
lib/bot/engine.ts    → +incubationSizeMultiplier en sizing (2 líneas)
                       +recordIncubationTrade en trade execution (2 líneas)
app/api/bot/start/route.ts → +soporte forceStart param para backtest fallido
store/bot.ts         → +backtest e incubation state en Zustand
.env.local           → +12 variables nuevas
.env.example         → +12 variables nuevas (con valores por defecto)
```

---

*Plan generado el 2026-03-24 basado en requirements/v3.md y análisis del código fuente actual.*
