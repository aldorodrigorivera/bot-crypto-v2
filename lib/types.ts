// ─── Enums y Union Types ───────────────────────────────────────────────────
export type GridConfigName = 'conservative' | 'balanced' | 'aggressive'
export type TrendDirection = 'bullish' | 'bearish' | 'sideways'
export type TrendStrength = 'weak' | 'moderate' | 'strong'
export type OrderSide = 'buy' | 'sell'
export type OrderStatus = 'open' | 'filled' | 'cancelled'
export type BotStopReason = 'manual' | 'stop_loss_range' | 'stop_loss_global' | 'daily_limit' | 'error' | 'profit_target_reached' | 'trailing_stop_profit' | 'incubation_loss_limit'
export type AgentBias = 'bullish' | 'bearish' | 'neutral'
export type OrderSizingBias = 'aggressive' | 'normal' | 'conservative'
export type GridAction = 'keep' | 'shift_up' | 'shift_down' | 'widen' | 'narrow' | 'pause' | 'rebuild'
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
  | 'backtest_started'
  | 'backtest_completed'
  | 'incubation_update'
  | 'incubation_phase_change'
  | 'incubation_completed'
  | 'incubation_aborted'
  | 'liquidity_analysis_completed'
  | 'grid_bias_changed'

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
  priceChange24h: number
  volatility24h: number
  averageDailyRange: number
  trend: TrendDirection
  trendStrength: TrendStrength
  priceVsMA20: number
  priceVsMA50: number
  volume24h: number
  volumeChange: number
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
  profit: number
  profitBase: number
  gridLevel: number
  orderId: string
  pairedOrderId?: string
  executedAt: Date
  configUsed: GridConfigName
  status?: 'placed' | 'filled'
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
  date: string
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
  riskScore: number
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
  probability: number
  marketBias: AgentBias
  sizeMultiplier: number
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

// ─── Sesión de Trading ────────────────────────────────────────────────────
export interface TradingSession {
  objectId?: string
  pair: string
  startedAt: Date
  stoppedAt: Date
  durationMinutes: number
  totalTrades: number
  profitTrades: number
  lossTrades: number
  totalProfitUSDC: number
  totalProfitBase: number
  stopReason: BotStopReason
  configName: GridConfigName
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
    demo: boolean
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
    profitTargetUSDC: number
    manualGridConfig: boolean
    gridRebuildThreshold: number
  }
  server: {
    port: number
  }
  logLevel: string
  anthropicApiKey: string
  mockBalance: boolean
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
}

// ─── Eventos SSE ──────────────────────────────────────────────────────────
export interface SSEEvent {
  type: SSEEventType
  timestamp: string
  data: object
}

// ─── v3: Backtesting ──────────────────────────────────────────────────────

export interface OHLCVCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface SimulatedTrade {
  type: 'buy' | 'sell'
  price: number
  amount: number
  timestamp: number
  fee: number
  profit?: number
  cycleId: string
}

export interface SimulationResult {
  trades: SimulatedTrade[]
  finalCapital: number
  startCapital: number
  totalReturn: number
  durationDays: number
  gridBreaks: number
}

