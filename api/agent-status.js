/**
 * Live agent status endpoint — devuelve JSON con estado en vivo de los tres agentes.
 * Se usa desde el artifact dashboard para actualizaciones en tiempo real.
 */

import { AGENTS } from "../lib/agents.js";
import { readAgentEndpoint } from "../lib/mcity-maintenance.js";

async function getAgentStatus(agent) {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200);
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.MCITY_OBSERVER_URL || !process.env.MCITY_API_TOKEN) {
    return res.status(500).json({ error: "Missing env variables" });
  }

  try {
    const agents = await Promise.all(AGENTS.map(getAgentStatus));
    const timestamp = new Date().toISOString();

    res.status(200).json({
      success: true,
      timestamp,
      agents,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
