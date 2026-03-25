# BotCryptoIA — Contexto Completo del Proyecto

> Última actualización: 2026-03-24

---

## ¿Qué es este proyecto?

**BotCryptoIA** es un bot de trading automatizado de criptomonedas que opera el par **XRP/USDC** en Binance Spot. Usa una estrategia llamada **Grid Trading**: coloca órdenes de compra en los precios bajos y órdenes de venta en los precios altos dentro de un rango definido. Cuando el precio sube, vende con ganancia. Cuando baja, compra más barato para vender luego.

El proyecto es una aplicación web completa con un **dashboard en tiempo real** que muestra métricas, gráficos y controles del bot.

---

## Stack tecnológico

| Tecnología | Para qué sirve |
|-----------|---------------|
| Next.js 14+ (App Router) | Framework web fullstack |
| TypeScript strict mode | Lenguaje principal |
| Tailwind CSS + shadcn/ui | Estilos y componentes UI |
| Recharts | Gráficos del dashboard |
| Zustand | Estado global del bot en el cliente |
| React Query | Caché y refresco automático de datos |
| Server-Sent Events (SSE) | Actualizaciones en tiempo real |
| CCXT v4 | Librería para conectar con Binance |
| Back4App (Parse SDK) | Base de datos en la nube |
| Anthropic SDK (claude-sonnet-4-6) | Análisis de mercado con IA |
| Winston | Logs del servidor |
| node-cron | Programación del ciclo del bot |

> Build: `npm run build --webpack` (flag necesario porque Next.js 16 usa Turbopack por defecto, incompatible con CCXT)

---

## Reglas de capital — Las más importantes

### Regla 80/20 (intocable)
- **80% del capital = Reserva**: nunca se toca, nunca se opera
- **20% = Capital activo**: es todo lo que el bot usa
  - 50% del activo en USDC → para órdenes de compra
  - 50% del activo en XRP → para órdenes de venta

### Ganancias siempre en XRP
Las ganancias se acumulan en base currency (XRP). **Nunca** se convierten a fiat ni a USDC.

### Solo Spot Trading
Nunca margin, nunca futuros, nunca apalancamiento.

---

## Estrategia de Grid Trading

### ¿Qué es?
El bot divide el rango de precio en **N niveles** equidistantes. En cada nivel coloca una orden:
- Si el precio está **debajo del centro** → orden de compra (buy)
- Si el precio está **arriba del centro** → orden de venta (sell)

Cuando una orden se ejecuta, el bot coloca inmediatamente la **orden opuesta** en el siguiente nivel (si vendió, coloca una compra; si compró, coloca una venta). Así captura la diferencia de precio como ganancia en cada ciclo.

### Tres configuraciones predefinidas

| Config | Niveles | Rango | Para qué situación |
|--------|---------|-------|-------------------|
| Conservative | 8 | ±3% | Mercado calmado, baja volatilidad |
| Balanced | 12 | ±4% | Volatilidad moderada (default) |
| Aggressive | 14 | ±5% | Alta volatilidad |

### Selección automática de config
El bot analiza la volatilidad actual y elige:
- Volatilidad < 3% → Conservative
- Volatilidad < 6% → Balanced
- Volatilidad ≥ 6% → Aggressive
- Capital < $100 → siempre Conservative (protección)

### Cálculo del grid (ejemplo con XRP a $2.50, Balanced)
```
gridMin = $2.40   (precio mínimo del rango)
gridMax = $2.60   (precio máximo del rango)
stepSize = $0.018  (separación entre cada nivel)
12 niveles alternando compras y ventas
```

### Validaciones de seguridad del grid
- Separación mínima entre niveles: **≥ 0.25%** (2.5× el fee de Binance de 0.1%)
- Cada ciclo debe generar ganancia neta: `(precioVenta - precioCompra) × cantidad - 2×fees > 0`

---

## Las 3 Capas de Análisis

Antes de colocar cualquier orden opuesta, el bot corre tres filtros en serie. Si cualquiera dice "no", la orden se salta.

### Capa 1: Risk Score (< 5ms)

Calcula un **puntaje de riesgo del 0 al 100** basado en 4 factores:

| Factor | Peso | Qué mide |
|--------|------|---------|
| Volatilidad (ATR) | 35% | Qué tan errático está el precio |
| Posición en el grid | 30% | Qué tan cerca del extremo está el precio |
| Order Book | 25% | Presión compradora vs vendedora |
| Volumen | 10% | Si el volumen es inusualmente alto o bajo |

- **Umbral mínimo**: 30 puntos (configurable)
- **Si no aprueba**: la orden se salta, se registra en `ordersSkippedToday`
- **También calcula**: un multiplicador de tamaño [0.3 a 1.0] para la siguiente capa

### Capa 2: Probabilidad Técnica (< 100ms)

Corre 6 indicadores técnicos clásicos y vota si el momento es favorable:

| Indicador | Qué detecta |
|-----------|-----------|
| RSI (14) | Sobrecompra / sobreventa |
| MACD | Cruce de tendencias |
| Bollinger Bands | Precio en extremos estadísticos |
| VWAP | Precio vs promedio ponderado por volumen |
| Momentum | Agotamiento de tendencia |
| Order Flow | Desequilibrio entre compradores y vendedores |

Cada indicador suma o resta puntos → resultado: una probabilidad entre 15% y 85%.

- **Umbral mínimo**: 45% de probabilidad (configurable)
- **Si no aprueba**: la orden se salta
- **También calcula**: un multiplicador de tamaño [0 a 1.2]

### Capa 3: Claude AI Agent (< 12 segundos)

No corre en cada trade. Se ejecuta **periódicamente** cuando:
1. La volatilidad cambió ≥ 2% en los últimos 10 minutos
2. El bot lleva ≥ 30 minutos sin ejecutar ningún trade
3. Han pasado 4 horas desde el último análisis
4. El bot acaba de iniciar

**Qué le envía al modelo:**
- Precio actual, cambio 24h, volatilidad, tendencia
- Estado del bot (trades hoy, órdenes activas, pérdidas consecutivas)
- Capital (total, activo, ganancia sesión, peak de ganancia)
- Grid actual (mín, máx, niveles, config)
- Por qué se disparó el análisis

**Qué retorna Claude:**
- `market_bias`: bullish / bearish / neutral
- `grid_adjustment`: keep / shift_up / shift_down / widen / narrow / pause / rebuild
- `order_sizing_bias`: aggressive / normal / conservative
- `confidence`: 0-100
- `risk_flags`: lista de alertas detectadas
- `next_review_minutes`: cuándo hacer el próximo análisis
- `reasoning`: explicación en lenguaje natural

**Si Claude falla** (sin API key, timeout, error): el bot continúa con sesgo neutral, no se detiene.

---

## Cálculo del tamaño de cada orden (Position Sizing)

```
baseAmount = 0.001 XRP (base configurable)

multiplierL1 = resultado de Capa 1 (0.3 a 1.0)
multiplierL2 = resultado de Capa 2 (0.0 a 1.2)
multiplicadorCombinado = (L1 + L2) / 2

Si Claude dijo "aggressive": ×1.2
Si Claude dijo "conservative": ×0.7

Si la orden está en un nivel central del grid: pequeño bonus

finalMultiplier = clampear entre 0.2 y 1.5

orderAmount = baseAmount × finalMultiplier × incubationSizeMultiplier
```

---

## Order Splitter — Micro-órdenes

Cuando está habilitado (por defecto sí), **cada orden se divide en 3 micro-órdenes** escalonadas:

| Micro-orden | Porcentaje del total | Precio (para compra) |
|------------|---------------------|---------------------|
| 1ª | 30% | precio base |
| 2ª | 40% | -0.15% (más barato) |
| 3ª | 30% | +0.15% (un poco más caro) |

Para ventas el escalonado es el inverso. Esto mejora la probabilidad de que se ejecute el orden completo en mercados con movimiento rápido.

---

## Sistema de Riesgo — Auto-Stop y Pausas

| Regla | Condición | Acción |
|-------|-----------|--------|
| Stop Loss Global | Precio cayó ≥ 12% desde el inicio | **STOP** total del bot |
| Stop Loss Range | Precio salió por debajo del grid | **STOP** total del bot |
| Daily Limit | ≥ 200 trades ejecutados hoy | **PAUSA** hasta mañana |
| Profit Target | Ganancia ≥ $5 USDC en la sesión | **PAUSA** |
| Trailing Stop | Ganancia bajó ≥ 20% desde el pico (mínimo $2 ganados) | **PAUSA** |
| Pérdidas consecutivas | 3+ pérdidas seguidas | **PAUSA TEMPORAL** de 90 segundos |

