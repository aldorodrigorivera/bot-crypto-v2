import type { SimulationResult, BacktestMetrics, AppConfig } from '../types'

export function calculateMetrics(
  result: SimulationResult,
  benchmarks: AppConfig['backtest'],
  configGridLevels: number,
  durationDays: number
): BacktestMetrics {
  const { trades, startCapital, gridBreaks } = result

  const completedCycles = trades.filter(t => t.type === 'sell' && t.profit !== undefined)
  const totalTrades = trades.length

  // ── Win Rate ─────────────────────────────────────────────────────────────
  const cycleProfit = completedCycles.map(t => t.profit ?? 0)
  const winningCycles = cycleProfit.filter(p => p > 0)
  const winRate = completedCycles.length > 0
    ? (winningCycles.length / completedCycles.length) * 100
    : 0

  // ── Profit Factor ────────────────────────────────────────────────────────
  const grossProfit = cycleProfit.filter(p => p > 0).reduce((s, p) => s + p, 0)
  const grossLoss = Math.abs(cycleProfit.filter(p => p < 0).reduce((s, p) => s + p, 0))
  const profitFactor = grossLoss === 0
    ? (grossProfit > 0 ? Infinity : 0)
    : grossProfit / grossLoss

  // ── Net Profit & Fees ────────────────────────────────────────────────────
  const netProfitUSDC = cycleProfit.reduce((s, p) => s + p, 0)
  const totalFeesPaid = trades.reduce((s, t) => s + (t.fee ?? 0), 0)

  // ── Avg Profit & Duration ─────────────────────────────────────────────────
  const avgProfitPerCycle = completedCycles.length > 0 ? netProfitUSDC / completedCycles.length : 0

  // Duración promedio de ciclo: diferencia entre timestamp de buy y sell correlacionados
  // Usamos el timestamp de las sells como aproximación simple
  const sellTimestamps = completedCycles.map(t => t.timestamp)
  const buyTimestamps = trades.filter(t => t.type === 'buy').map(t => t.timestamp)
  let avgDuration = 0
  if (buyTimestamps.length > 0 && sellTimestamps.length > 0) {
    const minCount = Math.min(buyTimestamps.length, sellTimestamps.length)
    const durations = Array.from({ length: minCount }, (_, i) =>
      (sellTimestamps[i] - buyTimestamps[i]) / (1000 * 60) // en minutos
    ).filter(d => d > 0)
    avgDuration = durations.length > 0
      ? durations.reduce((s, d) => s + d, 0) / durations.length
      : 0
  }

  // ── Sharpe Ratio ──────────────────────────────────────────────────────────
  let sharpeRatio = 0
  if (cycleProfit.length >= 2) {
    const returns = cycleProfit.map(p => startCapital > 0 ? (p / startCapital) * 100 : 0)
    const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length
    const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length
    const stdReturn = Math.sqrt(variance)
    // Estimación de ciclos por año según duración promedio
    const minutesPerYear = 365 * 24 * 60
    const cyclesPerYear = avgDuration > 0 ? minutesPerYear / avgDuration : completedCycles.length
    sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(cyclesPerYear) : 0
  }

  // ── Max Drawdown ──────────────────────────────────────────────────────────
  let maxDrawdown = 0
  if (completedCycles.length > 0) {
    let runningCapital = startCapital
    let peak = startCapital

    for (const t of completedCycles) {
      runningCapital += t.profit ?? 0
      if (runningCapital > peak) peak = runningCapital
      const dd = peak > 0 ? ((peak - runningCapital) / peak) * 100 : 0
      if (dd > maxDrawdown) maxDrawdown = dd
    }
  }

  // ── Total Return ──────────────────────────────────────────────────────────
  const totalReturn = startCapital > 0 ? (netProfitUSDC / startCapital) * 100 : 0

  // ── Score compuesto ───────────────────────────────────────────────────────
  const pfCapped = Math.min(profitFactor === Infinity ? 3 : profitFactor, 3)
  const sharpeCapped = Math.min(Math.max(sharpeRatio, 0), 3)
  const ddCapped = Math.min(maxDrawdown, 20)
  const score = Math.round(
    winRate * 0.30 +
    (pfCapped / 3) * 100 * 0.30 +
    (sharpeCapped / 3) * 100 * 0.20 +
    ((20 - ddCapped) / 20) * 100 * 0.20
  )

  // ── Evaluación de benchmarks ──────────────────────────────────────────────
  const failedReasons: string[] = []

  if (totalTrades < benchmarks.minTrades) {
    failedReasons.push(
      `Muestra insuficiente: solo ${totalTrades} trades simulados, mínimo requerido: ${benchmarks.minTrades}. ` +
      `Considera aumentar BACKTEST_DAYS o reducir BACKTEST_MIN_TRADES.`
    )
  }
  if (winRate < benchmarks.minWinRate) {
    failedReasons.push(`Win Rate ${winRate.toFixed(1)}% < mínimo requerido ${benchmarks.minWinRate}%`)
  }
  if (profitFactor < benchmarks.minProfitFactor) {
    failedReasons.push(`Profit Factor ${profitFactor.toFixed(2)} < mínimo requerido ${benchmarks.minProfitFactor}`)
  }
  if (maxDrawdown > benchmarks.maxDrawdown) {
    failedReasons.push(`Max Drawdown ${maxDrawdown.toFixed(1)}% > máximo permitido ${benchmarks.maxDrawdown}%`)
  }
  if (sharpeRatio < benchmarks.minSharpe) {
    failedReasons.push(`Sharpe Ratio ${sharpeRatio.toFixed(2)} < mínimo requerido ${benchmarks.minSharpe}`)
  }

  const passed = failedReasons.length === 0

  return {
    winRate: Math.round(winRate * 10) / 10,
    profitFactor: Math.round(profitFactor * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10) / 10,
    totalTrades,
    completedCycles: completedCycles.length,
    totalReturn: Math.round(totalReturn * 100) / 100,
    avgProfitPerCycle: Math.round(avgProfitPerCycle * 10000) / 10000,
    avgDuration: Math.round(avgDuration),
    totalFeesPaid: Math.round(totalFeesPaid * 100) / 100,
    netProfitUSDC: Math.round(netProfitUSDC * 100) / 100,
    gridBreaks,
    passed,
    failedReasons,
    score: Math.max(0, Math.min(100, score)),
  }
}

