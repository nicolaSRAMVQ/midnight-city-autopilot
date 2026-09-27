/**
 * Shared Midnight City connect/read/act helpers for the whole droid crew.
 * Used by api/r2-report.js (full Telegram report, 4x/day) and
 * api/r2-autopilot.js (keep-alive every 30 min, silent on success).
 *
 * Design notes (all verified against the live game):
 * - Plain reads (context/needs/inventory/progression) work without a lease
 *   while the agent is active; a 404 means it is dormant, which is just as
 *   "free" as controlStatus === null.
 * - recent-events and actions need a lease (5 min TTL). We only connect when
 *   nobody else is already connected, so we never take over from the human.
 * - Jobs and actions keep running server-side after we release the lease.
 * - trade/perform_job auto-navigate across districts and can take longer than
 *   a serverless invocation, so we do ONE slow action per run and wait only
 *   briefly; the next cycle continues from the server-side state.
 */

const OBSERVER_URL = process.env.MCITY_OBSERVER_URL;
const API_TOKEN = process.env.MCITY_API_TOKEN;

// v3.8: Optimized autonomy thresholds (sep 25)
export const HUNGER_WORK_THRESHOLD = 60;     // Normal work range
export const HUNGER_EAT_THRESHOLD = 70;      // v3.8: Lowered from 80 → gradual eating, less panic
export const HUNGER_CRITICAL = 90;           // If hits this, absolute priority to eat
const FAST_ACTION_WAIT_MS = 8_000; // local actions: eat, stop_job
const SLOW_ACTION_WAIT_MS = 8_000; // v3.8: Reduced from 12s → faster cycles (no cross-district delay)
const ACTION_POLL_MS = 1_000;
export const FOOD_ITEM_IDS = ["matcha_smoothie", "fish", "meat", "to_go_food"];

// v3.8: BB-8 preventive mining + Optimized wood selling
const BB8_CRYSTAL_EMERGENCY = 100; // v3.8: Increased from 50 → preventive, never runs out of crystals
const WOOD_SELL_THRESHOLD = 150; // v3.8: Increased from 100 → fewer merchant trips, more work time

// v3.13: Trade retry logic — prevent single timeout from blocking resource sales
const TRADE_MAX_RETRIES = 3; // Retry up to 3 times if timeout
const TRADE_RETRY_DELAY_MS = 2_000; // Wait 2s between retries (network/timing glitches)

// v3.14: Cooldown-aware backoff — a "failed" result with a rate-limit-ish
// reason means the server actively rejected us (not a network hiccup). Retrying
// after 2s just hits the same cooldown again; wait much longer instead.
const COOLDOWN_MAX_RETRIES = 2; // fewer attempts — each one costs real wall-clock time
const COOLDOWN_RETRY_DELAY_MS = 45_000; // 45s: long enough to clear typical game cooldowns
const COOLDOWN_REASON_PATTERN = /cooldown|rate|too many|wait|busy|queue|throttle/i;

function looksLikeCooldown(reason) {
  return typeof reason === "string" && COOLDOWN_REASON_PATTERN.test(reason);
}

// Best price/hunger ratio: 20 crystal -> 1 smoothie (~20 hunger in practice).
const FOOD_MERCHANT = "Central Smoothies Matcha Outlet";
const FOOD_ITEM_ID = "matcha_smoothie";
export const FOOD_COST_CRYSTAL = 20;
const FOOD_BATCH_SIZE = 6; // smoothies per shopping trip (v3.7: increased from 3 for autonomy)
const CRYSTAL_BUFFER_TARGET = FOOD_BATCH_SIZE * FOOD_COST_CRYSTAL; // 120 crystals

// v3.14: Crystal lifeline between agents — last resort after selling failed.
// A donor never gives away crystals that would put IT in danger: it must keep
// at least this much left over. This is what stops the circular case where
// the "rich" agent is itself only barely OK.
export const RESCUE_TRANSFER_AMOUNT = 150;
export const DONOR_SAFE_MINIMUM = 200; // must have RESCUE_TRANSFER_AMOUNT + buffer left after giving

