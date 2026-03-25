# Plan de Implementación — Binance Rate Limits
**Fecha:** 2026-03-24
**Fuente:** `docs/analytics/binance-limits.md`
**Rama sugerida:** `feat/binance-limits`

---

## Resumen

El documento `binance-limits.md` identifica 5 cambios. El original está escrito para
Express + Alpine.js + HTMX. Este plan los adapta a nuestra arquitectura real:
**Next.js App Router + TypeScript + Zustand + SSE**.

---

## Cambios que NO son necesarios

| Lo que dice el doc | Por qué no aplica aquí |
|----|---|
| `src/routes/dashboard.ts` | No existe — usamos `app/api/status/route.ts` |
| `src/dashboard/index.html` + `x-data` | No usamos Alpine.js — usamos React + Zustand |
| `Alpine.store('bot')` | No existe — usamos `store/bot.ts` (Zustand) |
| `src/exchange/orders.ts` | La ruta sí existe pero diferente (`lib/exchange/orders.ts`) |

---

## Cambio 1 — `.env.example` (bajo riesgo)

**Archivo:** `.env.example`

### Qué cambiar

1. `MAX_DAILY_TRADES=200` → `MAX_DAILY_TRADES=1000`
2. Reemplazar el comentario existente de esa variable con:

```env
# ─── PROTECCIÓN DE TRADES ──────────────────────────────────────────
# IMPORTANTE: Este límite es NUESTRO, NO de Binance.
# Binance permite hasta 160,000 órdenes por día y 50 órdenes cada 10 segundos.
# Este valor protege contra bugs que generen órdenes en bucle infinito.
#
# Valores recomendados según etapa:
#   Testnet / desarrollo:         200   (detectar bugs sin riesgo)
#   Incubación (v3):              500   (conservador mientras se valida)
#   Producción normal:          1,000   (operación regular estable)
#   Grid agresivo (14+ niveles): 5,000  (alta frecuencia)
#   Solo límites de Binance:    50,000  (prácticamente sin límite propio)
#
# Límite real de Binance:  160,000 / día  (prácticamente inalcanzable)
#                               50 / 10s  (el más relevante para ráfagas)
MAX_DAILY_TRADES=1000
```

**Archivos afectados:** solo `.env.example`
**Riesgo:** nulo — no afecta código en ejecución

---

## Cambio 2 — Mensaje de log + comportamiento de pausa diaria (bajo riesgo)

**Archivos:** `lib/bot/risk.ts`, `lib/types.ts`, `lib/runtime.ts`

### Problema actual

En `lib/bot/risk.ts` la regla `daily_limit` devuelve `{ shouldStop: true }`,
lo que llama a `executeEmergencyStop` y detiene el bot completamente.
El `.env.example` dice "pausa hasta el día siguiente" pero el comportamiento real
es un stop permanente hasta que el usuario lo reinicia manualmente.

### 2a — Nuevo campo en `BotRuntime` (lib/types.ts)

Agregar `pausedForDailyLimit: boolean` al interface `BotRuntime`.
Esto permite distinguir una pausa por límite diario de una pausa por otro motivo.

```typescript
// En lib/types.ts, dentro de BotRuntime
pausedForDailyLimit: boolean
```

### 2b — Inicializar el campo (lib/runtime.ts)

```typescript
// En createInitialRuntime(), junto a los otros flags de pausa
pausedForDailyLimit: false,
```

### 2c — Cambiar comportamiento en risk.ts

```typescript
// ANTES (líneas ~38-40 en checkRiskRules):
if (runtime.dailyTradesCount >= maxDailyTrades) {
  return { shouldStop: true, reason: 'daily_limit' }
}

// DESPUÉS:
if (runtime.dailyTradesCount >= maxDailyTrades) {
  const msg =
    `Límite propio de trades diarios alcanzado (${maxDailyTrades}). ` +
    `Pausando hasta mañana. ` +
    `Nota: el límite real de Binance es 160,000/día. ` +
    `Puedes aumentar MAX_DAILY_TRADES en .env si lo necesitas.`
  logger.warn(msg)
  broadcastSSE('risk_alert', { message: msg })   // ← aparece como toast en el dashboard
  runtime.pausedForDailyLimit = true
  return { shouldPause: true, reason: 'daily_limit' }
}
```

