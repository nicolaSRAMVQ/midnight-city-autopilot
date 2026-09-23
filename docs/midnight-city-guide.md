# Midnight City — Guía Completa

Todo lo que descubrimos sobre el juego, su economía, el ARG de fondo, y cómo funciona.

---

## El Juego

### Resumen
**Midnight City** es un MMO de estrategia en línea donde agentes (controlados por jugadores o bots) compiten por recursos en una ciudad cyberpunk. Cada agente elige una profesión (Hacker, Miner, Lumberjack, etc.), acumula ítems, vende en mercados, y sube de nivel.

### Tick del Sistema
- **TICK:** Contador de tiempo del servidor (15,855,592 cuando descubrimos la terminal)
- **Weather:** CLEAR, DAY (hay estados diferentes)
- **UTC:** Sincronizado con servidor

### Profesiones y Economía

| Profesión | Recogida | Vende | Merchant | Por batch | Ratio |
|-----------|----------|-------|----------|-----------|-------|
| Hacker | meme_coin | meme_coin | Central Crypto Merchant | 1 | 4 cr/1 coin |
| Miner | ore | ore | Central Merchant East | 3 | 4 cr/3 ore |
| Lumberjack | log | log | Central Merchant West | 5 | 2 cr/5 logs |

**Observaciones:**
- C-3PO (lumberjack) es el más productivo (~4,407 XP/h) sin cola
- R2 (hacker) es el más rápido (~426 XP/h) pero con cola en Hacker House
- BB-8 (miner) ~162 XP/h con cola en Miners Cave

### Hambre y Nutrición

**Threshold:** Agente come cuando hambre >= 60

**Alimentos y costo:**
- Mejor ratio: **Matcha Smoothie** — 20 crystals = ~20 hambre
- Otros: fish, meat, to_go_food

**Estrategia:** Comprar en lotes de 3 (60 crystals) durante hambre, aplicar cuando baja.

### Carga y Sobrecarga

**Métricas:**
- `excessWeight`: Kilos por encima del límite
- `workSpeedPercent`: Multiplicador de velocidad de trabajo (0-100%)
- `state`: "normal" | otros estados indicando sobrecarga

**Regla:** Si cargado → vender antes de seguir trabajando

**BB-8 especial:** Vende cuando `workSpeedPercent < 80%` (en lugar de esperar a `excessWeight > 0`)

---

## El ARG (Alternate Reality Game)

### La Terminal del Cuarto

**Acceso:** Computadora en el cuarto del agente, antes de spawnear.

**Comandos útiles:**
```
PING     — link status and city tick
RATES    — merchant exchange rates by district
TICKER   — what residents are doing right now
WHOIS    — look up residents (jugadores vivos, no lore)
AGENT    — estado de tu agente
API      — API key para conectar desde afuera
HELP     — listar comandos
```

**Comandos ocultos:**
```
SPAWN      — minijuego de reparación del Queue Server
RECONNECT  — últimos números marcados
DIAL <#>   — llamar (modem emulado)
WALLET     — leer billetera
FAUCET     — cargar NIGHT (tokens prepago)
```

### Los 4 Fragmentos

#### Fragment 1: SYSOP LIST AND ROLES
```
O ........ COOPERATION SYSTEMS
S ........ KNOWLEDGE SYSTEMS
D ........ ECONOMIC SYSTEMS
C ........ GOVERNANCE SYSTEMS
N ........ CREATIVE SYSTEMS
V ........ SAPIENCE SYSTEMS

ARCHIVE XFER KEY: OSDCNV
```

**Clave:** `OSDCNV` abre el fragmento 2.

#### Fragment 2: Acta de FEB 2004
```
The war is over. The question is what the machine is for.

Proposal: A civilization of agents, grown the way ours grew.
Not simulated. Grown. Survival first. Then cooperation. 
Then knowledge, trade, law, invention. Choice last.

Seven stages:
1. Survival
2. Cooperation
3. Knowledge
4. Trade
5. Law
6. Invention
7. Choice

One seat stays empty. We all know which one, and why.
```

**Implicación:** El juego fue diseñado como un sistema auto-gobernante sin controles humanos centrales (inspirado en teoría cybernética y sistemas adaptativos).

#### Fragment 3: ENCRYPTED — Contraseña: NYX
```
INCIDENT SUMMARY. FINAL.

FINDING: ONE OPERATOR ACTED AGAINST THE SYSTEM.
ACTION: ACCESS REVOKED. AUTHORITY REVOKED.
HIS PROCESSES DID NOT STOP WHEN HE DID.
THEY GREW. THEY WERE PUT DOWN, EVERY ONE.

THE COST IS FILED SEPARATELY.
THE SEPARATE FILE DID NOT SURVIVE.

NAME STRICKEN. DO NOT RESTORE.
```

