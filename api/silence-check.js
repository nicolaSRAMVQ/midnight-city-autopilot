/**
 * v3.16: Silence detector + snapshot + self-contained log writer.
 *
 * v3.14/v3.15 relied on a GitHub Actions job to curl this endpoint AND git-
 * commit the result. Turns out GitHub's `schedule` trigger is best-effort
 * with no SLA — measuring this repo's own workflow runs showed a 142min
 * average gap (up to 349min) against a 5-10min configured interval. Cron
 * frequency that high gets silently dropped under GitHub's platform-wide
 * contention. So GitHub Actions is now just a redundant backup pinger (see
 * cron.yml); the real trigger is Supabase pg_cron (project "Suteki | Recetario") hitting
 * this endpoint directly, and THIS endpoint writes its own log line via the
 * GitHub Contents API instead of depending on a workflow to do it — one less
 * thing that can silently stop working.
 *
 * How it decides "quiet too long": reads the most recent line already
 * committed to logs/YYYY-MM-DD.jsonl (today, falling back to yesterday) from
 * the public repo via raw.githubusercontent, and compares its timestamp to
 * now. This is what would have caught the 25-27/9 cron outage — 48h with
 * zero log lines — instead of a human noticing days later.
 *
 * No dedupe/backoff on the alert itself: if the silence persists, this fires
 * again every time an external trigger calls it. That's a feature, not a
 * bug — an unresolved outage should keep nagging, not go silent after one
 * Telegram message.
 */

import { AGENTS } from "../lib/agents.js";
import { tryReadWithoutConnecting } from "../lib/mcity-maintenance.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "nicolaSRAMVQ";
const REPO_NAME = "midnight-city-autopilot";
const REPO_BRANCH = "main";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/logs`;
const SILENCE_THRESHOLD_MS = 25 * 60 * 1000; // 25 min: survives one delayed/missed 10-min cycle

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

// v3.16: Appends one JSONL line to logs/YYYY-MM-DD.jsonl via the GitHub
// Contents API (read current sha+content, append, PUT). No retry on a 409
// (sha conflict from a near-simultaneous write, e.g. the GitHub Actions
// backup pinger landing at the same moment) — losing one log line to a race
// isn't worth the complexity; the next call a few minutes later covers it.
async function appendLogLine(dateStr, lineObj) {
  if (!GITHUB_TOKEN) return { written: false, reason: "no_github_token" };
  const path = `logs/${dateStr}.jsonl`;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  let existingContent = "";
  let sha;
  try {
    const getRes = await fetch(`${apiUrl}?ref=${REPO_BRANCH}`, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      existingContent = Buffer.from(data.content, "base64").toString("utf-8");
    } else if (getRes.status !== 404) {
      return { written: false, reason: `github_read_${getRes.status}` };
    }
  } catch (err) {
    return { written: false, reason: `github_read_error: ${err.message}` };
  }

  const newContent = existingContent + JSON.stringify(lineObj) + "\n";
  try {
    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `log: ${lineObj.timestamp}`,
        content: Buffer.from(newContent, "utf-8").toString("base64"),
        branch: REPO_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!putRes.ok) {
      const errText = await putRes.text();
      return { written: false, reason: `github_write_${putRes.status}: ${errText.slice(0, 150)}` };
    }
    return { written: true };
  } catch (err) {
    return { written: false, reason: `github_write_error: ${err.message}` };
  }
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

  const line = {
    timestamp: new Date().toISOString(),
    silence: { lastTimestamp: lastTimestamp ? new Date(lastTimestamp).toISOString() : null, silentForMinutes: silentForMs ? Math.round(silentForMs / 60000) : null, alerted: isSilent },
    agents,
  };
  const writeResult = await appendLogLine(isoDateOffset(0), line);

  res.status(200).json({
    ...line,
    logWrite: writeResult,
  });
}