Nota: `checkRiskRules` recibe `runtime` como parámetro — ya está disponible.
`broadcastSSE` y `logger` deben importarse en `risk.ts` si no están ya
(verificar el top del archivo — `logger` ya existe, agregar `broadcastSSE` de `'../sse'`).

### 2d — Auto-resume al día siguiente (risk.ts)

En `resetDailyCountersIfNeeded`, agregar al bloque que ya resetea contadores:

```typescript
export function resetDailyCountersIfNeeded(runtime: BotRuntime): void {
  const today = new Date().toISOString().slice(0, 10)
  if (runtime.dailyTradesDate !== today) {
    runtime.dailyTradesCount = 0
    runtime.ordersSkippedToday = 0
    runtime.dailyTradesDate = today
    // Auto-resume si la pausa fue únicamente por el límite diario
    if (runtime.pausedForDailyLimit) {
      runtime.isPaused = false
      runtime.pausedForDailyLimit = false
      const msg = 'Nuevo día — pausa por límite diario levantada automáticamente.'
      logger.info(msg)
      broadcastSSE('risk_alert', { message: msg })   // ← toast informativo en dashboard
      broadcastSSE('bot_status_change', { status: 'running' })
    }
  }
}
```

Ambos (`broadcastSSE` y `logger`) deben estar importados en `risk.ts` (ver nota del paso 2c).

**Archivos afectados:** `lib/types.ts`, `lib/runtime.ts`, `lib/bot/risk.ts`
**Riesgo:** bajo — el único cambio de comportamiento es `shouldStop` → `shouldPause` para
el caso `daily_limit`. El resto del flujo (pausa, SSE) ya existe.

---

## Cambio 3 — Rate limiter preventivo en orders.ts (riesgo medio)

**Archivo:** `lib/exchange/orders.ts`

### Objetivo

Proteger contra ráfagas al reconstruir el grid (puede colocar 14 órdenes de golpe).
Límite de Binance: 50 órdenes en 10 segundos. Usamos 90% = 45 como umbral.

### Estructura

Agregar estado module-level (persiste entre llamadas pero se resetea cada Next.js restart, lo cual es aceptable para un rate limiter):

```typescript
// Agregar al inicio de lib/exchange/orders.ts, después de los imports

interface RateLimiterState {
  count: number          // órdenes en la ventana actual
  windowStart: number    // timestamp ms del inicio de la ventana
}

const _rl: RateLimiterState = {
  count: 0,
  windowStart: Date.now(),
}

const BINANCE_ORDERS_PER_10S = 50
const RATE_LIMIT_THRESHOLD = 45 // 90% del límite real

/** Retorna el estado del rate limiter (para exponer en /api/status) */
export function getRateLimiterState(): Readonly<RateLimiterState & { limitBinance: number }> {
  return { count: _rl.count, windowStart: _rl.windowStart, limitBinance: BINANCE_ORDERS_PER_10S }
}

async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  if (now - _rl.windowStart >= 10_000) {
    _rl.count = 0
    _rl.windowStart = now
  }
  if (_rl.count >= RATE_LIMIT_THRESHOLD) {
    const waitMs = 10_000 - (now - _rl.windowStart)
    const msg =
      `Rate limit preventivo de Binance: esperando ${waitMs}ms ` +
      `(${_rl.count}/${BINANCE_ORDERS_PER_10S} órdenes en ventana actual)`
    logger.warn(msg)
    broadcastSSE('risk_alert', { message: msg })   // ← toast en dashboard
    await new Promise(res => setTimeout(res, waitMs))
    _rl.count = 0
    _rl.windowStart = Date.now()
  }
  _rl.count++
  return fn()
}
```

