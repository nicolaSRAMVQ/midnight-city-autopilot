/**
 * Silence detector + snapshot. Supabase pg_cron calls this every 10 min; its
 * JSON response is archived in midnight.log by the midnight-archive-5min job,
 * so this endpoint no longer writes anything itself. (Until 3/10 it committed a
 * log line to main via the GitHub API; each commit triggered Vercel deploys in
 * two projects and burned the 100-deploys/day free quota.)
 *
 * "Quiet too long" = no successful autopilot run in midnight.log for 25 min.
 * The alert repeats on every call while the silence lasts, on purpose.
 */

import { AGENTS } from "../lib/agents.js";
import { tryReadWithoutConnecting } from "../lib/mcity-maintenance.js";
import { rpc } from "../lib/supabase.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SILENCE_THRESHOLD_MS = 25 * 60 * 1000;

async function sendTelegramAlert(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
  }).catch(() => null);
}

async function fetchLastAutopilotOk() {
  const ts = await rpc("midnight_last_autopilot_ok").catch(() => null);
  return ts ? Date.parse(ts) : null;
}

const SKILL_BY_PROFESSION = { hacker: "hacking", miner: "mining", lumberjack: "woodcutting" };

async function snapshot(agent) {
  const data = await tryReadWithoutConnecting(agent.id);
  if (data === null) return { agent: agent.name, dormant: true };
  const items = data.inventory?.inventory ?? {};
  const skillId = SKILL_BY_PROFESSION[agent.profession];
  return {
    agent: agent.name,
    dormant: false,
    isPerformingJob: data.context?.agent?.isPerformingJob ?? null,
    hunger: data.needs?.hunger?.value ?? null,
    crystal: items.crystal ?? 0,
    xp: skillId ? (data.progression?.skills?.[skillId]?.xp ?? null) : null,
    xpSecondary: Object.entries(data.progression?.skills ?? {}).filter(([name]) => name !== skillId).reduce((sum, [, sk]) => sum + (sk.xp ?? 0), 0),
  };
}

export default async function handler(req, res) {
  if (!process.env.MCITY_OBSERVER_URL || !process.env.MCITY_API_TOKEN) {
    return res.status(500).json({ error: "Missing env variables" });
  }

  const now = Date.now();
  const lastTimestamp = await fetchLastAutopilotOk();
  const silentForMs = lastTimestamp ? now - lastTimestamp : null;
  const isSilent = silentForMs !== null && silentForMs > SILENCE_THRESHOLD_MS;

  if (isSilent) {
    const minutes = Math.round(silentForMs / 60000);
    await sendTelegramAlert(
      `🔇 <b>Silencio detectado</b>: sin corrida exitosa del autopilot hace ${minutes} min (umbral: ${SILENCE_THRESHOLD_MS / 60000} min).\n` +
        `Revisar: pg_cron en Supabase, Vercel (¿responde /api/r2-autopilot?), API del juego, AUTOPILOT_PAUSED.`,
    );
  }

  const agents = await Promise.all(AGENTS.map(snapshot));

  const line = {
    timestamp: new Date().toISOString(),
    silence: { lastTimestamp: lastTimestamp ? new Date(lastTimestamp).toISOString() : null, silentForMinutes: silentForMs ? Math.round(silentForMs / 60000) : null, alerted: isSilent },
    agents,
  };
  res.status(200).json({
    ...line,
  });
}
