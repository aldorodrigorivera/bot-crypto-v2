# Plan de Implementación — v5 Liquidity-Biased Grid
**Fecha:** 2026-03-26
**Basado en:** docs/requirements/v5.md

---

## Resumen ejecutivo

v5 agrega un módulo PRE-GRID que analiza 4 señales de liquidez en tiempo real
(OBI, CVD, LiquidityMap, FundingRate) y construye el grid de forma asimétrica:
más niveles en la dirección donde hay mayor probabilidad de movimiento.

Las 3 capas existentes no se tocan. Solo se añade contexto a la Capa 3.

---

## Inventario completo de cambios

### Archivos nuevos (7)

| Archivo | Responsabilidad |
|---|---|
| `lib/analysis/orderFlowTracker.ts` | Calcula OBI y CVD desde order book y trades recientes |
| `lib/analysis/liquidityMap.ts` | Identifica clusters de soporte/resistencia desde OHLCV + order book profundo |
| `lib/analysis/liquidityAnalyzer.ts` | Combina las 4 señales → `GridBias`. Algoritmo de ponderación. |
| `lib/database/liquiditySnapshots.ts` | Guarda/lee `LiquiditySnapshot` en Back4App |
| `app/api/liquidity/latest/route.ts` | GET último snapshot |
| `app/api/liquidity/history/route.ts` | GET historial de snapshots |
| `app/api/liquidity/analyze/route.ts` | POST forzar re-análisis desde dashboard |
| `components/dashboard/LiquidityPanel.tsx` | Panel visual en el dashboard |

### Archivos modificados (8)

| Archivo | Qué cambia |
|---|---|
| `lib/types.ts` | Nuevas interfaces: `GridBias`, `OBIResult`, `CVDResult`, `LiquidityMap`, `LiquidityLevel`, `FundingRateResult`, `LiquiditySnapshot` |
| `lib/bot/grid.ts` | `buildGridLevels(price, config, bias?)` acepta bias opcional → grid asimétrico |
| `lib/bot/scheduler.ts` | Llama a `LiquidityAnalyzer` antes de `buildGrid`, pasa bias, re-análisis cada 2h |
| `lib/analysis/layer3-agent.ts` | Agrega sección de liquidez al prompt de Claude |
| `lib/sse.ts` | Nuevos eventos: `liquidity_analysis_completed`, `grid_bias_changed` |
| `store/bot.ts` | Nuevas variables de estado de liquidez |
| `components/dashboard/GridPanel.tsx` | Barras asimétricas según `levelsAbove` y `levelsBelow` |
| `app/dashboard/page.tsx` | Insertar `<LiquidityPanel>` entre GridPanel y LayersPanel |

### Back4App (1 colección nueva)

| Colección | Acción |
|---|---|
| `LiquiditySnapshot` | Crear manualmente en la consola de Back4App antes de la Fase 2 |

---

## Fases de implementación

### FASE 1 — Tipos y contratos (sin lógica, sin riesgo)

**Archivos:** `lib/types.ts`

Agregar todas las interfaces nuevas al archivo de tipos. Esto primero porque
el resto de fases importa estos tipos. Sin esta fase el TypeScript falla.

```typescript
// Nuevas interfaces a agregar en lib/types.ts:

interface OBIResult {
  bidVolume: number
  askVolume: number
  ratio: number
  bias: 'bullish' | 'bearish' | 'neutral'
  strength: number      // 0-100
}

interface CVDResult {
  buyVolume: number
  sellVolume: number
  delta: number
  cumulativeDelta: number
  trend: 'accumulation' | 'distribution' | 'neutral'
  strength: number
  lowDataWarning: boolean
}

interface LiquidityLevel {
  price: number
  volume: number
  type: 'support' | 'resistance' | 'neutral'
  strength: number
  distanceFromCurrent: number
}

interface LiquidityMap {
  levels: LiquidityLevel[]
  nearestResistance: LiquidityLevel | null
  nearestSupport: LiquidityLevel | null
  currentZone: 'near_resistance' | 'near_support' | 'in_range'
}

interface FundingRateResult {
  rate: number
  interpretation: 'longs_paying' | 'shorts_paying' | 'neutral'
  riskLevel: 'low' | 'medium' | 'high'
  note: string
  unavailable?: boolean   // true si el endpoint falla en testnet
}

interface GridBias {
  direction: 'bullish' | 'bearish' | 'neutral'
  strength: number
  confidence: number
  levelsAbove: number
  levelsBelow: number
  densityZone: {
    priceMin: number
    priceMax: number
    levelConcentration: number
  }
  sizeMultiplierAbove: number
  sizeMultiplierBelow: number
  signals: {
    obi: OBIResult
    cvd: CVDResult
    liquidityMap: LiquidityMap
    fundingRate: FundingRateResult
  }
  overrideActive: boolean
  overrideReason?: string
  summary: string
}

interface LiquiditySnapshot {
  pair: string
  obiRatio: number
  obiDirection: string
  cvdDelta: number
  cvdTrend: string
  fundingRate: number
  biasDirection: string
  biasStrength: number
  confidence: number
  levelsAbove: number
  levelsBelow: number
  overrideActive: boolean
  overrideReason?: string
  recordedAt: Date
}
```