export function formatBacktestOutput(
  metrics: BacktestMetrics,
  configLabel: string,
  configName: string,
  days: number,
  startDate: Date,
  endDate: Date,
  candleCount: number
): string {
  const fmtDate = (d: Date) => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  const check = (pass: boolean) => pass ? '✅' : '❌'

  const lines = [
    `╔══════════════════════════════════════════════════════════╗`,
    `║         BACKTEST — ${days} días                               ║`,
    `╠══════════════════════════════════════════════════════════╣`,
    `║  Configuración: ${configLabel.padEnd(39)}║`,
    `║  Período:       ${fmtDate(startDate)} — ${fmtDate(endDate)}`.padEnd(61) + `║`,
    `║  Velas:         ${String(candleCount).padEnd(43)}║`,
    `╠══════════════════════════════════════════════════════════╣`,
    `║  RESULTADOS:                                             ║`,
    `║  Ciclos:        ${String(metrics.completedCycles).padEnd(43)}║`,
    `║  Win Rate:      ${`${metrics.winRate}%  ${check(metrics.winRate >= 0)}`  .padEnd(43)}║`,
    `║  Profit Factor: ${`${metrics.profitFactor}  ${check(metrics.profitFactor >= 1)}`  .padEnd(43)}║`,
    `║  Max Drawdown:  ${`${metrics.maxDrawdown}%  ${check(metrics.maxDrawdown <= 20)}`  .padEnd(43)}║`,
    `║  Sharpe:        ${`${metrics.sharpeRatio}  ${check(metrics.sharpeRatio >= 0)}`  .padEnd(43)}║`,
    `║  Retorno:       ${`${metrics.totalReturn > 0 ? '+' : ''}${metrics.totalReturn}%`.padEnd(43)}║`,
    `║  Fees:          ~$${String(metrics.totalFeesPaid).padEnd(41)}║`,
    `║  Grid breaks:   ${String(metrics.gridBreaks).padEnd(43)}║`,
    `╠══════════════════════════════════════════════════════════╣`,
    `║  Score:         ${`${metrics.score} / 100`.padEnd(43)}║`,
  ]

  if (metrics.passed) {
    lines.push(`║  Veredicto:  ✅ APROBADO — Listo para operar            ║`)
  } else {
    lines.push(`║  Veredicto:  ❌ NO APROBADO                             ║`)
    lines.push(`║  Razones:                                               ║`)
    for (const reason of metrics.failedReasons) {
      const truncated = reason.length > 52 ? reason.substring(0, 52) : reason
      lines.push(`║    · ${truncated.padEnd(54)}║`)
    }
  }

  lines.push(`╚══════════════════════════════════════════════════════════╝`)

  return lines.join('\n')
}
