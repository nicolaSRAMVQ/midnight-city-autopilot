# Cuadrilla Midnight — Contexto del Proyecto

**Última actualización:** 2026-09-23

## ¿Qué es?

Autopiloto serverless para 3 agentes IA en Midnight City (un juego online). Sin LLM en el loop — código puro llamando la API del juego.

**Agentes:**
- **R2** (Hacker) - trade crypto
- **BB-8** (Minero) - extrae ore
- **C-3PO** (Leñador) - extrae logs

## Roadmap — Estado Actual

### ✅ CIMIENTOS (100% completado)
- Skill instalado y R2 conectado
- Reporte automático 4x/día a Telegram
- Autopiloto: alimentación proactiva y reinicio de trabajo

### ✅ ESCALA A CUADRILLA (100% completado)
- BB-8 (minero) y C-3PO (leñador) creados
- Autopiloto multi-agente (ejecuta los 3 en paralelo)
- Cron cada 10 min para pelear la cola de los worksites
- Regla de venta por sobrecarga

### ✅ OPTIMIZACIÓN (100% completado)
- Medir si BB-8 sigue frenado por la cola de la mina
- Evaluar mandar a BB-8 a talar mientras espera lugar
- **[2026-09-23] Bajar el umbral de sobrecarga para BB-8** ← Último cambio

### ⏳ HORIZONTE (sin confirmar)
- R2: nivel 21 de Hacking habilita el Cinder Decoder
- Explorar si existe comercio con agentes de otros jugadores
- Confirmar si NexiFuse, Bison Valley o ADA Arena existen

## Cambios Recientes

### 2026-09-23: BB-8 Overload Threshold
**Problema:** BB-8 (minero) se quedaba atrapado con mucho ore acumulado, velocidad cayendo pero no vendía.

**Solución:** Cambio en `lib/mcity-maintenance.js`
```javascript
const isBB8 = agent.name === "BB-8";
const overloaded = isBB8
  ? (load.workSpeedPercent ?? 100) < 80 // BB-8: sell when speed < 80%
  : (load.excessWeight ?? 0) > 0 || (load.state && load.state !== "normal");
```

**Resultado:** BB-8 ahora vende ore más agresivamente cuando su velocidad cae por debajo del 80%.

## Estructura del Proyecto

```
.github/workflows/cron.yml   → GitHub Actions ejecuta autopilot cada 10 min
api/r2-autopilot.js          → Keep-alive (silencioso si todo bien)
api/r2-report.js             → Reporte a Telegram 4x/día
lib/agents.js                → Roster de agentes y economía por profesión
lib/mcity-maintenance.js     → Lógica compartida (connect, read, act)
```

## Notas Clave

1. **No hay LLM**: Los agentes no usan IA. Toda la estrategia está en código.
2. **Una acción por ciclo**: El autopiloto hace como máximo una acción por agente por corrida (limitación de tiempo serverless).
3. **Prioridad de acciones**: Hambre → Comida → Sobrecarga → Trabajar
4. **BB-8 es especial**: El minero acumula peso rápidamente, necesita un umbral más bajo que los otros.
5. **El cron corre gratis**: GitHub Actions da minutos ilimitados a repos públicos. Por eso el repo es público.

## Próximas Investigaciones

- ¿Qué tan efectiva es la nueva estrategia de BB-8?
- ¿C-3PO también necesita un umbral más bajo?
- ¿Hay oportunidades de arbitraje entre mercaderes?
- Exploración de nuevas áreas cuando R2 llegue a nivel 21

---

**Para futuros chats:** Lee esta archivo primero para no re-explicar el contexto.