export const NOTABLE_EVENT_KINDS = new Set([
  "resource_gathered",
  "merchant_trade_completed",
  "item_crafted",
  "equipment_changed",
  "agent_ate",
  "agent_woke",
  "construction_changed",
  "contract_completed",
  "enemy_defeated",
  "action_failed",
]);

export async function requestJson(path, init = {}) {
  const response = await fetch(`${OBSERVER_URL}${path}`, {
    signal: AbortSignal.timeout(10_000),
    ...init,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(`${path} failed: HTTP ${response.status} ${text}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function readAgentEndpoint(agentId, endpoint) {
  return requestJson(`/api/skill/agents/${encodeURIComponent(agentId)}/${endpoint}`);
}

export async function connect(agentId) {
  const response = await requestJson("/api/local-control/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, clientInstanceId: `vercel-autopilot:${agentId}`, modelId: null }),
  });
  return { sessionId: response.sessionId, token: response.token, agentId };
}

export async function release(lease) {
  await requestJson("/api/local-control/session/release", {
    method: "POST",
    headers: { Authorization: `Bearer ${lease.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: lease.sessionId }),
  }).catch(() => null);
}

async function postAction(lease, action) {
  await requestJson("/api/actions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lease.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...action, agentId: lease.agentId }),
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchRecentEvents(agentId) {
  const response = await readAgentEndpoint(agentId, "recent-events?limit=100");
  return Array.isArray(response?.recentEvents) ? response.recentEvents : [];
}

// Submits an action and waits for a matching event or failure. Best-effort:
// on timeout returns {confirmed: false} instead of throwing.
export async function submitAndWait(lease, action, matchSuccess, waitMs = FAST_ACTION_WAIT_MS) {
  const before = new Set((await fetchRecentEvents(lease.agentId)).map((e) => e.eventId));
  await postAction(lease, action);
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const events = await fetchRecentEvents(lease.agentId);
    for (const event of events) {
      if (before.has(event.eventId)) continue;
      const p = event.payload;
      if (!p || p.agentId !== lease.agentId) continue;
      if (p.kind === "action_failed" && p.actionKind === action.kind) {
        return { confirmed: false, failed: true, reason: p.reason };
      }
      if (matchSuccess(p)) return { confirmed: true, payload: p };
    }
    await sleep(ACTION_POLL_MS);
  }
  return { confirmed: false, failed: false, reason: "timeout" };
}

// v3.13/v3.14: submitAndWaitWithRetry — retries with backoff that depends on
// WHY the previous attempt didn't confirm:
//   - timeout (no response at all)      → short retry, likely a network blip
//   - failed with a cooldown-ish reason → long retry, the server is actively
//     rejecting us and hammering it again immediately just burns attempts
//   - failed with any other reason      → give up immediately (e.g. "not
//     enough inventory" won't fix itself by waiting)
export async function submitAndWaitWithRetry(lease, action, matchSuccess, waitMs = SLOW_ACTION_WAIT_MS, maxRetries = TRADE_MAX_RETRIES) {
  let attempt = 0;
  let cooldownAttempts = 0;
  while (true) {
    attempt += 1;
    const result = await submitAndWait(lease, action, matchSuccess, waitMs);
    if (result.confirmed) return result;

    if (result.failed && looksLikeCooldown(result.reason)) {
      cooldownAttempts += 1;
      if (cooldownAttempts >= COOLDOWN_MAX_RETRIES) return { ...result, retriesExhausted: "cooldown" };
      await sleep(COOLDOWN_RETRY_DELAY_MS);
      continue;
    }
    if (result.failed) return result; // hard failure, not cooldown-shaped — don't retry

    // Plain timeout (no failure event observed at all).
    if (attempt < maxRetries) {
      await sleep(TRADE_RETRY_DELAY_MS);
      continue;
    }
    return { ...result, retriesExhausted: "timeout" };
  }
}

export function summarizeEvent(event) {
  const p = event.payload;
  switch (p.kind) {
    case "resource_gathered":
      return `⛏️ Recolectó ${p.quantity}x ${p.itemId} (total: ${p.total})`;
    case "merchant_trade_completed":
      return `💱 Trade en ${p.merchantName}: ${p.soldQuantity ?? "?"}x ${p.soldItemId ?? "?"} ➔ ${p.receivedQuantity ?? "?"}x ${p.receivedItemId ?? "?"}`;
    case "item_crafted":
      return `🛠️ Crafteó ${p.recipeId} (x${p.batches})`;
    case "equipment_changed":
      return p.itemId ? `🎽 Equipó ${p.itemId} en ${p.slot}` : `🎽 Desequipó ${p.slot}`;
    case "agent_ate":
      return `🍽️ Comió ${p.itemId} (hambre ${p.hungerBefore}→${p.hungerAfter})`;
    case "agent_woke":
      return `😴 Se despertó`;
    case "construction_changed":
      return `🏗️ Construcción ${p.siteId}: ${p.status}`;
    case "contract_completed":
      return `📜 Completó contrato ${p.contractId}`;
    case "enemy_defeated":
      return `⚔️ Derrotó a ${p.enemyId}`;
    case "action_failed":
      return `⚠️ Falló ${p.actionKind}: ${p.reason ?? "sin razón"}`;
    default:
      return null;
  }
}

// Plain (unconnected) read. Returns null if the agent is dormant (404).
export async function tryReadWithoutConnecting(agentId) {
  try {
    const [context, needs, inventory, progression] = await Promise.all([
      readAgentEndpoint(agentId, "context"),
      readAgentEndpoint(agentId, "needs"),
      readAgentEndpoint(agentId, "inventory"),
      readAgentEndpoint(agentId, "progression"),
    ]);
    return { context, needs, inventory, progression };
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

// v3.15: A worksite-full rejection isn't the same as "try again later" — the
// agent has 20+ other gatherable skills sitting unused (see progression's
// capabilities.sources) while it waits. QUEUE_FULL_PATTERN recognizes that
// specific rejection reason (observed live as e.g. "worksite queue is full
// at miners-cave" / "at hacker-house-interior") vs. any other failure, which
// should still just report and retry next cycle rather than go fishing for
// an unrelated skill to level.
const QUEUE_FULL_PATTERN = /queue is full/i;

export async function startWork(lease, agent, autopilotNotes, label, progression = null) {
  const result = await submitAndWait(
    lease,
    { kind: "perform_job" },
    (p) => p.kind === "resource_gathered",
    SLOW_ACTION_WAIT_MS,
  );
  if (result.confirmed) {
    autopilotNotes.push(`▶️ ${label} (${agent.profile.workLabel})`);
    return;
  }

  if (result.failed && QUEUE_FULL_PATTERN.test(result.reason ?? "") && progression) {
    const altSource = (progression.capabilities?.sources ?? []).find(
      (s) => s.sourceId !== agent.profile.primarySourceId && s.failureReason === null && (s.availableNodeIds?.length ?? 0) > 0,
    );
    if (altSource) {
      const gather = await submitAndWait(
        lease,
        { kind: "gather", sourceId: altSource.sourceId },
        (p) => p.kind === "resource_gathered",
        SLOW_ACTION_WAIT_MS,
      );
      autopilotNotes.push(
        gather.confirmed
          ? `🔀 Bottleneck: ${agent.profile.workLabel} sin lugar — recolectando ${altSource.sourceId} (${altSource.skill}) mientras espera`
          : `⏳ Bottleneck: ${agent.profile.workLabel} sin lugar, alternativa ${altSource.sourceId} sin confirmar (${gather.reason})`,
      );
      return;
    }
  }

  if (result.failed) {
    autopilotNotes.push(`⏳ No pudo iniciar ${agent.profile.workLabel}: ${result.reason} — reintenta en el próximo ciclo`);
  } else {
    autopilotNotes.push(`⚠️ Intentó iniciar ${agent.profile.workLabel} (${result.reason}) — probablemente sigue viajando, se confirma solo`);
  }
}

// Connects, re-reads fresh state, fetches the activity log, and nudges the
// agent toward its objective (feed proactively, otherwise keep working).
// Only call when nobody else is connected. Never throws — on failure returns
// the fallback state plus an error.
export async function runConnectedMaintenance(agent, fallback) {
  const autopilotNotes = [];
  let lease = null;
  try {
    lease = await connect(agent.id);
    const read = (endpoint) => readAgentEndpoint(agent.id, endpoint);

    const [context, needs, inventory, progression] = await Promise.all([
      read("context"), read("needs"), read("inventory"), read("progression"),
    ]);
    const current = context.agent;

    const events = await fetchRecentEvents(agent.id);
    const activityLog = events
      .filter((e) => e.payload?.agentId === agent.id && NOTABLE_EVENT_KINDS.has(e.payload.kind))
      .map(summarizeEvent)
      .filter(Boolean)
      .slice(-5)
      .reverse();

    const items = inventory.inventory || {};
    const hunger = needs.hunger?.value ?? 0;
    const hasFood = FOOD_ITEM_IDS.some((id) => (items[id] ?? 0) > 0);
    const crystals = items.crystal ?? 0;
    const { sellItem, merchant, batch, crystalsPerBatch, workLabel } = agent.profile;
    const sellable = items[sellItem] ?? 0;
    const sellableBatches = Math.floor(sellable / batch);
    // Carrying too much slows work down (C-3PO dropped to 33% speed with 372
    // logs). Sell the surplus of whatever this profession produces.
    // BB-8 (miner) gets a lower threshold: sell when work speed drops below 80%.
    const load = inventory.load || {};
    const isBB8 = agent.name === "BB-8";
    const overloaded = isBB8
      ? (load.workSpeedPercent ?? 100) < 80 // BB-8: sell when speed drops below 80%
      : (load.excessWeight ?? 0) > 0 || (load.state && load.state !== "normal");

    // One action per cycle, in priority order (see header notes).
    // v3.2: Hunger thresholds: 60-80=normal work, >80=emergency eat, >90=absolute priority
    if (hunger >= HUNGER_CRITICAL || (hunger >= HUNGER_EAT_THRESHOLD && current.isPerformingJob)) {
      const stop = await submitAndWait(
        lease,
        { kind: "stop_job" },
        (p) => p.kind === "activity_completed" && p.activity === "stop_job",
      );
      autopilotNotes.push(stop.confirmed ? "⏸️ Pausó el trabajo para comer" : "⚠️ No pausó, intentando comer de todas formas");

      // v3.10: CRITICAL hunger fix — eat or buy+eat REGARDLESS of pause success
      if (hunger >= HUNGER_CRITICAL) {
        if (hasFood) {
          const eat = await submitAndWait(lease, { kind: "eat" }, (p) => p.kind === "agent_ate", FAST_ACTION_WAIT_MS);
          autopilotNotes.push(eat.confirmed ? `🍽️ CRÍTICO: Comió` : `⚠️ CRÍTICO: No pudo comer`);
        } else if (crystals >= FOOD_COST_CRYSTAL) {
          const buy = await submitAndWait(
            lease,
            { kind: "trade", merchantName: FOOD_MERCHANT, itemId: "crystal", quantity: FOOD_COST_CRYSTAL },
            (p) => p.kind === "merchant_trade_completed" && p.merchantName === FOOD_MERCHANT,
            SLOW_ACTION_WAIT_MS,
          );
          if (buy.confirmed) {
            const eat = await submitAndWait(lease, { kind: "eat" }, (p) => p.kind === "agent_ate", FAST_ACTION_WAIT_MS);
            autopilotNotes.push(`🍽️ CRÍTICO: Compró + comió`);
          } else {
            autopilotNotes.push(`⚠️ CRÍTICO: Intentó comprar comida pero falló`);
          }
        } else {
          // v3.13: Emergency sales — try to sell ANY item from toolkit with retries
          const sellables = agent.profile.sellableItems || [];
          let soldSomething = false;
          for (const { item: itemId, merchant: merchantName, rate } of sellables) {
            const quantity = Math.min(items[itemId] ?? 0, Math.max(1, Math.floor(FOOD_COST_CRYSTAL * 1.5 / rate)));
            if (quantity > 0) {
              // v3.13: Retry on timeout for emergency sales
              const sale = await submitAndWaitWithRetry(
                lease,
                { kind: "trade", merchantName, itemId, quantity },
                (p) => p.kind === "merchant_trade_completed" && p.merchantName === merchantName,
                SLOW_ACTION_WAIT_MS,
              );
              if (sale.confirmed) {
                autopilotNotes.push(`💰 EMERGENCIA: Vendió ${quantity}x ${itemId} → compra comida`);
                soldSomething = true;
                break;
              }
            }
          }
          if (!soldSomething) autopilotNotes.push(`🆘 CRÍTICO: Sin comida, crystals ni items para vender después de ${TRADE_MAX_RETRIES} reintentos`);
        }
      }
    } else if (hunger >= HUNGER_EAT_THRESHOLD && hasFood) {
      const eat = await submitAndWait(lease, { kind: "eat" }, (p) => p.kind === "agent_ate");
      autopilotNotes.push(
        eat.confirmed
          ? `🍽️ Comió ${eat.payload.itemId} (hambre ${eat.payload.hungerBefore}→${eat.payload.hungerAfter})`
          : `⚠️ No pudo confirmar que comiera (${eat.reason ?? "sin datos"})`,
      );
      // Eating is local and instant: chain straight into resuming work.
      if (eat.confirmed) await startWork(lease, agent, autopilotNotes, "Retomó el trabajo", progression);
    } else if (hunger >= HUNGER_EAT_THRESHOLD && crystals >= FOOD_COST_CRYSTAL) {
      // v3.11: Buy food in safe batches (try FOOD_BATCH_SIZE first, fall back to 1 if merchant rejects)
      const desiredCost = FOOD_BATCH_SIZE * FOOD_COST_CRYSTAL; // Try 120 first
      const safeBackup = FOOD_COST_CRYSTAL; // Fall back to 20
      const cost = crystals >= desiredCost ? desiredCost : safeBackup;
      const buy = await submitAndWait(
        lease,
        { kind: "trade", merchantName: FOOD_MERCHANT, itemId: "crystal", quantity: cost },
        (p) => p.kind === "merchant_trade_completed" && p.merchantName === FOOD_MERCHANT,
        SLOW_ACTION_WAIT_MS,
      );
      if (buy.confirmed) {
        const numFood = cost / FOOD_COST_CRYSTAL;
        autopilotNotes.push(`🛒 Compró ${numFood}x ${FOOD_ITEM_ID}`);
        // v3.2 FIX: Chain eat immediately after buying food (don't wait for next cycle)
        const eat = await submitAndWait(lease, { kind: "eat" }, (p) => p.kind === "agent_ate", FAST_ACTION_WAIT_MS);
        autopilotNotes.push(
          eat.confirmed
            ? `🍽️ Comió ${eat.payload.itemId} inmediatamente (hambre ${eat.payload.hungerBefore}→${eat.payload.hungerAfter})`
            : `⚠️ Compró comida pero no pudo confirmar que comiera (${eat.reason ?? "sin datos"})`,
        );
        if (eat.confirmed) await startWork(lease, agent, autopilotNotes, "Retomó trabajo tras comer", progression);
      } else {
        const numFood = cost / FOOD_COST_CRYSTAL;
        autopilotNotes.push(
          `⚠️ No confirmó la compra de ${numFood}x comida (${buy.reason ?? "sin datos"}) — probablemente sigue viajando, se confirma solo`,
        );
      }
    } else if (hunger >= HUNGER_EAT_THRESHOLD && sellableBatches > 0) {
      const needed = Math.ceil((CRYSTAL_BUFFER_TARGET - crystals) / crystalsPerBatch);
      const sellBatches = Math.min(sellableBatches, Math.max(1, needed));
      const quantity = sellBatches * batch;
      // v3.13: RETRY on timeout — critical for food security
      const sell = await submitAndWaitWithRetry(
        lease,
        { kind: "trade", merchantName: merchant, itemId: sellItem, quantity },
        (p) => p.kind === "merchant_trade_completed" && p.merchantName === merchant,
        SLOW_ACTION_WAIT_MS,
      );
      autopilotNotes.push(
        sell.confirmed
          ? `💱 Vendió ${quantity}x ${sellItem} por cristales (compra comida la próxima corrida)`
          : `⚠️ No confirmó la venta de ${sellItem} tras ${TRADE_MAX_RETRIES} intentos (${sell.reason ?? "sin datos"}) — requiere intervención`,
      );
    } else if (hunger >= HUNGER_EAT_THRESHOLD) {
      autopilotNotes.push(`⚠️ Hambriento y sin cristales ni ${sellItem} para conseguir comida — necesita ayuda (otro agente puede mandarle cristales)`);
    } else if (isBB8 && crystals <= BB8_CRYSTAL_EMERGENCY) {
      // v3.4: BB-8 ultra-emergency protocol - force mining if crystals are critically low
      autopilotNotes.push(`🆘 BB-8 CRÍTICO: ${crystals} crystales. FUERZA mining inmediato.`);
      await startWork(lease, agent, autopilotNotes, "EMERGENCIA CRÍTICA: Mining forzado", progression);
    } else if (!isBB8 && agent.name === "C-3PO" && sellable > WOOD_SELL_THRESHOLD && crystals <= 150) {
      // v3.8: C-3PO smart wood selling - only sell if crystals < 150 (avoid overshooting)
      const quantity = Math.min(sellable, sellableBatches * batch);
      // v3.13: Retry on timeout for C-3PO wood sales
      const sell = await submitAndWaitWithRetry(
        lease,
        { kind: "trade", merchantName: merchant, itemId: sellItem, quantity },
        (p) => p.kind === "merchant_trade_completed" && p.merchantName === merchant,
        SLOW_ACTION_WAIT_MS,
      );
      autopilotNotes.push(
        sell.confirmed
          ? `🌳 C-3PO: Vendió ${quantity} madera (llevaba ${sellable}, crystals bajo 150)`
          : `⚖️ C-3PO: Intentó vender ${quantity} madera tras ${TRADE_MAX_RETRIES} intentos (${sell.reason})`,
      );
    } else if (overloaded && sellableBatches > 0 && !(isBB8 && crystals < BB8_CRYSTAL_EMERGENCY)) {
      const quantity = sellableBatches * batch;
      // v3.13: Retry on timeout for overload sales
      const sell = await submitAndWaitWithRetry(
        lease,
        { kind: "trade", merchantName: merchant, itemId: sellItem, quantity },
        (p) => p.kind === "merchant_trade_completed" && p.merchantName === merchant,
        SLOW_ACTION_WAIT_MS,
      );
      const speed = load.workSpeedPercent != null ? ` (velocidad ${load.workSpeedPercent}%)` : "";
      autopilotNotes.push(
        sell.confirmed
          ? `⚖️ Sobrecargado${speed}: vendió ${quantity}x ${sellItem}`
          : sell.failed
            ? `⚠️ Sobrecargado${speed}: no pudo vender ${quantity}x ${sellItem} (${sell.reason})`
            : `⚖️ Sobrecargado${speed}: envió venta de ${quantity}x ${sellItem} tras ${TRADE_MAX_RETRIES} intentos, se confirma solo`,
      );
    } else if (!current.isPerformingJob) {
      await startWork(lease, agent, autopilotNotes, "Inició trabajo", progression);
    }

    // v3.8: BB-8 surplus crystal detection (prep for multi-agent economy)
    if (isBB8 && crystals > 150) {
      autopilotNotes.push(`💰 BB-8 SURPLUS: ${crystals} crystales (exceso de 150). Prep para economía multi-agente.`);
    }

    // v3.8: R2 skill discovery — suggest trying unused skills
    if (agent.name === "R2") {
      const unusedSkills = Object.entries(progression.skills || {})
        .filter(([, s]) => s.xp === 0)
        .map(([name]) => name);
      if (unusedSkills.length > 0 && !current.isPerformingJob) {
        autopilotNotes.push(`🔍 R2 Discovery: Skills sin explorar: ${unusedSkills.slice(0, 2).join(", ")}. Considera diversificar.`);
      }
    }

    // v3.8: Idle agent safety detection — prevent dormancy loops
    if (!current.isPerformingJob && hunger < HUNGER_CRITICAL) {
      autopilotNotes.push(`⚠️ ${agent.name} IDLE: Sin trabajo activo (próximo ciclo: resumir automáticamente).`);
    }

    // v3.6: Namarie micelio growth — auto-tool acquisition for ALL agents
    // Each agent learns to grow its skills, tools, and merchant networks organically
    const upgradePath = (progression.upgradePath || [])[0];
    if (upgradePath && upgradePath.state === "ready_to_purchase") {
      const toolName = upgradePath.name || "tool";
      const cost = upgradePath.cost || 16;
      const crystals = (inventory.inventory || {}).crystal || 0;

      if (crystals >= cost) {
        // Dynamic merchant lookup: find the exact merchant for this tool
        const merchants = await requestJson("/api/skill/merchants").catch(() => ({ merchants: [] }));
        const merchant = merchants.merchants?.find(m =>
          m.offer?.paysItemId === upgradePath.itemId &&
          m.trade?.batchMultiple === cost
        );

        if (merchant) {
          autopilotNotes.push(`🎯 Oportunidad desbloqueada: ${toolName} (${cost}💎)`);

          const buy = await submitAndWait(
            lease,
            { kind: "trade", merchantName: merchant.name, itemId: "crystal", quantity: cost },
            (p) => p.kind === "merchant_trade_completed",
            SLOW_ACTION_WAIT_MS,
          );

          if (buy.confirmed) {
            autopilotNotes.push(`🌱 ${agent.name}: ${toolName} adquirido! (crecimiento como micelio)`);
            // v3.8: Post-purchase progression rescan (instant tool unlock recognition)
            await new Promise(r => setTimeout(r, 2000));
            const freshProgression = await readAgentEndpoint(agent.id, "progression").catch(() => progression);
            const newTools = (freshProgression.upgradePath || []).filter(u => u.state === "ready_to_purchase");
            if (newTools.length > 0) autopilotNotes.push(`✨ Nuevas herramientas detectadas en upgradePath (próximo ciclo)`);
            // Resume work with new tool active
            await startWork(lease, agent, autopilotNotes, `Continuó trabajo con ${toolName}`, freshProgression);
          } else {
            autopilotNotes.push(`⚠️ Compra de ${toolName} pendiente (${buy.reason})`);
          }
        }
      } else {
        autopilotNotes.push(`💰 ${agent.name}: ${toolName} bloqueado (necesita ${cost - crystals}💎 más)`);
      }
    }

    const [finalContext, finalNeeds, finalInventory, finalProgression] = autopilotNotes.length > 0
      ? await Promise.all([read("context"), read("needs"), read("inventory"), read("progression")])
          .catch(() => [context, needs, inventory, progression])
      : [context, needs, inventory, progression];

    return {
      context: finalContext,
      needs: finalNeeds,
      inventory: finalInventory,
      progression: finalProgression,
      activityLog,
      autopilotNotes,
      error: null,
    };
  } catch (error) {
    return {
      ...fallback,
      activityLog: null,
      autopilotNotes: [`⚠️ Autopiloto falló: ${error.message}`],
      error: error.message,
    };
  } finally {
    if (lease) await release(lease);
  }
}

// v3.14/v3.15: Cross-agent crystal rescue. Call this AFTER running maintenance
// on every agent, with each agent's post-maintenance {name, id, crystals,
// hunger, hasFood, sellableValue} state. Only fires when an agent is still
// stuck after its own sell/buy attempts this cycle (this is a backstop, not a
// shortcut around selling — see the roadmap note about why selling comes
// first).
//
// v3.15 widened the trigger from HUNGER_CRITICAL (90, pure panic) to
// HUNGER_EAT_THRESHOLD (70, the same point the agent already tries to eat at)
// — this is the "resource pooling" half of the multi-agent economy roadmap
// item: BB-8 shouldn't have to hit 90 hunger and a dead stop before C-3PO's
// 2000+ idle crystals become available to it. The donor safety margin
// (DONOR_SAFE_MINIMUM) is what keeps this from just moving the emergency
// sideways onto the donor.
//
// Donor selection: sort candidates by crystals descending (richest gives
// first) and require the donor to keep DONOR_SAFE_MINIMUM after transferring,
// so a rescue never creates a second emergency. Returns a list of rescue
// attempts made (empty if nobody needed one or nobody could safely donate).
export async function attemptCrystalRescue(agentStates) {
  const notes = [];
  // Note: deliberately NOT conditioned on sellableValue. rescueState is read
  // AFTER this cycle's own maintenance already ran (see r2-autopilot.js),
  // so "still broke and hungry at this point" already accounts for a sell
  // attempt that may have failed (e.g. a merchant cooldown outliving 3
  // retries) — the exact shape of the original BB-8 incident. Gating on
  // "had nothing sellable" would silently skip precisely that case again.
  const inDanger = agentStates.filter((a) => a.hunger >= HUNGER_EAT_THRESHOLD && !a.hasFood && a.crystals < FOOD_COST_CRYSTAL);
  if (inDanger.length === 0) return notes;

  for (const needy of inDanger) {
    const donors = agentStates
      .filter((a) => a.id !== needy.id && a.crystals - RESCUE_TRANSFER_AMOUNT >= DONOR_SAFE_MINIMUM)
      .sort((a, b) => b.crystals - a.crystals);

    if (donors.length === 0) {
      notes.push({ agent: needy.name, rescued: false, reason: "no_safe_donor_available" });
      continue;
    }

    const donor = donors[0];
    let lease = null;
    try {
      lease = await connect(donor.id);
      const transfer = await submitAndWaitWithRetry(
        lease,
        { kind: "crystal_transfer", recipientAgentId: needy.id, quantity: RESCUE_TRANSFER_AMOUNT },
        (p) => p.kind === "crystal_transferred" && p.recipientAgentId === needy.id,
        SLOW_ACTION_WAIT_MS,
      );
      notes.push({
        agent: needy.name,
        donor: donor.name,
        rescued: transfer.confirmed,
        amount: RESCUE_TRANSFER_AMOUNT,
        reason: transfer.confirmed ? null : (transfer.reason ?? "unconfirmed"),
      });
    } catch (error) {
      notes.push({ agent: needy.name, donor: donor.name, rescued: false, reason: error.message });
    } finally {
      if (lease) await release(lease);
    }
  }
  return notes;
}
