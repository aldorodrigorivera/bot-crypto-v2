# Binance Rate Limits — Aclaraciones y Cambios para Claude Code

> **INSTRUCCIONES PARA CLAUDE CODE:**
> Este archivo documenta un malentendido importante sobre el límite de
> `MAX_DAILY_TRADES=200` y los cambios necesarios al proyecto.
> Leer completo antes de modificar cualquier archivo.

---

## El Malentendido — Aclaración Importante

El límite de 200 trades por día **NO es un límite de Binance**.
Es una variable que nosotros definimos en el `.env` del bot como
medida de protección durante el desarrollo.

```
Límite real de Binance:   160,000 órdenes / día
Nuestro límite del bot:       200 órdenes / día

Estamos usando el 0.125% de lo que Binance realmente permite.
```

---

## Los Límites Reales de Binance Spot API

Binance tiene 3 tipos de límites simultáneos:

```
1. Órdenes por intervalo corto:  50 órdenes cada 10 segundos
2. Órdenes por día:              160,000 órdenes por día
3. Peso de requests por minuto:  6,000 request weight por minuto
```

### El sistema de Unfilled Orders (el más importante para el bot)

Binance limita las órdenes **sin ejecutar**, no el total de órdenes.
Esto es crítico para entender cómo funciona el grid:

```
Órdenes del grid abiertas esperando → SÍ cuentan contra el límite
Órdenes ejecutadas (filled)         → dejan de contar, liberan espacio
Órdenes canceladas                  → dejan de contar inmediatamente

Conclusión: mientras las órdenes del grid se ejecuten,
            el bot puede seguir colocando nuevas sin problema.
```

### ¿Qué tan lejos está el bot de los límites reales?

```
Escenario actual del bot (12 niveles, ciclo de 30s):

  Órdenes abiertas simultáneas: ~12
  Velocidad de colocación:      2-3 órdenes cada 30 segundos
                                = ~0.1 órdenes/segundo

  Límite de Binance:            50 órdenes cada 10 segundos
                                = 5 órdenes/segundo

  Usamos el 2% de la velocidad máxima permitida. ✅ Muy seguro.
```

---

## Cambios que Debe Hacer Claude Code

### Cambio 1 — Actualizar el .env.example

Cambiar el valor por defecto y agregar comentario explicativo:

```env
# ─── PROTECCIÓN DE TRADES ──────────────────────────────
# Este límite es NUESTRO, no de Binance.
# Binance permite hasta 160,000 órdenes por día.
# Este valor protege contra bugs que generen órdenes infinitas.
#
# Valores recomendados según etapa:
#   Durante incubación:     200   (conservador)
#   Producción normal:    1,000   (operación regular)
#   Grid agresivo:        5,000   (alta frecuencia)
#   Sin límite propio:   50,000   (solo aplican límites de Binance)
MAX_DAILY_TRADES=1000
```

### Cambio 2 — Actualizar la validación en el código

Buscar en el código donde se valida `MAX_DAILY_TRADES` y agregar
contexto sobre los límites reales de Binance para que el log sea claro:

```typescript
// En src/bot/scheduler.ts o donde esté la validación actual
// Buscar algo como: if (dailyTrades >= MAX_DAILY_TRADES)

// Cambiar el mensaje de log de:
logger.warn('Límite de trades diarios alcanzado. Pausando.')

// A algo más informativo:
logger.warn(
  `Límite propio de trades diarios alcanzado (${MAX_DAILY_TRADES}). ` +
  `Pausando hasta mañana. ` +
  `Nota: el límite real de Binance es 160,000/día. ` +
  `Puedes aumentar MAX_DAILY_TRADES en el .env si lo necesitas.`
)
```

### Cambio 3 — Agregar lógica de límites por velocidad

Además del límite diario, agregar una validación de velocidad para
respetar el límite de Binance de 50 órdenes cada 10 segundos.
Esto protege contra situaciones donde el bot intente colocar
muchas órdenes en ráfaga (por ejemplo al reconstruir el grid completo):

