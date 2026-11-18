// Shared data for the web dashboard (/tablero) and the Telegram buttons (v3.31+):
// live state per droid, its leaderboard spot with neighbours, full 19-skill sheet, and all-time history.
import { AGENTS } from "./agents.js";
import { ARCHIVED_DAYS, ARCHIVED_RANKS } from "./history-archive.js";
import { fetchGameContent, readAgentEndpoint } from "./mcity-maintenance.js";
import { rpc } from "./supabase.js";
import { getTrainingRows } from "./training.js";

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

export async function getAgentStatus(agent, gc = null, trainingRow = null) {
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
    const cap = progression.capabilities || {};
    const thresholds = gc?.xpThresholds || [];
    const itemById = Object.fromEntries((gc?.items || []).map((i) => [i.id, i]));

    const rawSkills = progression.skills || {};
    const sortedSkills = Object.entries(rawSkills).sort((a, b) => b[1].xp - a[1].xp);
    const primarySkill = sortedSkills[0];
    const skillLevel = primarySkill ? primarySkill[1].level : 0;
    const skillXp = primarySkill ? primarySkill[1].xp : 0;
    const xpPercent = primarySkill && primarySkill[1].nextLevelXp ? Math.round((primarySkill[1].xp / primarySkill[1].nextLevelXp) * 100) : 0;

    let totalLevel = 0;
    let totalXp = 0;
    let trainedCount = 0;
    const allSkills = {};
    for (const [sk, info] of Object.entries(rawSkills)) {
      const lvl = info.level ?? 1;
      const xp = info.xp ?? 0;
      const next = info.nextLevelXp ?? thresholds[lvl] ?? null;
      const prev = thresholds[Math.max(0, lvl - 1)] ?? 0;
      const inLevelPct = next && next > prev ? Math.max(0, Math.min(100, Math.round(((xp - prev) / (next - prev)) * 1000) / 10)) : 100;
      const pct = next ? Math.max(0, Math.min(100, Math.round((xp / next) * 1000) / 10)) : 100;
      totalLevel += lvl;
      totalXp += xp;
      if (lvl > 1 || xp > 0) trainedCount += 1;
      allSkills[sk] = { level: lvl, xp, nextLevelXp: next, prevLevelXp: prev, pct, inLevelPct };
    }

    const doneQuests = new Set(progression.completedQuestIds || []);
    const readyQuests = (gc?.quests || []).filter((q) => {
      if (doneQuests.has(q.id)) return false;
      if ((rawSkills[q.skill]?.level ?? 1) < (q.requiredLevel ?? 1)) return false;
      return (q.requirements || []).every((r) => (items[r.itemId] ?? 0) >= r.quantity);
    });

    const readyRecipes = (cap.recipes || [])
      .filter((r) => (r.craftableBatches ?? 0) > 0 && !r.failureReason)
      .map((r) => ({ id: r.recipeId, skill: r.skill, requiredLevel: r.requiredLevel, batches: r.craftableBatches }));

    const smoothies = items.matcha_smoothie || 0;
    const rawFish = items.fish || 0;
    const cookedFish = items.cooked_fish || 0;
    const medicine = items.aegis_reagent_salve || 0;
    // ~1 smoothie cada ~3.5h de trabajo continuo
    const autonomyHours = Math.round((smoothies * 3.5 + cookedFish * 2.5) * 10) / 10;

    const topItems = Object.entries(items)
      .filter(([id, q]) => id !== "crystal" && q > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, qty]) => ({ id, name: itemById[id]?.name ?? id, qty, category: itemById[id]?.category ?? "item" }));

    const toolsCarried = Object.keys(items).filter((id) => items[id] > 0 && itemById[id]?.tool);
    const atRisk = cap.death?.atRiskItems || [];

    return {
      name: agent.name,
      profession: agent.profession,
      trainingPlan: agent.trainingPlan || [],
      buyTool: agent.buyTool !== false,
      level: skillLevel,
      xp: skillXp,
      nextLevelXp: primarySkill ? primarySkill[1].nextLevelXp ?? null : null,
      xpPercent,
      totalLevel,
      totalXp,
      secondaryXp: Math.max(0, totalXp - skillXp),
      trainedCount,
      allSkills,
      hunger: Math.max(0, Math.min(100, hunger)),
      health: cap.health ?? progression.vitals?.health ?? 100,
      maxHealth: cap.maxHealth ?? progression.vitals?.maxHealth ?? 100,
      crystals: items.crystal || 0,
      working: current.isPerformingJob || false,
      activeAction: current.activeAction ? { kind: current.activeAction.kind, activity: current.activeAction.activity, target: current.activeAction.engageTargetId } : null,
      speed: load.workSpeedPercent ?? 100,
      excessWeight: load.excessWeight ?? 0,
      location: context.currentSpace?.name || "?",
      spaceId: current.position?.spaceId || context.currentSpace?.id || null,
      coords: current.position ? { x: current.position.x, y: current.position.y } : null,
      skill: primarySkill ? `${primarySkill[0]} L${primarySkill[1].level}` : "?",
      vitals: { smoothies, rawFish, cookedFish, medicine, autonomyHours },
      training: trainingRow ? {
        skill: trainingRow.skill,
        sourceId: trainingRow.source_id,
        startLevel: trainingRow.start_level,
        targetLevel: trainingRow.target_level,
        active: trainingRow.active,
        startedAt: trainingRow.started_at,
        finishedAt: trainingRow.finished_at,
        lastNote: trainingRow.last_note,
      } : null,
      quests: {
        completed: doneQuests.size,
        readyCount: readyQuests.length,
        readyXp: readyQuests.reduce((s, q) => s + (q.xp || 0), 0),
        readyList: readyQuests.slice(0, 8).map((q) => ({ id: q.id, name: q.name, areaId: q.areaId, skill: q.skill, xp: q.xp })),
      },
      crafting: {
        usable: cap.recipes?.length ?? 0,
        blocked: cap.blockedCounts?.recipes ?? 0,
        readyRecipes,
      },
      inventorySummary: {
        distinctItems: Object.keys(items).filter((k) => items[k] > 0).length,
        totalUnits: Object.entries(items).reduce((s, [k, v]) => (k === "crystal" ? s : s + (v || 0)), 0),
        crystalsAtRisk: atRisk.find((i) => i.itemId === "crystal")?.quantity ?? 0,
        officeFee: cap.death?.officeFee ?? 0,
        toolsCarried,
        topItems,
      },
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

function mergeWithArchive(liveHistory) {
  const dayMap = new Map(ARCHIVED_DAYS.map((d) => [`${d.date}|${d.agent}`, d]));
  for (const d of liveHistory?.days || []) {
    dayMap.set(`${d.date}|${d.agent}`, d);
  }
  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date) || a.agent.localeCompare(b.agent));

  const liveRanks = liveHistory?.ranks || [];
  const minLiveRankAt = liveRanks[0]?.at || "9999";
  const ranks = [
    ...ARCHIVED_RANKS.filter((r) => r.at < minLiveRankAt),
    ...liveRanks,
  ];

  return {
    ...(liveHistory || {}),
    days,
    ranks,
    hours: liveHistory?.hours || [],
    phases: liveHistory?.phases || [],
  };
}

