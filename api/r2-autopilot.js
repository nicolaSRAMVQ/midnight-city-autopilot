/**
 * Droid crew autopilot — lightweight keep-alive, runs every 10 min via
 * EasyCron. Handles every agent in lib/agents.js in parallel (each with its
 * own lease). Silent on routine success: Telegram is only pinged on a real
 * failure. The 4x/day report (api/r2-report.js) shows what this did.
 * See lib/mcity-maintenance.js for the shared logic and design notes.
 */

import { AGENTS } from "../lib/agents.js";
import { HUNGER_EAT_THRESHOLD, runConnectedMaintenance, tryReadWithoutConnecting } from "../lib/mcity-maintenance.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramAlert(text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
  }).catch(() => null);
}

async function runAgent(agent) {
  try {
    const initial = await tryReadWithoutConnecting(agent.id);
    if (initial !== null && initial.context.controlStatus !== null) {
      return { agent: agent.name, skipped: true, reason: "in_use_by_someone_else" };
    }
    // Runs every 10 min, so don't even connect when there is nothing to do:
    // already working and not hungry enough to need feeding.
    const load = initial?.inventory?.load ?? {};
    const overloaded = (load.excessWeight ?? 0) > 0 || (load.state && load.state !== "normal");
    if (
      initial !== null &&
      initial.context.agent.isPerformingJob &&
      (initial.needs.hunger?.value ?? 0) < HUNGER_EAT_THRESHOLD &&
      !overloaded
    ) {
      return { agent: agent.name, skipped: true, reason: "already_working" };
    }
    const m = await runConnectedMaintenance(agent, {
      context: initial?.context ?? null,
      needs: initial?.needs ?? null,
      inventory: initial?.inventory ?? null,
      progression: initial?.progression ?? null,
    });
    return {
      agent: agent.name,
      skipped: false,
      dormant: initial === null,
      autopilotNotes: m.autopilotNotes,
      isPerformingJob: m.context?.agent?.isPerformingJob ?? null,
      hunger: m.needs?.hunger?.value ?? null,
      error: m.error,
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

  const results = await Promise.all(AGENTS.map(runAgent));

  const failures = results.filter((r) => r.error);
  if (failures.length > 0) {
    await sendTelegramAlert(
      `⚠️ Autopiloto (chequeo rápido) falló:\n${failures.map((f) => `• ${f.agent}: ${f.error}`).join("\n")}`,
    );
  }

  res.status(200).json({ results });
}