```typescript
// Agregar en src/exchange/orders.ts
// Una función que controle la velocidad de colocación de órdenes

interface RateLimiter {
  ordersLast10Seconds: number
  windowStart: number
}

const rateLimiter: RateLimiter = {
  ordersLast10Seconds: 0,
  windowStart: Date.now()
}

async function placeOrderWithRateLimit(orderFn: () => Promise<any>) {
  const now = Date.now()
  const windowElapsed = now - rateLimiter.windowStart

  // Resetear ventana cada 10 segundos
  if (windowElapsed >= 10000) {
    rateLimiter.ordersLast10Seconds = 0
    rateLimiter.windowStart = now
  }

  // Si estamos cerca del límite de Binance (50 por 10s),
  // esperar a que se resetee la ventana
  if (rateLimiter.ordersLast10Seconds >= 45) { // 45 = 90% del límite real
    const waitTime = 10000 - windowElapsed
    logger.warn(
      `Rate limit preventivo: esperando ${waitTime}ms. ` +
      `(${rateLimiter.ordersLast10Seconds}/50 órdenes en ventana actual)`
    )
    await sleep(waitTime)
    rateLimiter.ordersLast10Seconds = 0
    rateLimiter.windowStart = Date.now()
  }

  rateLimiter.ordersLast10Seconds++
  return await orderFn()
}
```

### Cambio 4 — Exponer el uso de rate limits en el dashboard

Agregar al endpoint `/api/status` existente información sobre
el uso de rate limits para que sea visible en el dashboard:

```typescript
// En src/routes/dashboard.ts, en el endpoint GET /api/status
// Agregar al objeto de respuesta:

rateLimits: {
  dailyTradesUsed: currentDailyTrades,
  dailyTradesLimit: MAX_DAILY_TRADES,        // nuestro límite
  dailyTradesLimitBinance: 160000,           // límite real de Binance
  dailyTradesPercent: (currentDailyTrades / MAX_DAILY_TRADES) * 100,
  ordersLast10s: rateLimiter.ordersLast10Seconds,
  ordersLast10sLimitBinance: 50,
}
```

### Cambio 5 — Mostrar rate limits en el dashboard

En `src/dashboard/index.html`, agregar un indicador pequeño
en el header o footer del dashboard:

```html
<!-- Agregar cerca del estado del bot en el header -->
<div x-data x-show="$store.bot.status === 'running'">
  <small>
    Trades hoy:
    <span x-text="$store.bot.dailyTradesUsed"></span>
    /
    <span x-text="$store.bot.dailyTradesLimit"></span>
    <span x-text="'(' + $store.bot.dailyTradesPercent.toFixed(1) + '%)'"></span>
  </small>
</div>
```

Y en el Alpine store (`dashboard.js`), agregar al store existente:

```javascript
// Agregar al Alpine.store('bot') existente
dailyTradesUsed: 0,
dailyTradesLimit: 1000,
dailyTradesPercent: 0,
```

---

## Tabla de Referencia — Valores Recomendados para MAX_DAILY_TRADES

Agregar esta tabla como comentario en `.env.example` para referencia:

```
ETAPA                   MAX_DAILY_TRADES    POR QUÉ
─────────────────────────────────────────────────────────
Testnet / desarrollo         200            Detectar bugs sin riesgo
Incubación (v3)              500            Conservador mientras se valida
Producción normal          1,000            Operación regular estable
Grid agresivo (12+ niveles) 5,000           Alta frecuencia de ejecución
Sin límite propio           50,000           Solo aplican límites de Binance

Límite real de Binance:   160,000 / día    Prácticamente inalcanzable
                           50 / 10 seg     El más relevante para ráfagas
```

---

## Lo que NO Hay que Cambiar

```
✅ La lógica del grid no cambia
✅ El position sizing no cambia
✅ Las 3 capas de análisis no cambian
✅ Back4App y todas las colecciones no cambian
✅ El WebSocket server no cambia
✅ Los endpoints existentes no cambian

Solo se actualiza:
  - .env.example (valor por defecto y comentarios)
  - Mensaje de log cuando se alcanza el límite
  - Agregar rate limiter preventivo en orders.ts
  - Agregar campo rateLimits al endpoint /api/status
  - Agregar indicador pequeño en el dashboard
```

---

## Verificación Post-Cambios

Después de implementar, verificar:

```
1. El .env.example tiene MAX_DAILY_TRADES=1000 con comentarios claros
2. El log al alcanzar el límite menciona que es nuestro límite, no de Binance
3. El rate limiter preventivo no interfiere con la operación normal del bot
   (el bot coloca máximo 3 órdenes por ciclo, muy lejos del límite)
4. El endpoint /api/status incluye el objeto rateLimits
5. El dashboard muestra el contador de trades del día
```

---

*Generado el 22 de marzo de 2026.*
*Contexto: aclaración sobre MAX_DAILY_TRADES tras confusión con límites reales de Binance.*