/**
 * v3.14: Silence detector + snapshot, in one call so the GitHub Actions log
 * job (.github/workflows/cron.yml, "log") only needs one curl.
 *
 * Why this lives in Vercel instead of the workflow: Telegram secrets are
 * already configured here, and duplicating them into GitHub Actions secrets
 * is one more place credentials can leak or drift out of sync. The workflow
 * only needs git push access (which it already has via the default
 * GITHUB_TOKEN) to persist the log line this endpoint returns.
 *
 * How it decides "quiet too long": reads the most recent line already
 * committed to logs/YYYY-MM-DD.jsonl (today, falling back to yesterday) from
 * the public repo via raw.githubusercontent, and compares its timestamp to
 * now. This is what would have caught the 25-27/9 cron outage — 48h with
 * zero log lines — instead of a human noticing days later.
 *
 * No dedupe/backoff on the alert itself: if the silence persists, this fires
 * again every time the log job runs (every 30 min by default). That's a
 * feature, not a bug — an unresolved outage should keep nagging, not go
 * silent after one Telegram message.
 */

import { AGENTS } from "../lib/agents.js";
import { tryReadWithoutConnecting } from "../lib/mcity-maintenance.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const RAW_BASE = "https://raw.githubusercontent.com/nicolaSRAMVQ/midnight-city-autopilot/main/logs";
const SILENCE_THRESHOLD_MS = 40 * 60 * 1000; // 40 min: survives one missed 30-min cycle

async function sendTelegramAlert(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
  }).catch(() => null);
}

function isoDateOffset(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function fetchLastLoggedTimestamp() {
  for (const daysAgo of [0, 1]) {
    const url = `${RAW_BASE}/${isoDateOffset(daysAgo)}.jsonl?cachebust=${Date.now()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const lines = text.trim().split("\n").filter(Boolean);
      if (lines.length === 0) continue;
      const last = JSON.parse(lines[lines.length - 1]);
      if (last.timestamp) return new Date(last.timestamp).getTime();
    } catch {
      continue;
    }
  }
  return null; // no log found at all — first run ever, or logs/ not created yet
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
  };
}

export default async function handler(req, res) {
  if (!process.env.MCITY_OBSERVER_URL || !process.env.MCITY_API_TOKEN) {
    return res.status(500).json({ error: "Missing env variables" });
  }

  const now = Date.now();
  const lastTimestamp = await fetchLastLoggedTimestamp();
  const silentForMs = lastTimestamp ? now - lastTimestamp : null;
  const isSilent = silentForMs !== null && silentForMs > SILENCE_THRESHOLD_MS;

  if (isSilent) {
    const minutes = Math.round(silentForMs / 60000);
    await sendTelegramAlert(
      `🔇 <b>Silencio detectado</b>: sin log nuevo hace ${minutes} min (umbral: ${SILENCE_THRESHOLD_MS / 60000} min).\n` +
        `Revisar: GitHub Actions (¿cron corriendo?), Vercel (¿endpoints respondiendo?), AUTOPILOT_PAUSED (¿quedó en true?).`,
    );
  }

  const agents = await Promise.all(AGENTS.map(snapshot));

  res.status(200).json({
    timestamp: new Date().toISOString(),
    silence: { lastTimestamp: lastTimestamp ? new Date(lastTimestamp).toISOString() : null, silentForMinutes: silentForMs ? Math.round(silentForMs / 60000) : null, alerted: isSilent },
    agents,
  });
}