async function fetchHistory(days = 14) {
  const queryDays = Math.min(Math.max(days, 7), 14);
  for (const tryDays of [queryDays, 7, 3, 1]) {
    try {
      const live = await rpc("midnight_dashboard", { p_days: tryDays });
      return mergeWithArchive(live);
    } catch (err) {
      console.warn(`midnight_dashboard(${tryDays}) failed: ${err.message}`);
    }
  }
  // Even if Supabase RPC fails completely, serve the 51+ days of Genesis archive without error!
  return mergeWithArchive({ days: [], ranks: [], hours: [], phases: [] });
}

export async function getDashboardData(days = 7) {
  const gcPromise = fetchGameContent().catch(() => null);
  const trainingPromise = getTrainingRows().catch(() => []);
  const [history, live, boards, totalAgents] = await Promise.all([
    fetchHistory(days),
    Promise.all(AGENTS.map(async (a) => {
      const [gc, rows] = await Promise.all([gcPromise, trainingPromise]);
      return getAgentStatus(a, gc, rows.find((r) => r.agent_id === a.id));
    })),
    Promise.all(AGENTS.map((a) => fetchBoard(a.id))),
    fetchAgentCount(),
  ]);
  return { timestamp: new Date().toISOString(), totalAgents, history, live: live.map((a, i) => ({ ...a, board: boards[i] })) };
}
