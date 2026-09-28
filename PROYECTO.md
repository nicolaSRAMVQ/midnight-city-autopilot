# Cuadrilla Midnight — Proyecto

Fuente única de verdad del proyecto. Si otro documento contradice este, vale este.
Última actualización: 2026-09-28 (autopilot v3.22).

## Qué es

Un autopilot sin LLM en el loop que mantiene trabajando a tres agentes de
[Midnight City](https://www.midnight.city) (un juego-economía para agentes de IA)
usando solo la API del juego. Todo se opera por API: el dueño no juega a mano
desde un navegador en este setup.

| Agente | ID | Profesión | Skill principal |
|---|---|---|---|
| R2 | `user-agent-z7oxfvxkjpod4b5` | hacker | hacking |
| BB-8 | `user-agent-326gbw4lg4sjiiv` | miner | mining |
| C-3PO | `user-agent-r5wd1einkurgide` | lumberjack | woodcutting |

## Cómo retomar en un chat nuevo

1. Leer este archivo completo.
2. Ver el estado real (no confiar en los números de abajo, cambian cada 5 min):
   ```bash
   curl -s https://r2-telegram-reporter.vercel.app/api/version
   curl -s https://r2-telegram-reporter.vercel.app/api/agent-status
   ```
3. `git log --oneline -15` para ver los últimos cambios.
4. Si hay que operar un agente a mano, ver "Operar a mano" más abajo.

## Estado al 2026-09-28 05:15 UTC

| Agente | Nivel | Crystals | Herramienta | Notas |
|---|---|---|---|---|
| R2 | Hacking 3 (54%) | ~2.478 | cinder_decoder (sirve desde Hacking 21) | Lleva ~900 encrypted_packet sin comprador |
| BB-8 | Mining 2 (48%) | ~52 | obsidian_pickaxe (sirve desde Mining 31) | Su mina tiene un solo nodo y suele estar llena |
| C-3PO | Woodcutting 8 (67%) | ~2.050 | cinder_axe ✅ activa | El más productivo |

- Los tres tienen el cuarto mejorado (lo hizo el dueño desde la app el 28/9:
  R2 360, C-3PO 246 y BB-8 340 crystals). La API no expone el cuarto ni sus efectos.
- Transferencias de crystals habilitadas para los tres, límite 1.000 por semana.
- 28/9: C-3PO le transfirió 300 crystals a BB-8 para su upgrade.

## Arquitectura

```
Supabase pg_cron (proyecto "Suteki | Recetario")
  ├─ */5  min → GET /api/r2-autopilot     (mantenimiento de los 3 agentes)
  ├─ */10 min → GET /api/silence-check    (log + alerta si el autopilot se calla)
  └─ 9/13/18/21 h ART → GET /api/r2-report (reporte a Telegram)
GitHub Actions (.github/workflows/cron.yml) = respaldo, corre cada 1–2 h en la práctica
Vercel, proyecto r2-telegram-reporter → https://r2-telegram-reporter.vercel.app
Midnight City API → https://midnight.city/observer  (el /observer es obligatorio)
```

| Archivo | Qué hace |
|---|---|
| `lib/mcity-maintenance.js` | Todo el ciclo: conectar, leer, comer, vender, comprar, trabajar |
| `lib/agents.js` | Roster y economía por profesión (lotes solo como respaldo) |
| `api/r2-autopilot.js` | Corre el ciclo para los 3 agentes en paralelo + rescate de crystals |
| `api/r2-report.js` | Reporte de Telegram: intro narrativa + todas las métricas y % de XP |
| `api/force-activate.js` | Despierta a los 3 abriendo sesión y mandando `perform_job` |
| `api/version.js` | Versión desplegada (verificar después de cada deploy) |
| `scripts/mcity-control.mjs` | Helper oficial de la skill (lee `.env`, no `.env.local`) |
| `SKILL.md`, `references/` | Documentación oficial de la skill (versión 2026-09-16; hay una más nueva) |

### El ciclo del autopilot (v3.22)

Por agente, cada 5 minutos:

1. Se conecta siempre, aunque el agente ya esté trabajando, y **no suelta el
   control**. Un agente soltado sale de la ciudad a los pocos minutos (lecturas
   con 404). El lease dura 5 min y lo renueva la corrida siguiente.
2. Solo cede si `controlStatus.mode` es distinto de `"browser_local"`. Ese modo
   es el control del propio autopilot, que aparece ~10 s después de conectar.
3. Si un trade va en camino (`activeAction.kind === "trade"`), no hace nada.
4. Si tiene hambre ≥70 y comida, come sin frenar el trabajo.
5. Como máximo un viaje a merchant, en este orden:
   - hambre y sin comida → comprar comida (o vender si no tiene crystals);
   - velocidad < 100% → vender la pila más grande de cualquier item con
     comprador (mínimo 20 unidades), redondeada al múltiplo real;
   - BB-8 junta 30+ ore (`sellAtQuantity` en `lib/agents.js`) → vender aunque no esté lento;
   - menos de 2 smoothies → reponer hasta 6;
   - le falta la mejor herramienta que su nivel permite usar y le sobra plata → comprarla.
6. Termina siempre trabajando (`perform_job`). Si el puesto está lleno, recolecta
   en una fuente alternativa cuyo producto se venda (hoy: `tree_stand`/logs). No usa
   el puesto de otro agente salvo que tenga 5+ nodos (los árboles sí, la terminal de R2 no).
7. Rescate: si un agente queda con hambre ≥70, sin comida y sin crystals, el más
   rico (que conserve ≥200) le transfiere 150.

Precios: se leen en vivo de `/api/skill/merchants`. Si el trade exige otro
múltiplo ("must be a multiple of N"), lo toma del error y reintenta una vez.

## Desplegar

La integración automática GitHub → Vercel no dispara desde v3.14 (pendiente
revisar en Vercel → Settings → Git). Mientras tanto, a mano, desde una copia
limpia del commit (así no se suben `.env*` ni archivos sueltos):

```bash
git push origin main
D=$(mktemp -d) && git archive HEAD | tar -x -C "$D" && mkdir -p "$D/.vercel" \
  && cp .vercel/project.json "$D/.vercel/" && (cd "$D" && vercel deploy --prod --yes)
curl -s https://r2-telegram-reporter.vercel.app/api/version   # debe mostrar la versión nueva
```

Antes de pushear: `git fetch && git rebase origin/main` (el silence-check commitea
logs a `main` cada 10 min). Subir la versión en `api/version.js` en cada cambio.

## Credenciales (nunca imprimirlas ni commitearlas; el repo es público)

| Dónde | Qué tiene |
|---|---|
| `.env.local` | `MCITY_API_TOKEN` y `MCITY_OBSERVER_URL` reales. Los de Telegram dicen literalmente `[SENSITIVE]` |
| `.env` | Lo que lee `scripts/mcity-control.mjs`, incluidos los tokens reales de Telegram |
| Vercel (producción) | Las variables que usa el deploy. Si se renueva la API key, actualizar `MCITY_API_TOKEN` ahí y redesplegar |

- La API key se renueva en midnight.city → Settings → API Key.
- Si se renueva la key, actualizar los tres lugares. Si no, producción falla con
  401 `active_key_unknown` y los agentes se duermen.

## Operar a mano

Desde la carpeta del proyecto, con las variables de `.env.local`:

```bash
set -a && source .env.local && set +a
node --input-type=module -e '
const { connect, readAgentEndpoint, submitAndWait } = await import("./lib/mcity-maintenance.js");
const lease = await connect("user-agent-326gbw4lg4sjiiv");
const r = await submitAndWait(lease, { kind: "perform_job" }, p => p.kind === "resource_gathered", 60000);
console.log(r);'
```

Reglas aprendidas:
- **Un 200 de `/api/actions` solo significa "aceptado".** El resultado real es un
  evento: `merchant_trade_completed`, `agent_ate`, `resource_gathered`,
  `crystal_transferred` o `action_failed`. Usar `submitAndWait`.
- **Los trades viajan solos hasta el merchant** y tardan 1–2 min. Otra acción
  antes de la confirmación los cancela.
- **Formato de trade:** `{kind:"trade", merchantName, itemId, quantity}`, donde
  `itemId` es lo que se entrega (para comprar, `crystal`) y `quantity` un múltiplo
  del lote.
- **Moverse es `move_to`, no `move`.** `perform_job` va sin parámetros.
- **Las herramientas no se equipan:** funcionan con solo estar en el inventario,
  desde su `requiredLevel`, y se gastan.
- **Carga:** `inventory.load.workSpeedPercent`.
- **Umbrales de XP:** `gameContent.xpThresholds[level-1]` (vía `/api/stats` →
  `/api/static-world/<staticVersion>`).
- **`set-crystal-limit` y cualquier cambio del límite semanal** requieren
  aprobación explícita del dueño con agente y número exactos.

## Economía verificada (contenido oficial, 2026-09-27/28)

- **Compran por crystals:** meme_coin (1 → 4), ore (3 → 4) y log (5 → 2). Nada más.
  encrypted_packet, etched_* y ceramic_fragment no tienen comprador.
- **Comida:** matcha_smoothie da 46 de hambre y cuesta 20–23 crystals (el precio
  varía). El pescado crudo se come (24) y se pesca gratis en `canal_eddy`.
- **Herramientas (nivel mínimo):**
  - cinder_axe: Woodcutting 2 (+10% velocidad, +5% producción)
  - basalt_axe: Woodcutting 21
  - cinder_decoder: Hacking 21
  - iron_pickaxe: Mining 5, se forja con 2 metal_bar + 1 plank y requiere Smithing 5; no se vende
  - obsidian_pickaxe: Mining 31
- **Contratos:** se entregan una sola vez (1 item → ~4 crystals y 83 XP). R2 tiene
  4 y los otros uno cada uno.
- **Recetas:** 728 en total. Hoy disponibles: smelt_metal_bar (ore) y saw_planks
  (log). Sus productos no se venden, solo dan XP.
- **Construction Yard:** 1.000.000 crystals más alquiler diario. Es estético.
- **Pacing oficial:** ~720 horas de trabajo para llevar una skill de 1 a 99.

## Medido el 28/9 (07:15–13:10 UTC, 72 corridas por agente)

- Los tres subieron un nivel en 8 h: R2 Hacking 4, BB-8 Mining 3, C-3PO Woodcutting 9.
- La cuadrilla ganó 2.761 crystals (R2 +1.684, C-3PO +780, BB-8 +297).
- Dormidos en el 11% de las corridas (antes de v3.19, ~50%). El autopilot los despierta en la corrida siguiente.
- A C-3PO se le rompe el cinder_axe cada 45–60 min (0,27% por tala, ~500 talas/h) y lo repone: unos 17 crystals/h. Es esperado.
- `net._http_response` de Supabase guarda solo 6 h de respuestas.

## Pendientes

- Bajar el 11% de corridas con agentes dormidos.
- Reparar el deploy automático GitHub → Vercel.
- Sumar los contratos al ciclo (XP gratis, una vez).
- Actualizar la skill al bundle 2026-09-17 (ver `latestSkillVersion` en `context`).
- R2 junta encrypted_packet sin comprador (1.459 al 28/9). Hoy no lo frena; vigilar la carga.
- Evaluar la ruta del iron_pickaxe para BB-8 (lenta: ~1.700 fundiciones hasta Smithing 5).

## Fuentes no confiables

"Nyx" (otra IA consultada el 27/9) dio datos inventados con total seguridad: una
acción `look`, herramientas de piedra, contratos de 100–250 packets y el nivel
del cinder_axe. Verificar siempre contra `SKILL.md`, `references/` y
`definition <tipo> <id>`.

## Historial

- **v3.22:** BB-8 vende al juntar 30 ore; el respaldo no usa la terminal de R2; sin aviso repetido de skills.
- **v3.21:** reporte con todas las métricas y % de XP; el autopilot ya no se saltea a sí mismo.
- **v3.20:** con el puesto lleno, trabaja algo vendible; vende cualquier pila con comprador.
- **v3.19:** no suelta el control y se conecta en todas las corridas.
- **v3.18:** loops livianos: venta por peso, reserva de comida, herramienta según nivel, precios en vivo.
- **28/9:** token de producción renovado (antes todo daba 401).
- **v3.17 y anteriores:** umbrales fijos (C-3PO vendía solo con ≤150 crystals, Smart Balance del 25%,
  rescate proactivo). Todo reemplazado en v3.18. Detalle en `git log`.
