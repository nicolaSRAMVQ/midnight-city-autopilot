import { AGENTS } from "../lib/agents.js";
import { connect, release, startWork } from "../lib/mcity-maintenance.js";

export default async function handler(req, res) {
  try {
    const results = [];

    for (const agent of AGENTS) {
      try {
        let lease = null;
        try {
          lease = await connect(agent.id);
          await startWork(lease, agent, [], `STABILIZE: Force work`);
          results.push({ agent: agent.name, status: "✓ work initiated" });
        } finally {
          if (lease) await release(lease);
        }
      } catch (err) {
        results.push({ agent: agent.name, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `✓ Stabilization: All agents forced to work`,
      results
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
