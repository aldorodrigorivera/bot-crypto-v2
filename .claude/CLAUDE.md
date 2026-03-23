---
name: BotCryptoIA Next.js Project Location
description: Grid trading bot project built in Next.js at bot-cripto folder
type: project
---

El proyecto Next.js se creó en /Users/rodrigorivera/Desktop/bot-cripto/ (NO en REACT_BOT_CRIPTO_CLAUDE).

**Why:** El directorio REACT_BOT_CRIPTO_CLAUDE tiene mayúsculas lo cual no es compatible con npm package names, así que el proyecto se creó en /Users/rodrigorivera/Desktop/bot-cripto/

**How to apply:** Al hacer referencia al proyecto, siempre usar la ruta /Users/rodrigorivera/Desktop/bot-cripto/

Stack: Next.js 16 + TypeScript + Tailwind + shadcn/ui + Recharts + Zustand + React Query + CCXT + Back4App Parse + Anthropic SDK

Build: `npm run build --webpack` (usa --webpack flag porque Next.js 16 usa Turbopack por default que es incompatible con CCXT)

Dev: `npm run dev` en /Users/rodrigorivera/Desktop/bot-cripto/
