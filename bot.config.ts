export const PROFIT_TARGET_USDC = 0

// Modo de operación:
//   BINANCE_DEMO    → demo.binance.com (precios similares al real, sin dinero real) ← RECOMENDADO
//   BINANCE_TESTNET → testnet.binance.vision (precios independientes, reset mensual)
//   Ambos false     → Producción (dinero real)
export const BINANCE_DEMO = false
export const BINANCE_TESTNET = false

// Balance simulado (true = órdenes simuladas localmente, datos de mercado son reales)
// RECOMENDADO para pruebas realistas: usa precios/OHLCV/orderbook de producción real
// sin ejecutar órdenes reales ni arriesgar dinero
export const MOCK_BALANCE = false


// ─── CONFIGURACIÓN DEL BOT ─────────────────────────────────────────────
// Par de trading principal
export const PAIR = 'XRP/USDT'

// Porcentaje del XRP total que el bot puede usar para operar (el resto es reserva intocable)
export const ACTIVE_PERCENT = 50


// ─── CONFIGURACIÓN DEL GRID (Valores por defecto) ──────────────────────
// El módulo de análisis puede sobreescribir estos valores en memoria
export const GRID_LEVELS = 5
export const GRID_RANGE_PERCENT = 8


// ─── SEGURIDAD Y GESTIÓN DE RIESGO ────────────────────────────────────
// % máximo de caída desde el inicio antes de detener el bot automáticamente
export const STOP_LOSS_PERCENT = 12

// Máximo de trades por día calendario (pausa el bot al alcanzarlo)
export const MAX_DAILY_TRADES = 50000

// Trailing stop sobre ganancia de sesión
// El trailing solo se activa cuando la ganancia acumulada supera este umbral (USDC)
export const TRAILING_STOP_THRESHOLD = 5.0
// Si la ganancia cae por debajo de este % del pico histórico, pausa el bot
export const TRAILING_STOP_DRAWDOWN = 0.70


// ─── LOGGING ───────────────────────────────────────────────────────────
// Nivel de logs: debug | info | warn | error
export const LOG_LEVEL = 'info'


// ─── VELOCIDAD DEL BOT ──────────────────────────────────────────────────
// Intervalo del loop principal en milisegundos (qué tan seguido revisa fills y coloca órdenes)
// 15000 = 15s (conservador) | 1000 = 1s (alta frecuencia) | 500 = 0.5s (máximo)
export const MAIN_LOOP_INTERVAL_MS = 1050



// ─── CAPAS DE ANÁLISIS (v2) ─────────────────────────────────────────────
// Capa 1: Score mínimo para ejecutar una orden (0-100)
export const LAYER1_MIN_RISK_SCORE = 20

// Capa 2: Probabilidad mínima para ejecutar al 100%
export const LAYER2_MIN_PROBABILITY = 35

// Capa 3: % de cambio de volatilidad en 10min que activa al agente
export const LAYER3_TRIGGER_VOLATILITY = 3.5

// Capa 3: Minutos sin trades que activa al agente
export const LAYER3_TRIGGER_IDLE_MINUTES = 75

// Capa 3: Re-análisis periódico del agente (horas)
export const LAYER3_REVIEW_HOURS = 4

// Capa 3: Máximo de rebuilds consecutivos sin trades antes de pausar el bot
export const LAYER3_MAX_CONSECUTIVE_REBUILDS = 3


// ─── POSITION SIZING (v2) ───────────────────────────────────────────────
// Tamaño base de cada orden en la moneda base (XRP)
export const SIZING_BASE_AMOUNT = 1

// Multiplicador máximo de tamaño (señal muy fuerte)
export const SIZING_MAX_MULTIPLIER = 1.5

// Multiplicador mínimo de tamaño (señal débil)
export const SIZING_MIN_MULTIPLIER = 0.2

// % del capital para niveles centrales del grid
export const SIZING_CENTRAL_LEVELS_PERCENT = 60


// ─── ORDER SPLITTING (v2) ───────────────────────────────────────────────
// Activar micro-órdenes (true/false)
// Con capital pequeño desactivar: si capital_activo / GRID_LEVELS < $15, las
// micro-órdenes (30%) caen bajo el mínimo notional de Binance ($5) y son rechazadas.
export const SPLIT_ENABLED = false

// En cuántas partes dividir cada orden
export const SPLIT_PARTS = 3

// % para cada micro-orden (debe sumar 100)
export const SPLIT_DISTRIBUTION = [30, 40, 30]

// Separación entre micro-órdenes en %
export const SPLIT_SPREAD_PERCENT = 0.15


// ─── v3: BACKTESTING ────────────────────────────────────────────────────────
export const BACKTEST_ENABLED = true
export const BACKTEST_DAYS = 20
export const BACKTEST_MIN_TRADES = 30
export const BACKTEST_MIN_WIN_RATE = 35
export const BACKTEST_MIN_PROFIT_FACTOR = 1.3
export const BACKTEST_MAX_DRAWDOWN = 15
export const BACKTEST_MIN_SHARPE = 0.8


// ─── v3: INCUBACIÓN ─────────────────────────────────────────────────────────
export const INCUBATION_ENABLED = false
export const INCUBATION_MIN_SIZE = 0.00013
export const INCUBATION_DURATION_DAYS = 7
export const INCUBATION_MIN_TRADES = 30
export const INCUBATION_TARGET_WIN_RATE = 35
export const INCUBATION_MAX_LOSS_PERCENT = 5


// ─── v3: MULTI-CONFIG ───────────────────────────────────────────────────────
export const MULTI_CONFIG_ENABLED = true


// ─── v6: PROTECCIÓN DE CONFIG MANUAL ────────────────────────────────────────
// Si true: el bot usa siempre GRID_LEVELS y GRID_RANGE_PERCENT del .env.
// La Capa 3 sigue corriendo para alertas de riesgo pero NO puede cambiar el grid.
export const MANUAL_GRID_CONFIG = true

// ─── v6: THRESHOLD DE RECONSTRUCCIÓN ────────────────────────────────────────
// % del rango que debe alcanzar el precio desde el centro para trigear rebuild.
// 85 = reconstruye cuando el precio está al 85% del camino hacia el límite.
// Subir a 90 si el grid se reconstruye muy seguido; bajar a 80 si el precio
// se va muy lejos sin reconstruir.
export const GRID_REBUILD_THRESHOLD = 85