También agregar a `SSEEventType`:
```typescript
| 'liquidity_analysis_completed'
| 'grid_bias_changed'
```

---

### FASE 2 — Recolectores de señales

**Archivos nuevos:** `orderFlowTracker.ts`, `liquidityMap.ts`

#### 2a. `lib/analysis/orderFlowTracker.ts`

Dos funciones independientes, sin estado:

```typescript
// Función 1: Order Book Imbalance
export async function calculateOBI(pair: string): Promise<OBIResult>
// → fetchOrderBook(pair, 20)
// → bidVolume = sum de top 10 bids (precio × cantidad)
// → askVolume = sum de top 10 asks (precio × cantidad)
// → ratio = bidVolume / askVolume
// → bias según thresholds del requirements

// Función 2: Cumulative Volume Delta
export async function calculateCVD(pair: string): Promise<CVDResult>
// → fetchRecentTrades(pair, 500)
// → separar market buys (side='buy') de market sells (side='sell')
// → delta = buyVolume - sellVolume
// → si trades < 100 → lowDataWarning: true
```

**Función 3: Funding Rate**
También aquí o en archivo separado según conveniencia:

```typescript
export async function fetchFundingRateSignal(pair: string): Promise<FundingRateResult>
// → exchange.fetchFundingRate('XRP/USDT')  ← siempre en USDT perp
// → Si falla (testnet, spot, error) → return { rate: 0, interpretation: 'neutral',
//   riskLevel: 'low', note: 'No disponible', unavailable: true }
```

⚠️ **Riesgo conocido:** `fetchFundingRate` puede fallar en testnet porque los futuros
perpetuos no siempre están disponibles en el entorno de prueba. El fallback neutral
es obligatorio — nunca debe bloquear el arranque del bot.

#### 2b. `lib/analysis/liquidityMap.ts`

```typescript
export async function buildLiquidityMap(
  pair: string,
  currentPrice: number
): Promise<LiquidityMap>
// → fetchOrderBook(pair, 100) — order book profundo
// → fetchOHLCV(pair, '1h', 48) — 48 horas de velas
// → Identificar clusters: niveles del order book donde el volumen
//   acumulado es ≥ 2× el promedio (son "muros" de liquidez)
// → Identificar soportes/resistencias históricas: precios donde
//   el precio "rebotó" en las últimas 48h (high/low que se repiten)
// → Combinar ambos → LiquidityLevel[]
// → Clasificar nearestResistance y nearestSupport
// → Determinar currentZone
```

**Criterio para `currentZone`:**
- `near_resistance`: precio está a < 0.5% del nivel de resistencia más cercano
- `near_support`: precio está a < 0.5% del nivel de soporte más cercano
- `in_range`: en caso contrario

---

### FASE 3 — LiquidityAnalyzer

**Archivo nuevo:** `lib/analysis/liquidityAnalyzer.ts`

Implementar exactamente el algoritmo de combinación del requirements:

```typescript
export async function runLiquidityAnalysis(
  pair: string,
  currentPrice: number,
  totalLevels: number
): Promise<GridBias>
```

Internamente llama en paralelo:
```typescript
const [obi, cvd, liquidityMap, fundingRate] = await Promise.all([
  calculateOBI(pair),
  calculateCVD(pair),
  buildLiquidityMap(pair, currentPrice),
  fetchFundingRateSignal(pair),
])
```

Luego aplica `calculateGridBias(obi, cvd, liquidityMap, fundingRate, totalLevels)`.

**Output en consola:** imprimir el cuadro ASCII del requirements con `logger.info`.

