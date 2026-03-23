# BotCryptoIA — Grid Trading Bot

Bot de trading automatizado para XRP/USDC en Binance Spot con estrategia de Grid Trading. Incluye dashboard web en tiempo real con análisis por IA (Claude).

## Requisitos

- Node.js 18+
- npm 9+
- Cuenta en [Binance](https://binance.com) (o [Testnet](https://testnet.binance.vision) para pruebas)
- Cuenta en [Back4App](https://back4app.com) (base de datos)
- API Key de [Anthropic](https://console.anthropic.com) (para el agente IA)

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd bot-cripto

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
```

---

## Configuración de variables de entorno

Edita `.env.local` con tus credenciales:

```env
# Binance
BINANCE_API_KEY=tu_api_key
BINANCE_SECRET=tu_secret_key
BINANCE_TESTNET=true          # true = testnet (sin riesgo), false = producción

# Back4App (base de datos)
BACK4APP_APP_ID=tu_app_id
BACK4APP_JS_KEY=tu_js_key
BACK4APP_SERVER_URL=https://parseapi.back4app.com

# Anthropic (agente IA Capa 3)
ANTHROPIC_API_KEY=tu_api_key

# Bot
PAIR=XRP/USDC
ACTIVE_PERCENT=20             # % del balance que el bot puede operar
GRID_LEVELS=10
GRID_RANGE_PERCENT=6
STOP_LOSS_PERCENT=12
MAX_DAILY_TRADES=200

# Servidor
PORT=3000
LOG_LEVEL=info

# Desarrollo — simula balance y órdenes sin conectar a Binance
MOCK_BALANCE=true
```

> **Importante:** Nunca subas `.env.local` a Git. Está ignorado por defecto.

---

## Cómo obtener las API Keys

### Binance Testnet (recomendado para empezar)
1. Ve a [testnet.binance.vision](https://testnet.binance.vision)
2. Inicia sesión con tu cuenta de GitHub
3. Genera un API Key y cópialo en `BINANCE_API_KEY` y `BINANCE_SECRET`
4. Deja `BINANCE_TESTNET=true`

### Binance Producción
1. Ve a [binance.com](https://binance.com) → Perfil → Gestión de API
2. Crea una API Key con permisos de **Lectura** y **Trading Spot**
3. Cambia `BINANCE_TESTNET=false`

### Back4App
1. Crea una cuenta en [back4app.com](https://back4app.com)
2. Crea una nueva app
3. Ve a **App Settings → Security & Keys**
4. Copia el `Application ID` y el `JavaScript Key`

### Anthropic
1. Ve a [console.anthropic.com](https://console.anthropic.com)
2. Crea una API Key en la sección **API Keys**

---

## Ejecutar en desarrollo

```bash
npm run dev
```

El dashboard estará disponible en [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

> El modo desarrollo usa Turbopack por defecto. Si tienes problemas de compatibilidad con CCXT usa:
> ```bash
> npm run dev --webpack
> ```

---

## Ejecutar en producción

```bash
# Build (requiere --webpack por compatibilidad con CCXT)
npm run build --webpack

# Iniciar servidor
npm run start
```

---

## Modo simulación (sin dinero real)

Agrega en `.env.local`:

```env
MOCK_BALANCE=true
```

Con esta opción el bot:
- Usa el precio real de Binance (endpoints públicos, sin autenticación)
- Simula el balance y las órdenes en memoria
- Genera fills aleatorios (~25% de órdenes por ciclo)
- No realiza ninguna operación real en Binance

Ideal para probar la lógica y el dashboard sin riesgo.

---

## Estructura del proyecto

```
app/
  api/              → API routes (bot, trades, status, events SSE)
  dashboard/        → Dashboard principal
lib/
  types.ts          → Todos los tipos TypeScript
  config.ts         → Configuración centralizada desde env vars
  runtime.ts        → Estado en memoria del bot (singleton globalThis)
  exchange/         → Integración CCXT con Binance
  database/         → Back4App / Parse SDK
  analysis/         → Capas de análisis (Layer 1, 2, 3)
  bot/              → Motor del bot (engine, grid, risk, scheduler)
components/
  dashboard/        → Componentes del dashboard
  ui/               → shadcn/ui components
store/              → Estado global con Zustand
hooks/              → Custom React hooks
```

---

## Capas de análisis

| Capa | Qué hace | Cuándo se ejecuta |
|------|----------|-------------------|
| **Layer 1** | Risk Score (0–100) basado en ATR, Order Book y Volumen | Antes de cada orden |
| **Layer 2** | Probabilidad técnica: RSI, MACD, Bollinger Bands, VWAP | Si Layer 1 aprueba |
| **Layer 3** | Agente Claude AI — ajusta sesgo y configuración del grid | Por volatilidad, inactividad o periódicamente |

---

## Reglas de riesgo automáticas

- El bot se **detiene** si el precio cae fuera del rango del grid (`stop_loss_range`)
- El bot se **detiene** si el precio cae ≥ `STOP_LOSS_PERCENT` desde el inicio (`stop_loss_global`)
- El bot se **pausa** al alcanzar `MAX_DAILY_TRADES` operaciones en el día
- El bot **deja de abrir nuevas órdenes** al llegar a 20 operaciones abiertas y las **reanuda** al bajar a 10

---

## Scripts disponibles

```bash
npm run dev        # Desarrollo con hot-reload (Turbopack)
npm run build      # Build de producción
npm run start      # Servidor de producción
npm run lint       # ESLint
```