> Nota: Los límites de 200 trades y $5 son de protección propia durante desarrollo. Binance permite 160,000 órdenes por día.

---

## Sistema de Incubación (v3)

**Objetivo**: empezar a operar con órdenes muy pequeñas y escalar solo si los resultados son positivos, para no arriesgar capital real antes de validar la estrategia.

### Las 4 fases y sus multiplicadores de tamaño

```
MICRO → SMALL → MEDIUM → NORMAL
 0.001 → 0.25  →  0.50  →  1.0
```

### ¿Cuándo pasa a la siguiente fase?

| Transición | Condición |
|-----------|-----------|
| Micro → Small | 10 trades reales con win rate ≥ 50% |
| Small → Medium | 20 trades reales, win rate ≥ 53%, pérdidas ≤ 5% del total |
| Medium → Normal | 30 trades reales, ≥ 7 días operando, win rate ≥ 55%, pérdidas ≤ 5% |

### Condición de aborto
Si en cualquier momento `pérdidas / (ganancias + pérdidas) > 5%` → **se aborta la incubación** y el bot para completamente.

### Persistencia
El estado de incubación se guarda en Back4App cada 10 trades. Si el servidor reinicia, carga el estado donde quedó.

---

## Backtest — Validación antes de operar

Antes de iniciar, el bot prueba la estrategia con **datos históricos de los últimos 20 días** para verificar que sería rentable.

### Métricas calculadas

| Métrica | Qué mide | Mínimo requerido |
|---------|---------|-----------------|
| Win Rate | % de trades ganadores | 35% |
| Profit Factor | ganancias totales / pérdidas totales | 1.3 |
| Sharpe Ratio | retorno vs riesgo | 0.8 |
| Max Drawdown | peor caída desde el pico | ≤ 15% |
| Total Trades | cantidad de ciclos simulados | 30 |

### Multi-Config
Si está habilitado, testea las 3 configuraciones (conservative, balanced, aggressive) y elige la ganadora automáticamente.

### Si el backtest falla
El bot puede arrancar de todos modos (con flag `lastBacktestFailed = true` visible en el dashboard como advertencia). El usuario puede forzar el inicio.

---

## El ciclo principal (cada 15 segundos)

```
Cada 15 segundos el bot:

1. Obtiene el precio actual de XRP/USDC desde Binance
2. Verifica reglas de riesgo (stop loss, daily limit, etc.)
3. Consulta órdenes cerradas (filled) en Binance
4. Para cada orden que se llenó:
   ├── Capa 1: ¿el riesgo es aceptable? → si no: skip
   ├── Capa 2: ¿los indicadores técnicos aprueban? → si no: skip
   ├── Calcular tamaño de la orden opuesta
   ├── ¿Ya hay demasiadas órdenes abiertas? → si sí: skip
   ├── Colocar la orden opuesta (con split si está habilitado)
   ├── Guardar el trade en Back4App
   └── Enviar update por SSE al dashboard
5. Si hay 3+ pérdidas seguidas → pausa 90 segundos
```

### Límite de órdenes abiertas (hysteresis)
Para no sobrecargar Binance con órdenes inútiles:
- **Para cuando hay**: `gridLevels × 2` órdenes abiertas (e.g., 24 con 12 niveles)
- **Reanuda cuando baja a**: `gridLevels × 1.5` (e.g., 18 con 12 niveles)

---

## Estado en memoria (Runtime)

El bot mantiene un objeto en memoria (`globalThis.botRuntime`) con todo el estado activo:

- Si está corriendo o pausado
- Mapa de todas las órdenes activas (`Map<orderId, GridOrder>`)
- Config actual del grid
- Contadores del día (trades, órdenes saltadas)
- Historial de pérdidas consecutivas
- Peak de ganancia (para trailing stop)
- Sesgo de Layer 3 (bullish/bearish/neutral)
- Multiplicador de incubación actual
- Handle del `setInterval` del ciclo principal

