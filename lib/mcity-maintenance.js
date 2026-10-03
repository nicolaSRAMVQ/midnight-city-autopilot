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

import { AGENTS } from "./agents.js";
import { chooseTraining, getTrainingRows, startTraining } from "./training.js";

const OBSERVER_URL = process.env.MCITY_OBSERVER_URL;
const API_TOKEN = process.env.MCITY_API_TOKEN;

// v3.8: Optimized autonomy thresholds (sep 25)
export const HUNGER_WORK_THRESHOLD = 60;     // Normal work range
export const HUNGER_EAT_THRESHOLD = 70;      // v3.8: Lowered from 80 → gradual eating, less panic
export const HUNGER_CRITICAL = 90;           // If hits this, absolute priority to eat
const FAST_ACTION_WAIT_MS = 8_000; // local actions: eat, stop_job
const SLOW_ACTION_WAIT_MS = 8_000; // v3.8: Reduced from 12s → faster cycles (no cross-district delay)
const FALLBACK_ACTION_WAIT_MS = 4_000; // v3.17: Faster timeout for fallback location attempts
const ACTION_POLL_MS = 1_000;
export const FOOD_ITEM_IDS = ["matcha_smoothie", "fish", "meat", "to_go_food"];

// v3.18: Loops livianos. Tools work just by being carried (the game refuses
// `equip` for them) and only once the skill reaches the tool's requiredLevel.
export const PROFESSION_SKILL = { hacker: "hacking", miner: "mining", lumberjack: "woodcutting" };
const FOOD_RESERVE_MIN = 2;
const FOOD_RESERVE_TARGET = 6;
// Below this many sellable units a merchant trip costs more work time than the
// weight it removes (R2 stays overloaded by unsellable packets regardless).
const MIN_SELL_QUANTITY = 20;

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

// Best price/hunger ratio: ~20 crystal -> 1 smoothie (~20 hunger in practice).
const FOOD_MERCHANT = "Central Smoothies Matcha Outlet";
export const FOOD_COST_CRYSTAL = 20; // fallback only; the live price is read from /api/skill/merchants

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

let gameContentPromise = null;
export function fetchGameContent() {
  gameContentPromise ??= requestJson("/api/stats")
    .then((stats) => requestJson(`/api/static-world/${encodeURIComponent(stats.staticVersion)}`))
    .then((world) => world.staticWorld.gameContent)
    .catch((error) => {
      gameContentPromise = null;
      throw error;
    });
  return gameContentPromise;
}

// Returns the merchant-sold tool worth buying for this agent, or null when it
// already carries one at least as good. Tools also wear out, so a broken tool
// simply shows up here again as missing.
function toolToBuy(gameContent, merchants, profession, skills, items) {
  const skill = PROFESSION_SKILL[profession];
  const level = skills?.[skill]?.level ?? 1;
  const usable = (gameContent?.items ?? []).filter((i) => i.tool?.skill === skill && i.tool.requiredLevel <= level);
  const bestCarried = Math.max(-1, ...usable.filter((i) => (items[i.id] ?? 0) > 0).map((i) => i.tool.requiredLevel));
  const candidates = usable
    .filter((i) => i.tool.requiredLevel > bestCarried)
    .map((i) => ({ itemId: i.id, requiredLevel: i.tool.requiredLevel, merchant: merchants.find((m) => m.offer?.paysItemId === i.id) }))
    .filter((t) => t.merchant);
  return candidates.sort((a, b) => b.requiredLevel - a.requiredLevel)[0] ?? null;
}

export async function fetchMerchants() {
  const response = await requestJson("/api/skill/merchants").catch(() => ({ merchants: [] }));
  return response.merchants ?? [];
}

