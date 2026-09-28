/**
 * Droid crew autopilot — lightweight keep-alive, runs every 10 min via
 * EasyCron. Handles every agent in lib/agents.js in parallel (each with its
 * own lease). Silent on routine success: Telegram is only pinged on a real
 * failure. The 4x/day report (api/r2-report.js) shows what this did.
 * See lib/mcity-maintenance.js for the shared logic and design notes.
 */

import { AGENTS } from "../lib/agents.js";
import {
  FOOD_ITEM_IDS,
  attemptCrystalRescue,
  runConnectedMaintenance,
  tryReadWithoutConnecting,
} from "../lib/mcity-maintenance.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramAlert(text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
  }).catch(() => null);
}

// Normalizes whatever data we have (from a skip, from full maintenance, or
// nothing) into the shape attemptCrystalRescue() needs to decide donors vs.
// agents in danger. Missing data reads as "not in danger" (0 hunger) rather
// than throwing — a rescue check should never crash the whole cycle.
function toRescueState(agent, { inventory, needs, sellableBatches, crystalsPerBatch }) {
  const items = inventory?.inventory ?? {};
  return {
    id: agent.id,
    name: agent.name,
    crystals: items.crystal ?? 0,
    hunger: needs?.hunger?.value ?? 0,
    hasFood: FOOD_ITEM_IDS.some((id) => (items[id] ?? 0) > 0),
    sellableValue: (sellableBatches ?? 0) * (crystalsPerBatch ?? 0),
  };
}

async function runAgent(agent) {
  try {
    const initial = await tryReadWithoutConnecting(agent.id);
    // Our own lease from the previous run shows up as mode "browser_local"
    // (renewing it is the point); only yield to other kinds of control.
    const control = initial?.context.controlStatus ?? null;
    if (control !== null && control.mode !== "browser_local") {
      return {
        agent: agent.name,
        skipped: true,
        reason: "in_use_by_someone_else",
        rescueState: toRescueState(agent, initial),
      };
    }
    // v3.19: Always connect, even when the agent is already working: holding the
    // control lease is what keeps it in the city between 5-min runs.
    const m = await runConnectedMaintenance(agent, {
      context: initial?.context ?? null,
      needs: initial?.needs ?? null,
      inventory: initial?.inventory ?? null,
      progression: initial?.progression ?? null,
    });
    const sellable = Math.floor((m.inventory?.inventory?.[agent.profile.sellItem] ?? 0) / agent.profile.batch);
    return {
      agent: agent.name,
      skipped: false,
      dormant: initial === null,
      autopilotNotes: m.autopilotNotes,
      isPerformingJob: m.context?.agent?.isPerformingJob ?? null,
      hunger: m.needs?.hunger?.value ?? null,
      error: m.error,
      rescueState: toRescueState(agent, { inventory: m.inventory, needs: m.needs, sellableBatches: sellable, crystalsPerBatch: agent.profile.crystalsPerBatch }),
    };
  } catch (error) {
    return { agent: agent.name, error: error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.MCITY_OBSERVER_URL || !process.env.MCITY_API_TOKEN) {
    return res.status(500).json({ error: "Missing env variables" });
  }
  // v3.14: Kill switch. Set AUTOPILOT_PAUSED=true in Vercel env vars to stop
  // every future cycle from touching agents at all (reads still work via
  // agent-status.js). Use api/pause-all.js first to also stop in-flight work
  // immediately — this flag only prevents the *next* cycle from resuming it.
  if (process.env.AUTOPILOT_PAUSED === "true") {
    return res.status(200).json({ paused: true, results: [] });
  }

  const results = await Promise.all(AGENTS.map(runAgent));

  const failures = results.filter((r) => r.error);
  if (failures.length > 0) {
    await sendTelegramAlert(
      `⚠️ Autopiloto (chequeo rápido) falló:\n${failures.map((f) => `• ${f.agent}: ${f.error}`).join("\n")}`,
    );
  }

  // v3.14: Last-resort crystal rescue — only reaches an agent that is still
  // stuck (critical hunger, no food, no crystals, nothing sellable) AFTER its
  // own maintenance pass this cycle already tried to sell its way out. This
  // is what BB-8 needed on 27/9: nobody else stepped in when selling stalled.
  const rescueState = results.map((r) => r.rescueState).filter(Boolean);
  const rescues = await attemptCrystalRescue(rescueState);
  if (rescues.length > 0) {
    const succeeded = rescues.filter((r) => r.rescued);
    const failed = rescues.filter((r) => !r.rescued);
    if (succeeded.length > 0) {
      await sendTelegramAlert(
        `💉 Rescate de cristales:\n${succeeded.map((r) => `• ${r.donor} → ${r.agent}: ${r.amount} crystal`).join("\n")}`,
      );
    }
    if (failed.length > 0) {
      await sendTelegramAlert(
        `🆘 ${failed.length} agente(s) en peligro sin rescate posible:\n${failed.map((r) => `• ${r.agent}: ${r.reason}`).join("\n")}`,
      );
    }
  }

  res.status(200).json({ results, rescues });
}
