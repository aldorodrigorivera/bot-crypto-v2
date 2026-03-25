import { getIncubationState, saveIncubationState } from '../database/incubationState'
import { evaluateScaling, getSizeMultiplierForPhase } from './scaler'
import { broadcastSSE } from '../sse'
import { logger } from '../logger'
import { getAppConfig } from '../config'
import { runtime } from '../runtime'
import { executeEmergencyStop } from '../bot/risk'
import type { IncubationState, IncubationPhase } from '../types'

// Estado en memoria — NO en BotRuntime para evitar circular imports
let _state: IncubationState | null = null
let _tradesSinceLastSave = 0
const SAVE_EVERY_N_TRADES = 10

export async function loadIncubationState(): Promise<void> {
  const config = getAppConfig()
  const existing = await getIncubationState()

  if (existing && existing.isActive) {
    // Reinicio: retomar estado desde Back4App
    _state = existing
    runtime.incubationSizeMultiplier = existing.currentSizeMultiplier
    logger.info(`[incubation] Estado retomado: fase ${existing.currentPhase}, trades ${existing.realTrades}`)
  } else {
    // Arranque nuevo: iniciar en fase micro
    _state = {
      isActive: true,
      startedAt: new Date(),
      currentPhase: 'micro',
      realTrades: 0,
      realWinRate: 0,
      realProfitFactor: 0,
      currentSizeMultiplier: config.incubation.minSize,
      totalRealProfitBTC: 0,
      totalRealLossBTC: 0,
      phaseHistory: [{ phase: 'micro', startedAt: new Date(), reason: 'Inicio de incubación' }],
    }
    runtime.incubationSizeMultiplier = config.incubation.minSize
    await saveIncubationState(_state)
    logger.info('[incubation] Incubación iniciada en fase MICRO')
  }

  broadcastSSE('incubation_update', sanitize(_state))
}

export function getIncubationStateInMemory(): IncubationState | null {
  return _state
}

export async function recordIncubationTrade(profit: number, isWin: boolean): Promise<void> {
  if (!_state || !_state.isActive) return

  const config = getAppConfig()

  // Actualizar contadores
  _state.realTrades++
  _tradesSinceLastSave++

  if (profit > 0) {
    _state.totalRealProfitBTC += profit
  } else {
    _state.totalRealLossBTC += Math.abs(profit)
  }

  // Win rate recalculado como promedio móvil
  const prevWins = Math.round((_state.realWinRate / 100) * (_state.realTrades - 1))
  const newWins = prevWins + (isWin ? 1 : 0)
  _state.realWinRate = (_state.realTrades > 0) ? (newWins / _state.realTrades) * 100 : 0

  // Profit factor
  _state.realProfitFactor = _state.totalRealLossBTC > 0
    ? _state.totalRealProfitBTC / _state.totalRealLossBTC
    : (_state.totalRealProfitBTC > 0 ? Infinity : 0)

  // Evaluar escalado / abort
  const evaluation = evaluateScaling(_state, config.incubation)

  if (evaluation.shouldAbort) {
    _state.isActive = false
    _state.abortedAt = new Date()
    _state.abortReason = evaluation.abortReason
    runtime.incubationSizeMultiplier = 1.0  // resetear para no bloquear
    await saveIncubationState(_state)
    broadcastSSE('incubation_aborted', { reason: evaluation.abortReason })
    logger.error(`[incubation] ❌ Incubación abortada: ${evaluation.abortReason}`)

    // Detener el bot
    await executeEmergencyStop(runtime, 'incubation_loss_limit', getAppConfig().bot.pair)
    return
  }

  if (evaluation.shouldScale && evaluation.nextPhase) {
    await scaleToPhase(evaluation.nextPhase)
  }

  // Guardar en DB cada N trades
  if (_tradesSinceLastSave >= SAVE_EVERY_N_TRADES) {
    await saveIncubationState(_state).catch(err =>
      logger.warn('[incubation] Error guardando estado:', err)
    )
    _tradesSinceLastSave = 0
  }

  broadcastSSE('incubation_update', sanitize(_state))
}

async function scaleToPhase(nextPhase: IncubationPhase): Promise<void> {
  if (!_state) return
  const config = getAppConfig()
  const prevPhase = _state.currentPhase

  _state.currentPhase = nextPhase
  _state.currentSizeMultiplier = getSizeMultiplierForPhase(nextPhase, config.incubation.minSize)
  _state.phaseHistory.push({ phase: nextPhase, startedAt: new Date(), reason: `Escalado automático desde ${prevPhase}` })

  runtime.incubationSizeMultiplier = _state.currentSizeMultiplier

  if (nextPhase === 'normal') {
    _state.isActive = false
    _state.passedAt = new Date()
    runtime.incubationSizeMultiplier = 1.0
    await saveIncubationState(_state)
    broadcastSSE('incubation_completed', { passedAt: _state.passedAt.toISOString() })
    logger.info('✅ [incubation] Incubación completada — Operando a tamaño NORMAL')
  } else {
    const pct = Math.round(_state.currentSizeMultiplier * 100)
    await saveIncubationState(_state)
    broadcastSSE('incubation_phase_change', {
      newPhase: nextPhase,
      progressPercent: pct,
      sizeMultiplier: _state.currentSizeMultiplier,
    })
    logger.info(`[incubation] Escalando a fase ${nextPhase.toUpperCase()} (${pct}% del tamaño normal)`)
  }
}

function sanitize(state: IncubationState): object {
  return {
    isActive: state.isActive,
    currentPhase: state.currentPhase,
    realTrades: state.realTrades,
    realWinRate: Math.round(state.realWinRate * 10) / 10,
    realProfitFactor: Math.round(state.realProfitFactor * 100) / 100,
    currentSizeMultiplier: state.currentSizeMultiplier,
    daysInIncubation: (Date.now() - state.startedAt.getTime()) / (1000 * 60 * 60 * 24),
  }
}
