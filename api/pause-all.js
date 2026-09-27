/**
 * v3.14: Emergency kill switch — stops in-flight work on every agent RIGHT
 * NOW. This is the "something is going wrong, freeze everything" button.
 *
 * This alone does not stop the autopilot from resuming work on its next
 * cycle (every 5 min) — for that, set AUTOPILOT_PAUSED=true in Vercel's
 * project env vars. This endpoint just handles the immediate stop; the env
 * var handles "stay stopped." Call this first, then flip the env var if the
 * pause needs to last longer than one cycle.
 */

import { AGENTS } from "../lib/agents.js";
import { connect, release, submitAndWait } from "../lib/mcity-maintenance.js";

async function pauseAgent(agent) {
  let lease = null;
  try {
    lease = await connect(agent.id);
    const stop = await submitAndWait(
      lease,
      { kind: "stop_job" },
      (p) => p.kind === "activity_completed" && p.activity === "stop_job",
    );
    return {
      agent: agent.name,
      stopped: stop.confirmed,
      note: stop.confirmed
        ? "Work stopped"
        : stop.failed
          ? `Nothing to stop (${stop.reason})`
          : "Stop sent, unconfirmed (agent may have already been idle)",
    };
  } catch (error) {
    return { agent: agent.name, stopped: false, error: error.message };
  } finally {
    if (lease) await release(lease);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed — use POST to confirm this is intentional" });
  }
  if (!process.env.MCITY_OBSERVER_URL || !process.env.MCITY_API_TOKEN) {
    return res.status(500).json({ error: "Missing env variables" });
  }

  const results = await Promise.all(AGENTS.map(pauseAgent));

  res.status(200).json({
    success: true,
    results,
    reminder: process.env.AUTOPILOT_PAUSED === "true"
      ? "AUTOPILOT_PAUSED is already set — agents will stay idle."
      : "Work stopped for this cycle only. Set AUTOPILOT_PAUSED=true in Vercel to keep it that way.",
  });
}