**También:** `lib/database/liquiditySnapshots.ts` — guardar el snapshot en Back4App.
Crear la colección `LiquiditySnapshot` en la consola de Back4App antes de correr esto.

---

### FASE 4 — Grid asimétrico

**Archivo modificado:** `lib/bot/grid.ts`

Cambiar la firma de `buildGridLevels` para aceptar `bias?`:

```typescript
export function buildGridLevels(
  currentPrice: number,
  config: GridConfig,
  amountPerLevel: number,
  bias?: GridBias           // NUEVO — opcional
): GridLevel[]
```

**Lógica con bias:**

```
Si bias === undefined || bias.direction === 'neutral' && bias.strength < 20:
  → Comportamiento idéntico a v4 (grid simétrico)

Si bias activo:
  levelsAbove = bias.levelsAbove
  levelsBelow = bias.levelsBelow

  → Construir levelsAbove niveles arriba del precio (ventas)
    con espaciado: gridRangePercent/2 / (levelsAbove - 1)
    con amount: amountPerLevel × bias.sizeMultiplierAbove

  → Construir levelsBelow niveles abajo del precio (compras)
    con espaciado: gridRangePercent/2 / (levelsBelow - 1)
    con amount: amountPerLevel × bias.sizeMultiplierBelow

  → Opcionalmente concentrar niveles en densityZone:
    Si un nivel cae dentro de [densityZone.priceMin, densityZone.priceMax]
    y levelConcentration > 50%, reducir el espaciado en esa zona

  → Verificar siempre MIN_LEVEL_SEPARATION — si el spacing calculado
    cae por debajo del 0.25% mínimo, lanzar Error igual que ahora
```

⚠️ **Invariante crítica:** Con bias `undefined` el output debe ser
bit-a-bit idéntico al output actual. Tests manuales antes de integrar.

---

### FASE 5 — Integración en scheduler

**Archivo modificado:** `lib/bot/scheduler.ts`

**5a. Al arrancar** (después de `runMarketAnalysis`, antes de `buildGridLevels`):

```typescript
// [NUEVO] Análisis de liquidez
let gridBias: GridBias | undefined
try {
  gridBias = await runLiquidityAnalysis(pair, currentPrice, gridConfig.gridLevels)
  runtime.lastGridBias = gridBias
  broadcastSSE('liquidity_analysis_completed', {
    direction: gridBias.direction,
    strength: gridBias.strength,
    confidence: gridBias.confidence,
    levelsAbove: gridBias.levelsAbove,
    levelsBelow: gridBias.levelsBelow,
  })
} catch (err) {
  logger.warn('[v5] LiquidityAnalyzer falló — usando grid simétrico:', err)
  gridBias = undefined   // fallback seguro: grid simétrico
}
```

**5b. Pasar bias al buildGrid:**
```typescript
gridLevels = buildGridLevels(currentPrice, gridConfig, amountPerLevel, gridBias)
```

**5c. Re-análisis periódico cada 2 horas:**
```typescript
const LIQUIDITY_REANALYSIS_INTERVAL = 2 * 60 * 60 * 1000

// Dentro del checkLayer3Triggers o en un interval separado:
// Si han pasado 2h desde el último análisis de liquidez → re-correr
// Si el nuevo bias.direction !== old bias.direction → rebuild del grid
// Si solo cambió el strength (misma dirección) → ajustar sizeMultipliers
//   sin reconstruir (solo modificar amounts de las órdenes abiertas)
```

También necesita:
```typescript
runtime.lastGridBias: GridBias | null     // agregar a BotRuntime y runtime.ts
runtime.lastLiquidityAt: Date | null      // timestamp del último análisis
```

---

### FASE 6 — Capa 3 con contexto de liquidez

**Archivo modificado:** `lib/analysis/layer3-agent.ts`

Agregar sección de liquidez al contexto si `runtime.lastGridBias` existe:

```typescript
const biasSection = runtime.lastGridBias ? `
=== ANÁLISIS DE LIQUIDEZ (v5) ===
Sesgo detectado: ${bias.direction} (strength: ${bias.strength}/100)
Confianza: ${bias.confidence}% (señales alineadas)

Order Book Imbalance:
  Ratio bid/ask: ${bias.signals.obi.ratio.toFixed(2)}
  Interpretación: ${bias.signals.obi.bias} — ${bias.signals.obi.strength}/100