export interface BacktestMetrics {
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

export interface MultiConfigResult {
  conservative: BacktestMetrics
  balanced: BacktestMetrics
  aggressive: BacktestMetrics
  winner: GridConfigName
  winnerReason: string
}

export interface BacktestRecord {
  objectId?: string
  pair: string
  configName: GridConfigName
  gridLevels: number
  gridRangePercent: number
  periodDays: number
  startDate: Date
  endDate: Date
  totalTrades: number
  completedCycles: number
  winRate: number
  profitFactor: number
  sharpeRatio: number
  maxDrawdown: number
  totalReturn: number
  netProfitUSDC: number
  totalFeesPaid: number
  gridBreaks: number
  score: number
  passed: boolean
  failedReasons: string[]
  ranAt: Date
  usedForLaunch: boolean
}

// ─── v3: Incubación ───────────────────────────────────────────────────────

export type IncubationPhase = 'micro' | 'small' | 'medium' | 'normal'

export interface IncubationPhaseEntry {
  phase: IncubationPhase
  startedAt: Date
  reason: string
}

export interface IncubationState {
  objectId?: string
  isActive: boolean
  startedAt: Date
  currentPhase: IncubationPhase
  realTrades: number
  realWinRate: number
  realProfitFactor: number
  currentSizeMultiplier: number
  totalRealProfitBTC: number
  totalRealLossBTC: number
  phaseHistory: IncubationPhaseEntry[]
  passedAt?: Date
  abortedAt?: Date
  abortReason?: string
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
  orderLimitReached: boolean  // true cuando se alcanzaron 20 órdenes abiertas
  consecutiveLosses: number
  consecutiveRebuilds: number
  peakProfitUSDC: number
  pauseUntil: Date | null
  // v3 — backtest e incubación
  lastBacktestFailed: boolean
  lastBacktestMetrics: BacktestMetrics | null
  incubationSizeMultiplier: number
  // rate limits
  pausedForDailyLimit: boolean
  // snapshot del inicio de sesión (para el reporte)
  startSnapshot: {
    gridLevels: number
    gridRangePercent: number
    analysis: MarketAnalysis | null
    claudeRecommendation: Layer3AgentResponse | null
  } | null
  // v5: liquidez
  lastGridBias: GridBias | null
  lastLiquidityAt: Date | null
  // v6: último precio conocido del ciclo principal
  lastPrice: number | null
}

// ─── Preview de Inicio ────────────────────────────────────────────────────
export interface StartupPreview {
  analysis: MarketAnalysis
  claudeRecommendation: Layer3AgentResponse | null
}

// ─── Respuesta de API ──────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ─── Rate Limits Info ─────────────────────────────────────────────────────
export interface RateLimitsInfo {
  dailyTradesUsed: number
  dailyTradesLimit: number
  dailyTradesLimitBinance: number
  dailyTradesPercent: number
  ordersLast10s: number
  ordersLast10sLimitBinance: number
}

// ─── Respuesta de /api/status ─────────────────────────────────────────────
export interface StatusResponse {
  isRunning: boolean
  isPaused: boolean
  botState: BotState | null
  currentConfig: GridConfig | null
  currentPrice: number
  openOrdersCount: number
  pair: string
  mode: 'TESTNET' | 'DEMO' | 'PRODUCCIÓN'
  activePercent: number
  liveBalance: {
    totalBase: number
    freeBase: number
    activeBase: number
    activeUSDC: number
    totalUSDC: number
  } | null
  rateLimits?: RateLimitsInfo
}

// ─── Position Sizer Input ─────────────────────────────────────────────────
export interface SizeMultiplierInput {
  layer1: Layer1Output
  layer2: Layer2Output
  layer3Bias: AgentBias
  layer3SizingBias: OrderSizingBias
  isNearCenter: boolean
  centralLevelsPercent: number
}

// ─── v5: Liquidity-Biased Grid ────────────────────────────────────────────

export interface OBIResult {
  bidVolume: number         // USDT total en top 10 bids
  askVolume: number         // USDT total en top 10 asks
  ratio: number             // bidVolume / askVolume
  bias: 'bullish' | 'bearish' | 'neutral'
  strength: number          // 0-100
}

export interface CVDResult {
  buyVolume: number         // volumen de market buys
  sellVolume: number        // volumen de market sells
  delta: number             // buyVolume - sellVolume
  cumulativeDelta: number   // delta acumulado
  trend: 'accumulation' | 'distribution' | 'neutral'
  strength: number          // 0-100
  lowDataWarning: boolean   // true si hay < 100 trades disponibles
}

export interface LiquidityLevel {
  price: number
  volume: number
  type: 'support' | 'resistance' | 'neutral'
  strength: number                   // 0-100: cuántas veces actuó como soporte/resistencia
  distanceFromCurrent: number        // % de distancia del precio actual
}

export interface LiquidityMap {
  levels: LiquidityLevel[]
  nearestResistance: LiquidityLevel | null
  nearestSupport: LiquidityLevel | null
  currentZone: 'near_resistance' | 'near_support' | 'in_range'
}

export interface FundingRateResult {
  rate: number              // tasa actual (ej: 0.0003 = 0.03%)
  interpretation: 'longs_paying' | 'shorts_paying' | 'neutral'
  riskLevel: 'low' | 'medium' | 'high'
  note: string              // explicación en lenguaje natural
  unavailable?: boolean     // true si el endpoint no está disponible (testnet/spot)
}

export interface GridBias {
  direction: 'bullish' | 'bearish' | 'neutral'
  strength: number              // 0-100
  confidence: number            // 0-100: % de señales alineadas
  levelsAbove: number           // niveles de venta a colocar
  levelsBelow: number           // niveles de compra a colocar
  densityZone: {
    priceMin: number
    priceMax: number
    levelConcentration: number  // % de niveles a concentrar en esta zona
  }
  sizeMultiplierAbove: number   // multiplicador de tamaño para órdenes arriba
  sizeMultiplierBelow: number   // multiplicador de tamaño para órdenes abajo
  signals: {
    obi: OBIResult
    cvd: CVDResult
    liquidityMap: LiquidityMap
    fundingRate: FundingRateResult
  }
  overrideActive: boolean
  overrideReason?: string
  summary: string               // resumen en lenguaje natural para Claude
}

export interface LiquiditySnapshot {
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