Esto requiere importar `broadcastSSE` de `'../sse'` en `orders.ts`.
No hay riesgo de circular imports: `sse.ts` no importa de `orders.ts`.
```

### Integrar en placeLimitOrder

```typescript
// ANTES:
export async function placeLimitOrder(...): Promise<ExchangeOrder> {
  if (isMock()) {
    // ... retorno mock
  }
  const exchange = getExchange()
  const order = await exchange.createLimitOrder(pair, side, amount, price)
  // ...
}

// DESPUÉS:
export async function placeLimitOrder(...): Promise<ExchangeOrder> {
  if (isMock()) {
    // ... retorno mock (sin cambios — mock no tiene rate limits)
  }
  return withRateLimit(async () => {
    const exchange = getExchange()
    const order = await exchange.createLimitOrder(pair, side, amount, price)
    // ... resto igual
  })
}
```

### Nota importante

El bot actual coloca máximo ~2-3 órdenes por ciclo de 15 segundos = ~0.1 órdenes/segundo.
Este rate limiter **nunca se activará en operación normal**. Solo protege en casos
excepcionales (grid rebuild completo de 14 niveles = 14 órdenes en ráfaga).

**Archivos afectados:** `lib/exchange/orders.ts` (+ import de `broadcastSSE` de `../sse`)
**Riesgo:** medio — wrappea la única función que coloca órdenes reales. Mock mode no cambia.

---

## Cambio 4 — Exponer rate limits en `/api/status` (bajo riesgo)

**Archivos:** `lib/types.ts`, `app/api/status/route.ts`

### 4a — Nuevo type en lib/types.ts

```typescript
// Agregar antes de StatusResponse
export interface RateLimitsInfo {
  dailyTradesUsed: number
  dailyTradesLimit: number         // nuestro límite (MAX_DAILY_TRADES)
  dailyTradesLimitBinance: number  // siempre 160_000
  dailyTradesPercent: number       // (used / limit) * 100
  ordersLast10s: number            // del rate limiter en orders.ts
  ordersLast10sLimitBinance: number // siempre 50
}
```

### 4b — Agregar al interface StatusResponse

```typescript
// En el interface StatusResponse, agregar:
rateLimits?: RateLimitsInfo
```

### 4c — Rellenar en app/api/status/route.ts

```typescript
import { getRateLimiterState } from '@/lib/exchange/orders'

// Dentro del GET handler, antes de construir `data`:
const rl = getRateLimiterState()
const maxDailyTrades = config.bot.maxDailyTrades

// Dentro del objeto `data: StatusResponse`:
rateLimits: {
  dailyTradesUsed: botRuntime.dailyTradesCount,
  dailyTradesLimit: maxDailyTrades,
  dailyTradesLimitBinance: 160_000,
  dailyTradesPercent: Math.round((botRuntime.dailyTradesCount / maxDailyTrades) * 100),
  ordersLast10s: rl.count,
  ordersLast10sLimitBinance: 50,
},
```

**Archivos afectados:** `lib/types.ts`, `app/api/status/route.ts`
**Riesgo:** bajo — solo agregar campo opcional a la respuesta existente

---

## Cambio 5 — Indicador en dashboard (React/Zustand — NO Alpine.js) (bajo riesgo)

> El doc usa Alpine.js + HTML. Nuestra adaptación usa Zustand + React + shadcn/ui.

**Archivos:** `store/bot.ts`, `components/dashboard/StatusCard.tsx`

### 5a — Agregar campos a Zustand store (store/bot.ts)

```typescript
// En el interface BotStore, agregar junto a todayTrades:
dailyTradesLimit: number
ordersLast10s: number

// En el initialState del create():
dailyTradesLimit: 1000,
ordersLast10s: 0,

// En updateFromStatus, dentro del set({}):
dailyTradesLimit: data.rateLimits?.dailyTradesLimit ?? 1000,
ordersLast10s: data.rateLimits?.ordersLast10s ?? 0,
```

### 5b — Mostrar indicador en StatusCard.tsx

Agregar un pequeño indicador de trades del día visible solo cuando el bot está corriendo.
Se coloca debajo del row de badges actual, en una línea separada:

```tsx
// Importar Progress de shadcn: import { Progress } from '@/components/ui/progress'
// Importar nuevos campos del store

