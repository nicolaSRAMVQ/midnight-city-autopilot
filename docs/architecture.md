# Arquitectura — Cuadrilla Midnight

El autopiloto es **código puro sin LLM** que llama la API de Midnight City directamente.

---

## Stack

```
GitHub Actions (scheduler)
        ↓
   Vercel Serverless
        ↓
  lib/mcity-maintenance.js
        ↓
  Midnight City API
        ↓
  Agent state (context, needs, inventory, progression)
```

- **GitHub Actions:** Cron cada 10 minutos (público = gratis)
- **Vercel:** Runtime Node.js, <120 segundos timeout
- **Midnight City API:** `https://midnight.observer/api/...` (observer endpoint)
- **Telegram:** Webhook para reportes

---

## Flujo del Autopilot (api/r2-autopilot.js)

### 1. Schedule
```
Cada 10 minutos:
  TRIGGER: GitHub Actions cron
  → POST https://vercel.app/api/r2-autopilot
```

### 2. Fetch de Agentes
```
Para cada agente (R2, BB-8, C-3PO):
  - Leer estado sin conectar (plain read)
  - Chequear: ¿está en uso? ¿ya trabajando? ¿hambre baja?
  - Si no hay nada que hacer → skip (save API calls)
  - Si hay que hacer algo → connect con lease
```

### 3. Decisión (Prioridad)
```
IF hunger >= 60:
  IF working: stop_job
  ELSE IF has_food: eat
  ELSE IF has_crystals: trade(food_merchant)
  ELSE IF has_sellable_items: trade(sell)
  ELSE: alert_telegram("Hambriento sin recursos")

ELSE IF overloaded:
  IF has_sellable_items: trade(sell)

ELSE:
  IF not_working: perform_job
```

### 4. Acción Única
```
Submits ONE action per run:
  → submitAndWait(action, matchSuccess, 8-12 segundos)
  
Si timeout:
  → No forzar, dejar que el servidor lo termine
  → Chequear en la próxima corrida
```

### 5. Release
```
Libera la sesión (lease)
→ Otros jugadores pueden conectar
```

---

## Modelo de Datos

### Agent Profile
```javascript
{
  name: "R2",
  id: "user-agent-z7oxfvxkjpod4b5",
  profession: "hacker",
  profile: {
    workLabel: "trade crypto",
    sellItem: "meme_coin",
    merchant: "Central Crypto Merchant",
    batch: 1,
    crystalsPerBatch: 4
  }
}
```

### Agent State (lectura)
```javascript
{
  context: {
    agent: { level, xp, xpNext, isPerformingJob, ... },
    controlStatus: null (idle) | "someone-else"
  },
  needs: { hunger: { value: 0-100 } },
  inventory: {
    inventory: { meme_coin: 10, crystal: 5, ... },
    load: { excessWeight, workSpeedPercent, state }
  },
  progression: { skillXp, ... }
}
```

### Action (escritura)
```javascript
{
  kind: "eat" | "stop_job" | "trade" | "perform_job",
  merchantName: "...",
  itemId: "...",
  quantity: number
}
```

---

## BB-8 Overload Logic (2026-09-23)

**Problema:** BB-8 (miner) acumula ore rápido, pero `excessWeight` no sube hasta que está muy lleno. Entonces se queda frenado sin vender.

**Solución:**
```javascript
const isBB8 = agent.name === "BB-8";
const overloaded = isBB8
  ? (load.workSpeedPercent ?? 100) < 80  // Sell if speed < 80%
  : (load.excessWeight ?? 0) > 0 || (load.state && load.state !== "normal");
```

**Resultado:** BB-8 ahora vende ore cuando la velocidad de trabajo cae por debajo del 80%, no espera a excessWeight.

---

## Timing y Serverless

### Problema
- `perform_job` puede tardar 10-15 segundos (cruzar distritos, iniciar trabajo)
- Serverless timeout ~55 segundos para Vercel
- Si espero hasta que termine → timeout, se interrumpe

### Solución
```
submitAndWait(action, matchSuccess, SLOW_ACTION_WAIT_MS = 12_000):
  1. Submit action
  2. Poll recent-events por 12 segundos
  3. Si aparece el evento: return { confirmed: true }
  4. Si timeout: return { confirmed: false, reason: "timeout" }
  5. En próxima corrida: chequear nuevo estado

El trabajo sigue en el servidor, aunque no esperemos confirmación.
```

### Ventaja
- **No bloquea el servidor** (no espera a que termine)
- **Rápido para el cliente** (sale en 12s, serverless sigue)
- **Idempotente** (chequear de nuevo después)

---

## Costo en Operación

### Zero AI Tokens
- Autopilot = código puro, sin LLM
- Reporte = log parsing + Telegram POST
- **No hay costo de tokens Claude durante operación**

### Midnight City API
- ~6 agentes × 10 endpoints/corrida × 144 corridas/día = ~8,640 llamadas
- Observer endpoint es gratis para el usuario
- No hay rate limit conocido

### Vercel
- 144 corridas/día × ~50ms = 7.2 segundos de compute/día
- Très dentro del free tier (500GB-hours/mes)

---

## Mejoras Posibles

1. **Arbitraje:** R2 es el más rápido (~426 XP/h). Monitorear precios de múltiples mercaderes, vender al mejor.
2. **Caché de precios:** Guardar rates en redis, no consultar cada corrida.
3. **Predicción:** Si la cola de R2 crece, movimiento preventivo (no esperar a que se frene).
4. **Logging:** Guardar cada acción en DynamoDB/Postgres para analizar después.
5. **Alertas:** Telegram cuando algo falla (sin spam si es timeout normal).

---

**Última actualización:** 2026-09-23

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