Si el servidor Next.js reinicia (hot-reload en dev), este objeto se reinicia y se recarga desde Back4App.

---

## Base de datos — Colecciones en Back4App

| Colección | Qué guarda |
|----------|-----------|
| BotState | Estado actual del bot (grid, capital, ganancias) |
| Trade | Cada orden ejecutada (buy o sell) |
| GridOrder | Cada orden activa en el grid |
| TradingSession | Resumen de cada sesión (inicio a fin) |
| LayerAnalysis | Cada análisis de Capa 1 y Capa 2 |
| MarketAnalysis | Snapshots periódicos del mercado |
| IncubationState | Estado de la incubación (fases, trades reales) |
| BacktestResult | Resultados de cada backtest ejecutado |
| GridEfficiency | Eficiencia histórica del grid |

> **Nota legacy**: la colección BotState usa nombres distintos en DB vs TypeScript (e.g., `totalBTC` en DB = `totalBase` en TypeScript).

---

## Dashboard — Componentes

| Componente | Qué muestra |
|-----------|-----------|
| **StatusCard** | Precio live, estado bot (RUNNING/PAUSED/STOPPED), config activa, conexión SSE |
| **CapitalCards** | 6 cards: Total XRP, Total USDC, Ganancia sesión, Capital activo, Trades hoy, Trades totales |
| **GridPanel** | Barra visual del rango (mín → precio actual → máx), niveles y órdenes activas |
| **LayersPanel** | Sesgo de Claude (bullish/bearish/neutral), última acción recomendada, órdenes filtradas hoy |
| **TradesTable** | Últimos 20 trades con precio, cantidad, fee, ganancia, scores L1/L2 |
| **ProfitChart** | Gráfico de ganancia acumulada (72 puntos cada 10 min = últimas 12 horas) |
| **IncubationPanel** | Barra de fases (Micro→Normal), progreso, win rate real, profit factor, días en incubación |
| **StartModal** | Previa al arranque: análisis de mercado + recomendación de Claude, inputs de config |
| **SessionsModal** | Historial de sesiones finalizadas con resumen de cada una |

---

## Tiempo real — SSE (Server-Sent Events)

El dashboard recibe actualizaciones en vivo a través de SSE (`/api/events`). El hook `useSSE()` reconecta automáticamente cada 5 segundos si se pierde la conexión.

### Eventos que se transmiten

| Evento | Cuándo se emite |
|--------|----------------|
| `price_update` | Cada 5 segundos con el precio actual |
| `trade_executed` | Cuando se ejecuta un trade |
| `order_placed` | Cuando se coloca una orden nueva |
| `layer_analysis` | Resultado de Capa 1 o Capa 2 |
| `bot_status_change` | Cuando el bot cambia de estado |
| `risk_alert` | Cuando se activa una regla de riesgo |
| `grid_rebuild` | Cuando Claude recomienda reconstruir el grid |
| `incubation_update` | Actualización del estado de incubación |
| `incubation_phase_change` | Cuando la incubación avanza de fase |
| `backtest_completed` | Cuando termina un backtest |

---

## API Endpoints

### Control del bot
- `POST /api/bot/start` — Inicia con backtest previo
- `POST /api/bot/stop` — Detiene completamente
- `POST /api/bot/pause` / `resume` — Pausa y reanuda sin cancelar órdenes
- `POST /api/bot/rebalance` — Reconstruye el grid

### Consulta de datos
- `GET /api/status` — Estado completo del bot + rate limits
- `GET /api/trades` — Últimos N trades
- `GET /api/profit/history` — Ganancia diaria (últimos 30 días)
- `GET /api/grid/orders` — Órdenes activas del grid
- `GET /api/sessions` — Historial de sesiones
- `GET /api/market/analysis` — Análisis de mercado actual

### Layer 3 y Backtest
- `POST /api/bot/agent/trigger` — Dispara análisis de Claude manualmente
- `GET /api/layers/latest` — Último análisis L1/L2
- `POST /api/backtest/run` — Corre backtest manualmente
- `GET /api/backtest/latest` — Resultado más reciente

### Incubación
- `GET /api/incubation/status` — Estado actual de la incubación
- `GET /api/incubation/history` — Historial de fases pasadas

