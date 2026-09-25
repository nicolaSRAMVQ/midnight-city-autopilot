/**
 * Emergency stabilize: Force all agents to eat and work
 * Use when agents are stuck in hunger loops
 */

import { AGENTS } from "../lib/agents.js";
import { connect, release, startWork, submitAndWait } from "../lib/mcity-maintenance.js";

const FOOD_MERCHANT = "Central Smoothies Matcha Outlet";
const FOOD_ITEM_ID = "matcha_smoothie";

export default async function handler(req, res) {
  try {
    const results = [];

    for (const agent of AGENTS) {
      try {
        let lease = null;
        try {
          lease = await connect(agent.id);
          console.log(`[Stabilize] Connecting ${agent.name}...`);

          // Read current state
          // Use the API endpoint from r2-report
          const OBSERVER = "https://r2-telegram-reporter.vercel.app";
          const TOKEN = process.env.MCITY_API_TOKEN;

          const context = await (await fetch(`${OBSERVER}/api/skill/agents/${agent.id}/context`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
          })).json();

          const needs = await (await fetch(`${OBSERVER}/api/skill/agents/${agent.id}/needs`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
          })).json();

          const hunger = needs.hunger?.value ?? 0;
          console.log(`${agent.name}: hunger ${hunger}`);

          // Force eat if hungry
          if (hunger > 60) {
            const eat = await submitAndWait(
              lease,
              { kind: "eat" },
              (p) => p.kind === "agent_ate",
              8000
            );
            if (eat.confirmed) {
              results.push({ agent: agent.name, action: "ate", success: true });
            } else {
              results.push({ agent: agent.name, action: "eat_failed", reason: eat.reason });
            }
          }

          // Force work if not working
          const current = context.agent || {};
          if (!current.isPerformingJob) {
            await startWork(lease, agent, [], "Stabilize: Force work");
            results.push({ agent: agent.name, action: "work_started", success: true });
          } else {
            results.push({ agent: agent.name, action: "already_working", success: true });
          }
        } finally {
          if (lease) await release(lease);
        }
      } catch (err) {
        results.push({ agent: agent.name, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: "✓ Stabilization cycle complete",
      results
    });
  } catch (error) {
    console.error("[Stabilize] Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
