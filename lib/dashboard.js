// Shared data for the web dashboard (/tablero) and the Telegram buttons (v3.31):
// live state per droid, its leaderboard spot with neighbours, and daily history.
import { AGENTS } from "./agents.js";
import { readAgentEndpoint } from "./mcity-maintenance.js";
import { rpc } from "./supabase.js";

export const DASHBOARD_URL = "https://r2-telegram-reporter.vercel.app/tablero/";

const observerBase = () => (process.env.MCITY_OBSERVER_URL || "https://midnight.city/observer").replace(/\/$/, "");

const pickRow = (e) => (e ? { rank: e.rank ?? null, name: e.name ?? e.agentName ?? e.displayName ?? null, xp: e.value ?? e.totalXp ?? e.xp ?? e.score ?? null } : null);

// The observer stopped returning { entry, previous, next }. The public board is
// a paginated list sorted by score. One page cache per invocation: three droids
// ask at once and the same offsets should not be fetched twice.
const boardCache = new Map();

async function boardJson(url) {
  const hit = boardCache.get(url);
  if (hit && Date.now() - hit.at < 20_000) return hit.promise;
  const promise = (async () => {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return r.json();
  })().catch(() => null);
  boardCache.set(url, { at: Date.now(), promise });
  return promise;
}

function legacyBoard(j) {
  if (!j || !Object.hasOwn(j, "entry")) return null;
  const raw = j.entry ?? {};
  const previous = raw.previous ?? j.previous ?? null;
  const next = raw.next ?? j.next ?? null;
  return {
    ...pickRow(raw),
    ahead: pickRow(Array.isArray(previous) ? previous.at(-1) : previous),
    behind: pickRow(Array.isArray(next) ? next[0] : next),
    total: j.total ?? null,
  };
}

function targetScore(agent, board) {
  const skills = agent?.skills ?? {};
  if (board === "experience") return Object.values(skills).reduce((sum, sk) => sum + (sk?.xp ?? 0), 0);
  return skills[board]?.xp ?? null;
}

async function rowAt(base, board, offset) {
  const j = await boardJson(`${base}/api/leaderboards/${encodeURIComponent(board)}?offset=${offset}&limit=1`);
  return j?.rows?.[0] ?? null;
}

async function windowAround(base, board, rank, span) {
  const start = Math.max(0, rank - span - 1);
  const j = await boardJson(`${base}/api/leaderboards/${encodeURIComponent(board)}?offset=${start}&limit=${span * 2 + 1}`);
  return j?.rows ?? [];
}

// Global experience rank, plus the agent just above and just below.
// `board` defaults to the city-wide experience list (the global position).
export async function fetchBoard(agentId, board = "experience") {
  try {
    const base = observerBase();
    const listed = await boardJson(`${base}/api/leaderboards?board=${encodeURIComponent(board)}&agentId=${encodeURIComponent(agentId)}`);
    const legacy = legacyBoard(listed);
    if (legacy?.rank != null || listed?.status === "unranked") return legacy;

    const agent = await boardJson(`${base}/api/agents/${encodeURIComponent(agentId)}`);
    if (!agent?.skills) return null;
    const target = targetScore(agent, board);
    const head = await boardJson(`${base}/api/leaderboards/${encodeURIComponent(board)}?limit=1`);
    const total = head?.total ?? 0;
    if (target == null || !total) return null;

    let lo = 0;
    let hi = total - 1;
    let probe = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const row = await rowAt(base, board, mid);
      if (!row) break;
      probe = row;
      if (row.agentId === agentId || row.value === target) break;
      if (row.value > target) lo = mid + 1;
      else hi = mid - 1;
    }
    if (!probe?.rank) return null;

    let rows = await windowAround(base, board, probe.rank, 25);
    if (!rows.some((row) => row.agentId === agentId)) rows = await windowAround(base, board, probe.rank, 80);
    const i = rows.findIndex((row) => row.agentId === agentId);
    if (i < 0) return null;
    return { ...pickRow(rows[i]), ahead: pickRow(rows[i - 1]), behind: pickRow(rows[i + 1]), total };
  } catch {
    return null;
  }
}

export async function getAgentStatus(agent) {
  try {
    const [context, progression, inventory, needs] = await Promise.all([
      readAgentEndpoint(agent.id, "context"),
      readAgentEndpoint(agent.id, "progression"),
      readAgentEndpoint(agent.id, "inventory"),
      readAgentEndpoint(agent.id, "needs"),
    ]);

    const current = context.agent || {};
    const items = inventory.inventory || {};
    const load = inventory.load || {};
    const hunger = needs.hunger?.value ?? 0;

    const skills = Object.entries(progression.skills || {})
      .sort((a, b) => b[1].xp - a[1].xp)
      .slice(0, 1);

    // v3.3: Level comes from the primary skill, not context.agent.level (which is always null)
    const primarySkill = skills[0];
    const skillLevel = primarySkill ? primarySkill[1].level : 0;
    const skillXp = primarySkill ? primarySkill[1].xp : 0;
    const xpPercent = primarySkill ? Math.round((primarySkill[1].xp / primarySkill[1].nextLevelXp) * 100) : 0;

    return {
      name: agent.name,
      profession: agent.profession,
      level: skillLevel,
      xp: skillXp,
      nextLevelXp: primarySkill ? primarySkill[1].nextLevelXp ?? null : null,
      xpPercent: xpPercent,
      hunger: Math.max(0, Math.min(100, hunger)),
      crystals: items.crystal || 0,
      working: current.isPerformingJob || false,
      speed: load.workSpeedPercent ?? 100,
      location: context.currentSpace?.name || "?",
      skill: skills[0] ? `${skills[0][0]} L${skills[0][1].level}` : "?",
    };
  } catch (error) {
    return {
      name: agent.name,
      profession: agent.profession,
      error: error.message,
    };
  }
}

// Total agents in the city: the base the leaderboard rank is measured against.
export async function fetchAgentCount() {
  try {
    const j = await boardJson(`${observerBase()}/api/leaderboards`);
    if (typeof j?.population === "number") return j.population;
    return null;
  } catch {
    return null;
  }
}

export async function getDashboardData(days = 30) {
  const [history, live, boards, totalAgents] = await Promise.all([
    rpc("midnight_dashboard", { p_days: days }).catch((e) => ({ error: e.message })),
    Promise.all(AGENTS.map(getAgentStatus)),
    Promise.all(AGENTS.map((a) => fetchBoard(a.id))),
    fetchAgentCount(),
  ]);
  return { timestamp: new Date().toISOString(), totalAgents, history, live: live.map((a, i) => ({ ...a, board: boards[i] })) };
}
