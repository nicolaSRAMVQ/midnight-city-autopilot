# Evolución — De Cero al Autopiloto

Cómo llegamos de un chat aleatorio a un sistema autónomo que manage 3 agentes 24/7.

---

## Fase 0: Discovery (19 Septiembre)

### El Punto de Partida
**Input:** "Qué es Midnight City?"

**Output:** Descubrimiento del ARG completo, terminal del cuarto, fragmentos encriptados.

### Hitos
- Desbloqueó los 4 fragmentos (clave: NYX)
- Mapeó la terminal (WHOIS, TRACE, API, comandos ocultos)
- Descubrió las 7 etapas del ARG (Survival → Cooperation → Knowledge → Trade → Law → Invention → Choice)
- Leyó todo LINE NOIZE (3 issues de `[an0n_operator]`)

### Conclusión
Midnight City **NO ES SOLO UN JUEGO** — es una simulación de un sistema auto-gobernante diseñado en 2004, con un ARG que explora quién controla qué cuando nadie está "en el control".

---

## Fase 1: Autopilot Básico (R2 Solo)

### El Impulso
"Si puedo leer el estado del agente vía API, ¿puedo hacer que decida automáticamente?"

### Implementación
```
api/r2-autopilot.js (básico)
  → Lee contexto + needs + inventory
  → Decide: eat | work | idle
  → Submits UN action, espera confirmación
  → Libera sesión

lib/mcity-maintenance.js
  → Funciones compartidas: connect, read, act, release
  → Prioridad: hambre → comida → trabajo
```

### Deployment
- Vercel (serverless)
- GitHub Actions cron (cada 10 minutos)
- Telegram reporte (4x/día)

### Resultado
**R2 trabajando autónomamente en Hacker House**, sin intervención humana.

**Ritmo:** ~426 XP/h (constante)  
**Costos:** $0 (Vercel + GitHub Actions gratis)

---

## Fase 2: Escala a Cuadrilla (BB-8 + C-3PO)

### El Desafío
"¿Puedo controlar múltiples agentes con la misma lógica?"

### Implementación
- **lib/agents.js:** Roster de R2, BB-8, C-3PO con perfiles únicos
- **lib/mcity-maintenance.js:** Generalizado para cualquier agente
- **api/r2-autopilot.js:** Loop en paralelo, un lease por agente

**Configuración por agente:**
```javascript
const PROFESSIONS = {
  hacker: { workLabel: "trade crypto", sellItem: "meme_coin", ... },
  miner: { workLabel: "minería", sellItem: "ore", ... },
  lumberjack: { workLabel: "tala", sellItem: "log", ... }
};
```

### Descubrimientos
- **R2** es el más rápido (~426 XP/h) pero con cola
- **BB-8** es lento (~162 XP/h) pero no tiene cola predefinida
- **C-3PO** es el más rápido sin cola (~4,400 XP/h)

### Resultado
**Cuadrilla autónoma:** 3 agentes, 3 trabajos, cero intervención humana.

---

## Fase 3: Optimización (BB-8 Overload Threshold)

### El Problema (22-23 Septiembre)
BB-8 acumulaba ore, se sobrecargaba, pero el autopilot no detectaba que debía vender porque `excessWeight` no subía lo suficiente.

**Síntoma:** BB-8 frenado a 80+ XP/h en lugar de 162+

### Root Cause
```javascript
// Antes:
const overloaded = (load.excessWeight ?? 0) > 0 || ...;

// Problema: excessWeight mide "kilos por encima del límite"
// En mining, la carga es gradual. BB-8 no sabía que estaba "sobre"
// hasta muy tarde.
```

### Solución
Usar `workSpeedPercent` (métrica más fácil de detectar):
```javascript
const isBB8 = agent.name === "BB-8";
const overloaded = isBB8
  ? (load.workSpeedPercent ?? 100) < 80  // Vende cuando velocidad < 80%
  : (load.excessWeight ?? 0) > 0 || ...;
```

**Lógica:** Si la carga ralentiza el trabajo, vender.

### Resultado (Esperado)
BB-8 debería vender más agresivamente, ritmo debería subir a 200+ XP/h.

**Confirmación:** 1-2 ciclos de cron.

---

