# Checklist: Pasos para pasar a Producción

## Estado actual — ❌ No listo para producción

### Problemas críticos que bloquean el paso a producción

**1. `SIZING_BASE_AMOUNT = 0.0013 XRP` → Binance lo rechazará**

Binance aplica filtros mínimos por par:
- LOT_SIZE mínimo: **1 XRP**
- MIN_NOTIONAL: **~$5 USD por orden**

Con 0.0013 XRP (~$0.002), cada orden fallará con error `Filter failure: MIN_NOTIONAL`.
Todas las sesiones registradas fueron con `MOCK_BALANCE=true` donde ese filtro no existe.

**2. Nunca hubo un fill real**

Los fills simulados (25% aleatorio/ciclo en mock) no validan que el grid funcione
contra un libro de órdenes real. La lógica de colocación, cancelación y ciclo
buy→sell necesita probarse con órdenes reales.

**3. Bugs críticos corregidos el 2026-03-25 — requieren validación**

- `peakProfitUSDC` no se reseteaba entre sesiones → trailing stop disparaba al arrancar
- `cancelAllOrders` no cancelaba en Binance cuando `MOCK_BALANCE=true` → órdenes huérfanas
- Backtest usaba datos de testnet (flat, sin variación) en lugar de producción

Estos fixes necesitan al menos una sesión de prueba en testnet real antes de arriesgar capital.

---

## Paso 1 — Testnet con órdenes reales

**Objetivo:** validar que órdenes se colocan, llenan y cancelan correctamente en Binance.

```ts
// bot.config.ts
BINANCE_TESTNET = true
MOCK_BALANCE = false
SIZING_BASE_AMOUNT = 1.0    // mínimo real de Binance
ACTIVE_PERCENT = 20
```

**Criterios para pasar al Paso 2:**
- [ ] Al menos 3 sesiones sin errores de `MIN_NOTIONAL` o `LOT_SIZE`
- [ ] Órdenes visibles en testnet.binance.vision mientras el bot corre
- [ ] Al detener el bot, las órdenes desaparecen de Binance (cancelación correcta)
- [ ] Al menos 50 ciclos buy→sell completados correctamente
- [ ] Trailing stop y stop_loss_range probados sin comportamiento inesperado

---

## Paso 2 — Producción con capital mínimo

**Objetivo:** validar comportamiento real con dinero real pero exposición mínima.

```ts
// bot.config.ts
BINANCE_TESTNET = false
MOCK_BALANCE = false
SIZING_BASE_AMOUNT = 1.0    // ajustar según capital disponible
ACTIVE_PERCENT = 10         // bajar al 10% inicialmente (en lugar del 20%)
STOP_LOSS_PERCENT = 8       // más conservador que los 12% actuales
TRAILING_STOP_THRESHOLD = 2.0
TRAILING_STOP_DRAWDOWN = 0.75
```

**Criterios para escalar capital:**
- [ ] 1 semana completa sin stop por regla de riesgo inesperada
- [ ] Win rate real ≥ 85% en condiciones reales (no mock)
- [ ] Ganancia neta positiva después de fees reales
- [ ] Comportamiento del trailing stop validado en sesión real

---

## API Keys de producción

**Dónde obtenerlas:** binance.com → perfil (arriba derecha) → API Management → Create API

| Permiso | Valor |
|---|---|
| Enable Reading | ✅ Requerido |
| Enable Spot & Margin Trading | ✅ Requerido |
| Enable Withdrawals | ❌ NUNCA para un bot |
| Restrict access to trusted IPs | ✅ Recomendado |

**Dónde configurarlas:**
```
# .env.local
BINANCE_API_KEY=tu_api_key_de_produccion
BINANCE_SECRET=tu_secret_key_de_produccion
```

> Las keys de testnet y producción son distintas. Nunca mezclar.

---

## Ajuste de SIZING_BASE_AMOUNT para producción

El tamaño de orden determina cuánto capital se usa por nivel del grid.

| Capital activo USDC | SIZING_BASE_AMOUNT sugerido | Órdenes por ciclo aprox. |
|---|---|---|
| $50 – $200 | 1.0 – 2.0 XRP | Mínimo viable |
| $200 – $500 | 3.0 – 5.0 XRP | Conservador |
| $500 – $2000 | 5.0 – 15.0 XRP | Balanceado |
| $2000+ | 15.0+ XRP | Según estrategia |

Fórmula: `SIZING_BASE_AMOUNT = (activeUSDC / currentPrice) / (GRID_LEVELS / 2)`

---

*Última actualización: 2026-03-25*