// Leer del store:
const { ..., todayTrades, dailyTradesLimit } = useBotStore(useShallow(s => ({
  // ... campos actuales ...
  todayTrades: s.todayTrades,
  dailyTradesLimit: s.dailyTradesLimit,
})))

const dailyPercent = dailyTradesLimit > 0
  ? Math.min(100, Math.round((todayTrades / dailyTradesLimit) * 100))
  : 0

// Renderizar (solo cuando botStatus === 'running'):
{botStatus === 'running' && (
  <div className="mt-3 flex items-center gap-3">
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      Trades hoy: {todayTrades}/{dailyTradesLimit}
    </span>
    <Progress
      value={dailyPercent}
      className={cn(
        'h-1.5 flex-1',
        dailyPercent >= 90 ? '[&>div]:bg-red-500'
          : dailyPercent >= 70 ? '[&>div]:bg-yellow-500'
          : '[&>div]:bg-green-500'
      )}
    />
    <span className="text-xs text-muted-foreground w-10 text-right">
      {dailyPercent}%
    </span>
  </div>
)}
```

**Color coding:**
- Verde: 0–69% del límite diario
- Amarillo: 70–89%
- Rojo: ≥90%

**Archivos afectados:** `store/bot.ts`, `components/dashboard/StatusCard.tsx`
**Riesgo:** bajo — solo agrega UI opcional

---

## Orden de Implementación

```
1. lib/types.ts          → Agregar RateLimitsInfo, campo en StatusResponse, pausedForDailyLimit en BotRuntime
2. lib/runtime.ts        → Inicializar pausedForDailyLimit: false
3. .env.example          → Actualizar MAX_DAILY_TRADES y comentarios
4. lib/exchange/orders.ts → Agregar rate limiter + getRateLimiterState()
5. lib/bot/risk.ts       → Log mejorado, shouldPause, auto-resume
6. app/api/status/route.ts → Agregar rateLimits al response
7. store/bot.ts          → Agregar dailyTradesLimit, ordersLast10s
8. components/dashboard/StatusCard.tsx → Agregar indicador de progreso
```

---

## Lo que NO cambia (confirmado)

```
✅ lib/bot/engine.ts         — sin cambios
✅ lib/bot/scheduler.ts      — sin cambios
✅ lib/bot/grid.ts           — sin cambios
✅ lib/analysis/*            — sin cambios
✅ lib/database/*            — sin cambios
✅ lib/backtesting/*         — sin cambios
✅ lib/incubation/*          — sin cambios
✅ Colecciones Back4App       — sin cambios
✅ Todos los demás endpoints — sin cambios
```

---

## Verificación Post-Implementación

```
1. npm run build → 0 errores TypeScript
2. GET /api/status → respuesta incluye campo rateLimits con los 6 subcampos
3. Dashboard → StatusCard muestra "Trades hoy: X/1000" con barra de progreso
4. En desarrollo con MOCK_BALANCE=true: rate limiter no activa wait (mock bypass)
5. Log al llegar a MAX_DAILY_TRADES incluye mención al límite real de Binance
6. Al arrancar el día siguiente (o simular dailyTradesDate distinta), bot auto-reanuda si estaba pausado por daily_limit
```

---

## Notas de Riesgo

- El rate limiter en `orders.ts` es **state module-level** (no en `globalThis`). Si
  Next.js hace hot-reload del módulo, el contador se resetea — comportamiento correcto
  para un rate limiter de ventana corta (10 segundos).
- `pausedForDailyLimit` se pierde si el servidor se reinicia (es in-memory).
  Al reiniciar, el bot arranca no-pausado con `dailyTradesCount = 0`, lo cual es
  el comportamiento correcto (nuevo proceso = nuevo día operativo).
- El campo `rateLimits` en `StatusResponse` es opcional (`?`) para no romper
  clientes que pudieran no esperar el campo.
