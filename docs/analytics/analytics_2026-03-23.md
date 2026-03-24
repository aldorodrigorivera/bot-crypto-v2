# Análisis de Ganancia por Trade — XRP/USDC
**Fecha:** 2026-03-23
**Contexto:** Ganancia actual observada ~+0.03653 USDC/trade. Target ~+0.07653 USDC/trade.

---

## La Fórmula de Ganancia por Trade

Derivada de `lib/bot/grid.ts` (`calculateCycleProfit`, `calculateAmountPerLevel`, `buildGridLevels`):

```
stepSize       = currentPrice × rangePercent/100 ÷ (levels − 1)
amountPerLevel = activeUSDC × 2 ÷ (currentPrice × levels)

profit ≈ stepSize × amountPerLevel − fees
       ≈ 2 × activeUSDC × rangePercent/100 ÷ [(levels−1) × levels]
```

El denominador `(levels−1) × levels` es el factor dominante. Al aumentar los niveles, tanto el `stepSize` como el `amount` bajan simultáneamente — el efecto en la ganancia por trade es **cuadrático**.

---

## Qué Genera +0.03653/trade

Config activa: **aggressive** (20 niveles, 10% rango — `lib/config.ts`):

```
(levels−1) × levels = 19 × 20 = 380
factor = rangePercent/100 ÷ 380 = 0.10 / 380 = 0.000263
```

La ganancia por trade es proporcional a `activeUSDC × 0.000263`.

Es el denominador más alto de las 3 configs — genera el profit por trade más pequeño, a cambio de mayor frecuencia de operaciones por hora.

---

## Comparación de las 3 Configs

| Config       | Niveles | Rango | Denominador | Factor   | Profit relativo |
| ------------ | ------- | ----- | ----------- | -------- | --------------- |
| aggressive   | 20      | 10%   | 380         | 0.000263 | 1.0× (base)     |
| balanced     | 12      | 8%    | 132         | 0.000606 | 2.3×            |
| conservative | 8       | 6%    | 56          | 0.001071 | 4.1×            |

Con el mismo `activeUSDC` que produce +0.03653 en aggressive:
- **balanced** → ~+0.084/trade (2.3×)
- **conservative** → ~+0.150/trade (4.1×)

---

## Opciones para Llegar a +0.07653/trade

El multiplicador necesario es **~2.09×** sobre el actual.

### Opción A — Cambiar a `balanced` (preset)
- 12 niveles, 8% rango
- Resultado estimado: ~+0.084/trade (2.3×)
- **Sobrepasa ligeramente el target**, pero es el preset más cercano y el cambio más simple.
- Tradeoff: menor frecuencia de trades por hora (~142/h vs ~200+/h en aggressive).

### Opción B — gridLevels = 14 con rango 10% (override manual)
```
(13 × 14) = 182
factor = 0.10 / 182 = 0.000549
ratio  = 0.000549 / 0.000263 = 2.09×
profit = 0.03653 × 2.09 ≈ +0.07635/trade ✓
```
- Aterriza exactamente en el target.
- Ajustable desde los sliders del `ConfigPanel` al inicio de sesión.
- Mantiene el rango agresivo del 10% (menor riesgo de stop-loss por precio fuera de rango).

### Opción C — Aumentar `ACTIVE_PERCENT` (env var)
- De 20% → ~42% escala el profit linealmente hasta 2.1×.
- **No recomendado** sin ajustar niveles: también escala el riesgo y el capital expuesto proporcionalmente.
- Viola la regla de negocio de 80% reserva si se sube demasiado.

---

## Recomendación

| Prioridad     | Acción                                 | Resultado estimado | Simplicidad            |
| ------------- | -------------------------------------- | ------------------ | ---------------------- |
| ✅ Mejor       | `gridLevels=14`, `gridRangePercent=10` | +0.0763/trade      | Sliders en ConfigPanel |
| 🟡 Alternativa | Cambiar a preset `balanced`            | +0.084/trade       | 1 click                |
| ❌ Evitar      | Subir `ACTIVE_PERCENT`                 | +0.076/trade       | Env var, más riesgo    |

---

## Nota sobre Variabilidad entre Sesiones

Las sesiones del 2026-03-23 con config aggressive mostraron ganancias por trade distintas:
- Sesión 09:32 → +0.0827/trade
- Sesión 18:12 → +0.057/trade
- Sesión 19:16 → +0.024/trade

Esto se debe a que `activeUSDC` y el precio de XRP al momento de iniciar varían entre sesiones, escalando la ganancia base proporcionalmente. La fórmula es consistente — lo que cambia es el capital desplegado en cada inicio.

---

*Análisis generado el 2026-03-23 basado en `lib/bot/grid.ts`, `lib/config.ts` y sesiones del mismo día.*




Comparación de las 3 configs
Config	Niveles	Rango	Denominador	Factor	Profit relativo
aggressive	20	10%	380	0.000263	1.0× (base)
balanced	12	8%	132	0.000606	2.3×
conservative	8	6%	56	0.001071	4.1×
Con el mismo activeUSDC:

balanced daría ~0.03653 × 2.3 = +0.084/trade
conservative daría ~0.03653 × 4.1 = +0.150/trade
Qué mover para llegar a +0.07653
Necesitas un multiplicador de ~2.09× sobre el actual.

Opción A — Cambiar a balanced: Da 2.3× → llegas a ~+0.084/trade. Sobrepasa ligeramente el target pero es el preset más cercano.

Opción B — Reducir gridLevels a ~14-15 (config aggressive con override manual):


14 niveles: (13×14) = 182 → factor = 0.10/182 = 0.000549
ratio = 0.000549/0.000263 = 2.09× → +0.07654/trade ✓
Eso sería gridLevels=14 con gridRangePercent=10 (los sliders del ConfigPanel).

Opción C — Aumentar ACTIVE_PERCENT de 20% a ~42%: escala linealmente el profit pero también escala el riesgo proporcionalmente. No recomendado sin ajustar los niveles.

Resumen
Lo que produce el +0.03653 es la config aggressive con 20 niveles — el denominador 380 diluye tanto el stepSize como el amount por nivel. Para llegar a +0.0765, el cambio más quirúrgico es bajar a 14 niveles manteniendo el mismo rango del 10%. Cambiar al preset balanced también funciona y es más simple, pero sobrepasa un poco el target (~0.084).