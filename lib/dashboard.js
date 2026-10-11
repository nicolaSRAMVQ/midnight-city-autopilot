// Shared data for the web dashboard (/tablero) and the Telegram buttons (v3.31):
// live state per droid, its leaderboard spot with neighbours, and daily history.
import { AGENTS } from "./agents.js";
import { readAgentEndpoint } from "./mcity-maintenance.js";
import { rpc } from "./supabase.js";

export const DASHBOARD_URL = "https://r2-telegram-reporter.vercel.app/tablero/";

export async function fetchBoard(agentId) {
  try {
    const base = (process.env.MCITY_OBSERVER_URL || "").replace(/\/$/, "");
    const r = await fetch(`${base}/api/leaderboards?board=experience&agentId=${encodeURIComponent(agentId)}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json();
    const pick = (e) => (e ? { rank: e.rank ?? null, name: e.name ?? e.agentName ?? e.displayName ?? null, xp: e.totalXp ?? e.xp ?? e.score ?? null } : null);
    const raw = j?.entry ?? {};
    const previous = raw.previous ?? j.previous ?? null;
    const next = raw.next ?? j.next ?? null;
    return { ...pick(raw), ahead: pick(Array.isArray(previous) ? previous.at(-1) : previous), behind: pick(Array.isArray(next) ? next[0] : next) };
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
    const base = (process.env.MCITY_OBSERVER_URL || "").replace(/\/$/, "");
    const r = await fetch(`${base}/api/agents`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j?.agents) ? j.agents.length : null;
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