CVD últimas transacciones:
  Delta neto: ${bias.signals.cvd.delta > 0 ? '+' : ''}${bias.signals.cvd.delta.toFixed(0)} XRP
  Tendencia: ${bias.signals.cvd.trend}${bias.signals.cvd.lowDataWarning ? ' (datos limitados)' : ''}

Funding Rate:
  Tasa actual: ${(bias.signals.fundingRate.rate * 100).toFixed(4)}%
  ${bias.signals.fundingRate.note}

Grid propuesto:
  Niveles arriba: ${bias.levelsAbove}
  Niveles abajo: ${bias.levelsBelow}
  ${bias.overrideActive ? '⚠️ Override activo: ' + bias.overrideReason : ''}
` : ''
```

El schema de `grid_recommendation` no cambia — Claude ya puede recomendar
`rebuild`, `widen`, etc. El nuevo contexto solo le da más información.

---

### FASE 7 — Dashboard y SSE

#### 7a. `store/bot.ts` — Nuevas variables

```typescript
liquidityBiasDirection: 'bullish' | 'bearish' | 'neutral'
liquidityBiasStrength: number       // 0-100
liquidityConfidence: number         // 0-100
liquidityLevelsAbove: number
liquidityLevelsBelow: number
liquidityLastAnalysis: Date | null
liquidityOverrideActive: boolean
liquidityOverrideReason?: string
```

Actualizar en `updateFromStatus` y en el handler del evento SSE `liquidity_analysis_completed`.

#### 7b. `lib/sse.ts`

Agregar a `SSEEventType` (ya agregado en Fase 1):
- `'liquidity_analysis_completed'`
- `'grid_bias_changed'`

#### 7c. `components/dashboard/LiquidityPanel.tsx` — Panel nuevo

Mostrar:
- OBI: ratio + bias + barra de fuerza
- CVD: delta + trend + barra de fuerza
- Funding: tasa + interpretación
- Sesgo resultante: dirección + fuerza + confianza (X/3 señales)
- Distribución del grid: "8 niveles ↑ / 4 niveles ↓"
- Timestamp del último análisis + botón "Re-analizar"
- Badge de override si está activo

#### 7d. `components/dashboard/GridPanel.tsx`

Modificar la visualización de barras para que sean proporcionales a
`levelsAbove` y `levelsBelow` del store en lugar de simétrico.

#### 7e. Nuevas API routes

Todas con `export const runtime = 'nodejs'`:
- `GET /api/liquidity/latest` — Lee de `liquiditySnapshots.ts`
- `GET /api/liquidity/history` — Historial paginado
- `POST /api/liquidity/analyze` — Llama a `runLiquidityAnalysis` y retorna el GridBias

#### 7f. `app/dashboard/page.tsx`

Insertar `<LiquidityPanel />` entre `<GridPanel />` y `<LayersPanel />`.

---

## Riesgos y consideraciones

| Riesgo | Mitigación |
|---|---|
| `fetchFundingRate` falla en testnet | Fallback `unavailable: true`, tratar como neutral |
| CVD con < 100 trades (bajo volumen) | Flag `lowDataWarning: true`, reducir peso de la señal |
| Grid asimétrico rompe comportamiento v4 | `bias` es opcional; sin él el output es idéntico a v4 |
| `buildLiquidityMap` tarda demasiado | Corre en paralelo con otras señales via `Promise.all` |
| Re-análisis de liquidez dispara rebuild en loop | Verificar si `consecutiveRebuilds >= LAYER3_MAX_CONSECUTIVE_REBUILDS` antes |
| Colección `LiquiditySnapshot` no existe en Back4App | Crearla manualmente en la consola antes de la Fase 2 |
| `levelsAbove` o `levelsBelow` puede ser 0 con sesgo extremo | Garantizar mínimo 1 nivel en cada lado: `Math.max(1, calculated)` |

---

## Orden de implementación recomendado

```
Fase 1 → Fase 2a → Fase 2b → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7
  ↑           ↑          ↑        ↑        ↑        ↑        ↑
Tipos     OBI+CVD   LiqMap   Analyzer  Grid   Scheduler  L3    Dashboard
```

Cada fase es independiente de la siguiente hasta que se integra en Fase 5.
Las Fases 2a, 2b y 3 se pueden implementar y probar de forma aislada
(con un script de prueba manual) antes de tocar el bot.

---

## Estimado de archivos totales

- **7 archivos nuevos**
- **8 archivos modificados**
- **1 colección Back4App nueva**
- **0 colecciones existentes modificadas**
- **0 contratos de API existentes modificados**