### Stream
- `GET /api/events` — Conexión SSE para tiempo real

---

## Límites reales de Binance vs límites propios

```
Límite de Binance:    160,000 órdenes / día      (prácticamente inalcanzable)
                           50 órdenes / 10 seg    (el más relevante en ráfagas)

Nuestro límite:           200 órdenes / día      (protección durante desarrollo)

El bot a 12 niveles usa ~0.1 órdenes/segundo vs 5/segundo que permite Binance.
Estamos al 2% de la velocidad máxima permitida.
```

El bot implementa un rate limiter preventivo que frena si se acercan a 45 órdenes/10 segundos (90% del límite de Binance). En la práctica nunca se activa con la configuración actual.

---

## Flujo completo de arranque

```
POST /api/bot/start

1. Backtest (20 días histórico, 3 configs si multi-config habilitado)
2. Cargar / iniciar estado de incubación
3. Análisis de mercado → elegir config óptima
4. Leer balances de Binance → calcular capital activo (20%)
5. Construir grid (niveles, precios, validaciones)
6. Cargar órdenes previas abiertas desde Back4App
7. Iniciar ciclo principal cada 15 segundos
8. Iniciar broadcast de precio cada 5 segundos
9. Broadcast SSE → dashboard se actualiza
```

---

## Estructura de archivos

```
app/
  api/                → Todos los endpoints (Node.js, nunca Edge Runtime)
  dashboard/          → Página del dashboard
lib/
  types.ts           → TODOS los tipos TypeScript del proyecto
  config.ts          → Configuración centralizada (env vars + constantes)
  logger.ts          → Winston logger (singleton)
  runtime.ts         → Estado en memoria del bot (globalThis)
  sse.ts             → EventEmitter + broadcastSSE()
  exchange/          → CCXT Binance + mock mode
  database/          → 7 módulos de Back4App Parse SDK
  analysis/          → Capas 1, 2, 3 + position sizer
  bot/               → Engine, grid, risk, scheduler, order splitter
  incubation/        → Manager de incubación
components/
  dashboard/         → Componentes React del dashboard
  ui/                → Componentes shadcn/ui (no modificar directamente)
store/
  bot.ts             → Zustand store del bot
hooks/               → useSSE, useDashboard
docs/
  analytics/         → Documentación de límites y análisis
  plans/             → Planes de implementación
```

---

## Mock Mode

Cuando `MOCK_BALANCE=true` (para desarrollo), todas las operaciones de exchange retornan datos simulados. El bot simula que ~25% de las órdenes abiertas se ejecutan por ciclo (mínimo 1 si hay órdenes). No requiere API keys reales de Binance.

---

## Valores concretos de referencia rápida

| Parámetro | Valor | Configurable |
|-----------|-------|-------------|
| Ciclo principal | cada 15s | ✅ |
| Broadcast precio | cada 5s | ✅ |
| Layer 3 mín intervalo | 15 minutos | ✅ |
| Layer 3 re-análisis | cada 4 horas | ✅ |
| Layer 3 trigger volatilidad | 2% en 10 min | ✅ |
| Layer 3 trigger idle | 30 min sin trades | ✅ |
| Layer 1 mínimo | 30 puntos | ✅ |
| Layer 2 mínimo | 45% probabilidad | ✅ |
| Capital activo | 20% del total | ✅ |
| Stop loss global | 12% caída | ✅ |
| Pausa por pérdidas | 3 consecutivas → 90s | fijo |
| Max órdenes abiertas | gridLevels × 2 | fijo |
| Resume órdenes | gridLevels × 1.5 | fijo |
| Split partes | 3 (30/40/30%) | ✅ |
| Split spread | 0.15% | ✅ |
| Base amount | 0.001 XRP | ✅ |
| Multiplicador min/max | 0.2 / 1.5 | ✅ |
| Daily trades máx | 200 (dev) | ✅ |
| Profit target sesión | $5 USDC | ✅ |
| Trailing stop threshold | $2 ganados + caída 20% | fijo |
| Backtest días | 20 días | ✅ |
| Incubación duración | 7 días mínimo | ✅ |
| Incubación win rate | 55% para graduarse | ✅ |
| Max loss incubación | 5% antes de abortar | ✅ |
