# Separación entre órdenes del grid

## ¿Por qué las órdenes están separadas así?

La separación depende de dos parámetros: el **rango del grid** y el **número de niveles**:

```
separación por nivel = (precio × gridRangePercent%) / (gridLevels - 1)
```

Con precio de **1.3970 USDT** como ejemplo:

| Condición de mercado | Rango | Niveles | Separación por nivel |
|---|---|---|---|
| Baja volatilidad (<3%) — conservative | 6% | 8 | ~1.2 cents (~0.86%) |
| Volatilidad normal (3-8%) — balanced | 8% | 12 | ~1.0 cent (~0.73%) |
| Alta volatilidad (6-15%) — aggressive | 10% | 14 | ~1.1 cents (~0.77%) |
| **Volatilidad extrema (>15%) — dinámico** | **~30%** | **14** | **~3.2 cents (~2.3%)** |

## El límite matemático: separación mínima rentable

Binance cobra **0.1% por lado** (0.2% round-trip por ciclo completo compra+venta).
Para que cada ciclo tenga ganancia neta positiva, la separación mínima entre niveles es:

```
separación mínima = 2.5 × fee = 2.5 × 0.1% = 0.25%
```

A precio 1.3970:
- Separación mínima = 1.3970 × 0.25% = **0.0035 USDT** (≈ 0.35 centavos)

Las órdenes pueden estar tan cerca como **medio centavo** y el trade sigue siendo rentable.

## Por qué con volatilidad extrema las órdenes quedan más separadas

Cuando la volatilidad de 24h supera el 15%, el bot amplía el rango dinámicamente
para evitar que el precio salga del grid:

```
rango dinámico = min(rango_diario_promedio × 1.2, 30%)
```

Ejemplo: con 45% de volatilidad y rango diario promedio de 12%:
- rango dinámico = 12% × 1.2 = **14.4%** → órdenes ~1.1 cents separadas
- Si no hay historial → estimación: 45% × 0.6 × 1.2 = 32.4% → cap en **30%** → ~3.2 cents

Con rango amplio y pocos niveles las órdenes quedan más separadas — se sacrifican los
movimientos pequeños para no perder el rango por un movimiento grande.

## Cómo capturar movimientos más pequeños

Subir `GRID_LEVELS` en `bot.config.ts`:

```ts
// Antes (default):
export const GRID_LEVELS = 10

// Para mayor densidad en días normales:
export const GRID_LEVELS = 20  // ~0.58 cents entre órdenes con rango 8%
export const GRID_LEVELS = 25  // ~0.46 cents entre órdenes con rango 8%
```

### Comparación a precio 1.3970 con rango 8%

| GRID_LEVELS | Separación | Movimiento capturado |
|---|---|---|
| 10 | ~1.55 cents | Solo movimientos de >1.5 cents |
| 12 | ~1.02 cents | Movimientos de ~1 cent |
| 20 | ~0.58 cents | Movimientos de medio centavo |
| 25 | ~0.46 cents | Movimientos más pequeños |

## El tradeoff: más niveles = más capital inmovilizado

Con `SIZING_BASE_AMOUNT = 10 XRP` y 20 niveles:
- ~10 niveles de venta × 10 XRP = **100 XRP bloqueado** en ventas
- ~10 niveles de compra × 10 XRP × 1.3970 USDT = **~140 USDT bloqueado** en compras

Antes de aumentar niveles, verificar que el balance disponible alcanza.

## Resumen de decisión

| Objetivo | Configuración recomendada |
|---|---|
| Capturar movimientos de ~1 cent | `GRID_LEVELS = 12`, `GRID_RANGE_PERCENT = 8` |
| Capturar movimientos de ~0.5 cents | `GRID_LEVELS = 20`, `GRID_RANGE_PERCENT = 8` |
| Mercado muy volátil (>15%) | El bot ajusta el rango automáticamente — no cambiar niveles manualmente |
| Máxima densidad posible | `GRID_LEVELS = 30`, verificar capital disponible |

> **Nota**: la separación mínima de 0.25% es un límite técnico del código (`MIN_LEVEL_SEPARATION` en `lib/config.ts`).
> Si el rango ÷ niveles cae por debajo de este umbral, el bot lanza un error y no arranca.
