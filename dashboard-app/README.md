# Cuadrilla Midnight Dashboard

Dashboard React en vivo para monitorear los 3 agentes de Midnight City (R2, BB-8, C-3PO) en tiempo real.

## Features

✅ **Datos en vivo** — Traer datos cada 30 segundos desde la API  
✅ **Dark mode** — Diseño oscuro con colores por profesión  
✅ **Responsive** — 3 columnas en desktop, 1 en móvil  
✅ **Indicadores visuales** — Colores y badges para estado  
✅ **Auto-refresh** — Actualización automática cada 30s  
✅ **Error handling** — Fallback si API no responde

## Stack

- Next.js 14+ (React 18)
- Tailwind CSS
- TypeScript
- Fetch API (no CORS issues)

## Setup

```bash
cd dashboard-app
npm install
npm run dev
```

Open http://localhost:3000

## Deploy a Vercel

```bash
vercel deploy --prod
```

## API Endpoint

`https://r2-telegram-reporter.vercel.app/api/agent-status`

Retorna:
```json
{
  "success": true,
  "timestamp": "2026-09-23T...",
  "agents": [
    {
      "name": "R2",
      "profession": "hacker",
      "level": 2,
      "xpPercent": 95,
      "hunger": 46,
      "crystals": 1848,
      "working": false,
      "speed": 100,
      "location": "Hacker House",
      "skill": "hacking L2"
    },
    ...
  ]
}
```

## Colores de profesión

- **R2 (Hacker)**: Cyan `#3ec6ff`
- **BB-8 (Miner)**: Orange `#ff9a4d`
- **C-3PO (Lumberjack)**: Purple `#c39bff`

## Status Badges

- ⚠️ **Hambre** — Hambre > 80
- ✓ **Trabajando** — Working = true
- ○ **OK** — Estado normal