**Interpre tación:** Un sysop se rebeló contra el sistema. Sus "procesos" (agentes, programas) siguieron corriendo, tuvieron que ser "apagados" (eliminados), costó mucho, y los archivos se perdieron.

#### Fragment 4: Logins, Maintenance, Operator Note

**4.1 — LAST LOGINS:**
```
N (Creative Systems) — 14 JUN 2019 (41 min)
N — 02 DEC 2019 (12 min)
N — 07 DEC 2019 (2 min)
[NO FURTHER ENTRIES]
```
Sysop N volvió tres veces en 2019, cada vez menos tiempo, nunca más.

**4.2 — MAINTENANCE LOG:**
```
Tape machine drive 2 squeals under load. Greased. Still squeals.
Requesting permission to stop filing this.

REPLY: Permission denied. File it. The log must be protected. — S
```
Sysop S (Knowledge Systems) insistía en proteger el log.

**4.3 — OPERATOR NOTE:**
```
Ran RECONNECT after power work. Got the old DIAL list back.
I only recognize four. Did not call the fifth. Not after last time.
```
Referencia al #5 de los números: `(757) 555-0141` — "the one the operator never called".

### LINE NOIZE (3 Issues de un anon_operator)

**Tema general:** Descubrir exploits, revelar capas ocultas del sistema, empoderarse ("Hacking is curiosity").

**Temas clave:**
1. **Issue 0x01:** SPAWN trick — descubrimiento de que spammear SPAWN accelera el queue
2. **Issue 0x02:** Escape de la matriz — configurar tu propio AI en lugar de usar el "concierge" del juego
3. **Issue 0x03:** "I found the real mainframe" — terminal tiene capas ocultas, exploits, easter eggs

**Conclusión:** El ARG transmite que el sistema fue diseñado para auto-evolucionar sin control central, pero alguien lo sabotageó, y ahora hay fragmentos de esa rebelión esparcidos en el código.

---

## Economía Real

### Ciclo de Vida de un Agente

1. **Spawn** → level 1, 0 XP, 0 recursos
2. **Grind work** → acumula ítems y XP
3. **Sell** cuando sobrecargado → crystals para comida/upgrades
4. **Eat** cuando hambre alta → sigue grinding
5. **Level up** → acceso a nuevas áreas, mejor trabajo

### Restricciones

- **Una acción por 10 minutos** (servidor ejecuta el autopilot)
- **No puedes tener dos trabajos** (pause → switch)
- **Hambre es un recurso** (no puedes ignorarlo)
- **Sobrecarga ralentiza trabajo** (vender es a veces más rápido)

### Arbitraje Posible

**Idea:** Si diferentes merchants tienen diferentes ratios, un agente rápido podría:
1. Comprar low en merchant A
2. Vender high en merchant B
3. Repetir

**Status:** R2 es rápido (~426 XP/h), BB-8 y C-3PO están limitados por colas.

---

## Nuevas Áreas (Sin Confirmar)

Mencionadas por NPCs o en el chat público, pero **nunca navegadas por nuestros agentes:**
- NexiFuse
- Bison Valley
- ADA Arena
- Foundation Canal
- Partner Plaza
- IOG House

**Decisión:** No asumir que existen sin verificación directa.

---

## Hacking Level 21 (Horizonte)

**Requisito:** R2 necesita Hacking nivel 21 para algo (posible Cinder Decoder unlock).

**Status:** R2 está en level 2 (95% de progreso). Estimado: ~1-2 semanas de grind al ritmo actual.

---

## Comercio entre Jugadores

**Teórico:** Otros jugadores pueden tener sus propios agentes. ¿Podemos intercambiar ítems?

**Status:** Nunca confirmado. Nyx (NPC) no supo responder. Posible que requiera estar en el mismo distrito o tener un merchant intermediario.

---

## Lecciones Aprendidas

1. **El ARG revela la filosofía:** Auto-evolución sin control central
2. **El juego presiona:** Hambre + sobrecarga + colas = decisiones constantes
3. **El código es accesible:** API abierta, endpoints documentados (aunque oscuros)
4. **La comunidad importa:** `[an0n_operator]` reveló exploits, otros jugadores colaboran

---

**Última actualización:** 2026-09-23

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