// The listed batchMultiple can lag behind what the trade enforces (smoothies
// listed at 20 were rejected with "must be a multiple of 21", then 23), so on
// that rejection retry once with the multiple the server asked for.
// `quantityFor(multiple)` returns how much to trade for a given multiple.
async function tradeAdaptive(lease, merchantName, itemId, multiple, quantityFor) {
  let result = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const quantity = quantityFor(multiple);
    if (quantity <= 0) return { confirmed: false, failed: true, reason: `no alcanza para un lote de ${multiple}`, quantity: 0 };
    result = await submitAndWait(
      lease,
      { kind: "trade", merchantName, itemId, quantity },
      (p) => p.kind === "merchant_trade_completed" && p.merchantName === merchantName,
      SLOW_ACTION_WAIT_MS,
    );
    result = { ...result, quantity };
    const asked = result.failed ? /multiple of (\d+)/i.exec(result.reason ?? "") : null;
    if (!asked || Number(asked[1]) === multiple) return result;
    multiple = Number(asked[1]);
  }
  return result;
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

// Prefer a source whose output a merchant buys for crystals, so waiting out a
// full worksite doesn't fill the bag with unsellable salvage. A crewmate's
// worksite is only shared when it has plenty of nodes (trees yes, the terminal no).
const CREW_PRIMARY_SOURCES = new Set(AGENTS.map((a) => a.profile.primarySourceId));
const SHAREABLE_NODES = 5;
async function pickFallbackSource(agent, progression) {
  const open = (progression.capabilities?.sources ?? []).filter((s) => {
    const nodes = s.availableNodeIds?.length ?? 0;
    if (s.sourceId === agent.profile.primarySourceId || s.failureReason !== null || nodes === 0) return false;
    return !CREW_PRIMARY_SOURCES.has(s.sourceId) || nodes >= SHAREABLE_NODES;
  });
  const [gameContent, merchants] = await Promise.all([fetchGameContent().catch(() => null), fetchMerchants()]);
  const sellable = new Set(merchants.filter((m) => m.offer?.paysItemId === "crystal").map((m) => m.offer.acceptsItemId));
  const sellsForCrystals = (s) =>
    (gameContent?.sources?.find((d) => d.id === s.sourceId)?.outputs ?? []).some((o) => sellable.has(o.itemId));
  return open.find(sellsForCrystals) ?? open[0] ?? null;
}

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
    // Worksite full: train a secondary skill until it levels up (api/training-worker.js
    // chains the pulls); the single fallback gather below is only the backup.
    const [gameContent, merchants] = await Promise.all([fetchGameContent().catch(() => null), fetchMerchants()]);
    const choice = chooseTraining(agent, progression, gameContent, merchants);
    if (choice) {
      try {
        await startTraining(agent, choice, "puesto lleno");
        await submitAndWait(lease, { kind: "gather", sourceId: choice.sourceId }, (p) => p.kind === "resource_gathered", FALLBACK_ACTION_WAIT_MS);
        autopilotNotes.push(`🎓 ${agent.profile.workLabel} sin lugar — entrena ${choice.skill} L${choice.startLevel} → L${choice.targetLevel} en ${choice.sourceId}`);
        return;
      } catch (error) {
        autopilotNotes.push(`⚠️ No pudo iniciar entrenamiento: ${error.message.slice(0, 80)}`);
      }
    }
    const altSource = await pickFallbackSource(agent, progression);
    if (altSource) {
      const gather = await submitAndWait(
        lease,
        { kind: "gather", sourceId: altSource.sourceId },
        (p) => p.kind === "resource_gathered",
        FALLBACK_ACTION_WAIT_MS,
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
    const training = await getTrainingRows()
      .then((rows) => rows.find((r) => r.agent_id === agent.id && r.active) ?? null)
      .catch(() => null);

    const events = await fetchRecentEvents(agent.id);
    const activityLog = events
      .filter((e) => e.payload?.agentId === agent.id && NOTABLE_EVENT_KINDS.has(e.payload.kind))
      .map(summarizeEvent)
      .filter(Boolean)
      .slice(-5)
      .reverse();

    const items = inventory.inventory || {};
    const hunger = needs.hunger?.value ?? 0;
    const crystals = items.crystal ?? 0;
    const load = inventory.load || {};
    const overloaded = (load.workSpeedPercent ?? 100) < 100 || (load.excessWeight ?? 0) > 0;
    const foodCount = FOOD_ITEM_IDS.reduce((sum, id) => sum + (items[id] ?? 0), 0);

    const merchants = await fetchMerchants();
    const foodPrice = merchants.find((m) => m.name === FOOD_MERCHANT)?.trade?.batchMultiple ?? FOOD_COST_CRYSTAL;
    // Sell the biggest pile of anything a merchant buys for crystals, not only the
    // profession product (BB-8 cuts logs while the mine is full).
    const saleTarget = merchants
      .filter((m) => m.offer?.paysItemId === "crystal" && (items[m.offer.acceptsItemId] ?? 0) > 0)
      .map((m) => ({ merchant: m.name, itemId: m.offer.acceptsItemId, multiple: m.trade?.batchMultiple ?? 1 }))
      .map((o) => ({ ...o, quantity: Math.floor(items[o.itemId] / o.multiple) * o.multiple }))
      .filter((o) => o.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)[0] ?? null;
    const sellItem = saleTarget?.itemId ?? agent.profile.sellItem;
    const saleQuantity = saleTarget?.quantity ?? 0;
    const gameContent = await fetchGameContent().catch(() => null);
    const tool = toolToBuy(gameContent, merchants, agent.profession, progression.skills, items);
    const toolId = tool?.itemId;
    const toolMerchant = tool?.merchant ?? null;
    const toolPrice = toolMerchant?.trade?.batchMultiple ?? Infinity;

    const buyFood = () => {
      const units = FOOD_RESERVE_TARGET - foodCount;
      return tradeAdaptive(lease, FOOD_MERCHANT, "crystal", foodPrice, (price) => Math.min(units, Math.floor(crystals / price)) * price);
    };
    const sell = () =>
      tradeAdaptive(lease, saleTarget.merchant, saleTarget.itemId, saleTarget.multiple, (multiple) => Math.floor(items[saleTarget.itemId] / multiple) * multiple);
    const eat = () => submitAndWait(lease, { kind: "eat" }, (p) => p.kind === "agent_ate");
    let working = current.isPerformingJob;

    // A trade or trip still underway would be cancelled by any new action.
    if (/trade|travel/.test(current.activeAction?.kind ?? "")) {
      autopilotNotes.push(`🚶 ${agent.name} está en viaje (${current.activeAction.kind}) — no lo interrumpo`);
    } else {
      // 1. Hunger: eating is local and instant, so it never costs the cycle's slow action.
      if (hunger >= HUNGER_EAT_THRESHOLD && foodCount > 0) {
        let ate = await eat();
        if (!ate.confirmed && working) {
          await submitAndWait(lease, { kind: "stop_job" }, (p) => p.kind === "activity_completed" && p.activity === "stop_job");
          working = false;
          ate = await eat();
        }
        autopilotNotes.push(
          ate.confirmed
            ? `🍽️ Comió ${ate.payload.itemId} (hambre ${ate.payload.hungerBefore}→${ate.payload.hungerAfter})`
            : `⚠️ No pudo comer (${ate.reason ?? "sin datos"})`,
        );
      }

      // 2. At most one merchant trip per cycle, in priority order.
      let trade = null;
      let tradeLabel = "";
      let travelling = false;
      if (hunger >= HUNGER_EAT_THRESHOLD && foodCount === 0) {
        if (crystals >= foodPrice) {
          tradeLabel = "comida (tenía hambre y nada para comer)";
          trade = await buyFood();
        } else if (saleQuantity > 0) {
          tradeLabel = `${sellItem} para poder comprar comida`;
          trade = await sell();
        } else {
          autopilotNotes.push(`🆘 Hambre ${hunger}, sin comida, sin cristales ni ${sellItem} — espera rescate de otro agente`);
        }
      } else if (overloaded && saleQuantity >= MIN_SELL_QUANTITY) {
        tradeLabel = `${sellItem} por sobrecarga (velocidad ${load.workSpeedPercent ?? "?"}%)`;
        trade = await sell();
      } else if (agent.profile.sellAtQuantity && saleQuantity >= agent.profile.sellAtQuantity) {
        tradeLabel = `${sellItem} por liquidez (juntó ${saleQuantity})`;
        trade = await sell();
      } else if (foodCount < FOOD_RESERVE_MIN && crystals >= foodPrice) {
        tradeLabel = `reserva de comida (tenía ${foodCount})`;
        trade = await buyFood();
      } else if (toolMerchant && crystals >= toolPrice + foodPrice * FOOD_RESERVE_TARGET) {
        tradeLabel = `herramienta ${toolId}`;
        const district = toolMerchant.position?.spaceId;
        if (district && current.position?.spaceId !== district) {
          // A trade routed from a far district gets abandoned mid-way (C-3PO
          // forest→volcano, 3/10): stop the work loop, travel there, buy on arrival.
          if (working) await submitAndWait(lease, { kind: "stop_job" }, (p) => p.kind === "activity_completed");
          working = false;
          const go = await submitAndWait(
            lease,
            { kind: "travel_to_district", districtId: district },
            (p) => p.kind === "agent_transferred" && p.to?.spaceId === district,
            SLOW_ACTION_WAIT_MS,
          );
          if (go.confirmed) {
            trade = await tradeAdaptive(lease, toolMerchant.name, "crystal", toolPrice, (price) => price);
          } else if (go.failed) {
            autopilotNotes.push(`⚠️ No pudo viajar a ${district} por ${toolId}: ${go.reason}`);
          } else {
            travelling = true;
            autopilotNotes.push(`🧭 Viaja a ${district} para comprar ${toolId}; compra al llegar`);
          }
        } else {
          trade = await tradeAdaptive(lease, toolMerchant.name, "crystal", toolPrice, (price) => price);
        }
      }

      if (trade) {
        if (trade.confirmed) {
          const p = trade.payload;
          autopilotNotes.push(`💱 ${tradeLabel}: entregó ${p.soldQuantity} ${p.soldItemId}, recibió ${p.receivedQuantity} ${p.receivedItemId}`);
          if (hunger >= HUNGER_EAT_THRESHOLD && p.receivedItemId && FOOD_ITEM_IDS.includes(p.receivedItemId)) {
            const ate = await eat();
            if (ate.confirmed) autopilotNotes.push(`🍽️ Comió (hambre ${ate.payload.hungerBefore}→${ate.payload.hungerAfter})`);
          }
        } else if (trade.failed) {
          autopilotNotes.push(`⚠️ Falló ${tradeLabel}: ${trade.reason}`);
        } else {
          // Not confirmed within the wait: it is still walking there. Resuming work now would cancel it.
          autopilotNotes.push(`🚶 ${tradeLabel}: en camino (${trade.quantity}), se confirma el próximo ciclo`);
        }
      }

      // 3. Always end the cycle working, unless a trade or trip is still in flight.
      const tradeInFlight = trade && !trade.confirmed && !trade.failed;
      if (training) {
        autopilotNotes.push(`🎓 Entrenando ${training.skill} hasta L${training.target_level} (lo maneja el worker)`);
      } else if (!tradeInFlight && !travelling && (trade || !working)) {
        await startWork(lease, agent, autopilotNotes, trade ? "Retomó el trabajo" : "Inició trabajo", progression);
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
  }
  // v3.19: No release. A released agent drops out of the city within minutes;
  // the lease (5 min TTL) is instead renewed by the next 5-min cron run.
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