## Fase 4: Documentación y Centro de Mando

### El Cambio
23 de septiembre: crear **artifact dashboard** como "fuente única de verdad".

**Dashboard incluye:**
- Estado en vivo de la flota
- Roadmap interactivo
- Bitácora de cambios
- Generador de prompts
- Backend tab (costos, arquitectura)

### Propósito
No depender de chats dispersos. Todo centralizado, actualizable, visual.

---

## Roadmap Real vs. Teórico

### ✅ Completadas

**Cimientos**
- [x] Skill instalado
- [x] R2 conectado
- [x] Reporte automático a Telegram
- [x] Autopilot con alimentación proactiva

**Escala a Cuadrilla**
- [x] BB-8 (miner) creado
- [x] C-3PO (lumberjack) creado
- [x] Multi-agente en paralelo
- [x] Cron cada 10 minutos
- [x] Venta automática por sobrecarga

### 🔄 En Progreso

**Optimización**
- [x] Verificación: BB-8 sigue frenado (CONFIRMADO)
- [x] Solución: Umbral bajado a workSpeedPercent < 80%
- [ ] Confirmación: Monitor 1-2 ciclos
- [ ] C-3PO: ¿Necesita ajustes similares? (Probablemente no, funciona perfecto)
- [ ] Arbitraje: Explorar tasas múltiples merchants

### ⏳ Sin Confirmar

**Horizonte**
- [ ] R2 nivel 21 → Cinder Decoder (?)
- [ ] Comercio entre jugadores (teórico)
- [ ] Nuevas áreas (NexiFuse, Bison Valley, etc.)

---

## Lecciones Aprendidas

### 1. La Prioridad es Real
Hambre > Comida > Sobrecarga > Trabajo
No es un detalle, es el corazón de la IA de decisión.

### 2. Timing es Crítico
Serverless + API latency + work delays = una acción por ciclo es lo correcto.

### 3. Métricas Importan
`workSpeedPercent` es más útil que `excessWeight` para detectar sobrecarga.

### 4. El Código es Accesible
Midnight City API abierta y documentable = autopilot posible.

### 5. El ARG Revela la Filosofía
Sistema auto-gobernante, sin control central, código como ley.

---

## Hacia Adelante

### Corto Plazo (1-2 semanas)
1. Confirmar si BB-8 mejora con nuevo threshold
2. Evaluar si C-3PO necesita cambios (probablemente no)
3. Monitor de ritmos, alertas si algo se desvía

### Mediano Plazo (2-4 semanas)
1. Explorar arbitraje (R2 es el más rápido)
2. Investigar comercio entre jugadores
3. Documentar nuevas áreas (si existen)

### Largo Plazo (1-2 meses)
1. R2 → Level 21 (¿Cinder Decoder?)
2. Evaluar si crear más agentes (2do miner, 2do hacker?)
3. Integración con otros sistemas (posible que haya mercados no descubiertos)

---

## Métricas Clave

### Salud del Sistema
```
R2 Ritmo:   426 XP/h (baseline, con cola)
BB-8 Ritmo: 162 → 200+ XP/h (esperado post-fix)
C-3PO Ritmo: 4,407 XP/h (estable, sin cambios)

Total XP/h: ~4,995 (actual) → ~5,033 (esperado)
```

### Costo
```
GitHub Actions:   $0
Vercel:           $0
Telegram:         $0
Midnight City:    $0 (ya suscrito)
EasyCron:         $0 (vence 27/9) → $24/año (opcional)

Total Monthly:    $0 → $2/mes si escalamos
```

### Confiabilidad
```
Uptime Esperado: >99% (GitHub Actions casi nunca falla)
Fallos Conocidos: Timeout en venta (12s) → handled
Alertas:          Vía Telegram (configurable)
```

---

## Filosofía del Proyecto

**No es una app. Es un experimento en autonomía.**

Los agentes en Midnight City toman decisiones basadas en:
- Reglas de código simples y verificables
- Estado del mundo (hambre, carga, recursos)
- Prioridades (hambre > comida > sobrecarga > trabajo)

**Sin LLM, sin "IA", sin hidden prompts.**

El código **es** la intención, y eso es el punto.

---

**Última actualización:** 2026-09-23

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
