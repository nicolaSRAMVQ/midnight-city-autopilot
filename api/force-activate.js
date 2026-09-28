import { AGENTS } from "../lib/agents.js";
import { requestJson } from "../lib/mcity-maintenance.js";

export default async function handler(req, res) {
  try {
    const results = [];

    for (const agent of AGENTS) {
      try {
        // Connect to session
        const session = await requestJson("/api/local-control/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.MCITY_API_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agent.id, clientInstanceId: `force-activate:${agent.id}`, modelId: null }),
        });

        // Opening the session is what wakes the agent; put it straight back to work.
        await requestJson("/api/actions", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agent.id, kind: "perform_job" }),
        });

        // Release session
        await requestJson("/api/local-control/session/release", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.sessionId }),
        });

        results.push({ agent: agent.name, status: "✓ activated" });
      } catch (err) {
        results.push({ agent: agent.name, error: err.message });
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
