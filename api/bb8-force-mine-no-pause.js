/**
 * BB-8 ULTIMATE RESCUE: Force mine without pause
 * Directly start mining without hunger checks - let the mining session run
 * This breaks the pause loop and lets BB-8 accumulate crystals
 */

import { AGENTS } from "../lib/agents.js";
import { connect, release, requestJson } from "../lib/mcity-maintenance.js";

export default async function handler(req, res) {
  const bb8 = AGENTS.find(a => a.name === "BB-8");
  if (!bb8) return res.status(404).json({ error: "BB-8 not found" });

  try {
    let lease = null;
    try {
      lease = await connect(bb8.id);
      console.log(`[BB-8 FORCE MINE] Connected, forcing mining without pause...`);

      // Directly start mining job - no pause, no hunger check
      const job = await requestJson("/api/perform_job", {
        method: "POST",
        headers: { Authorization: `Bearer ${lease.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: bb8.id,
          jobKind: "minería"
        }),
      });

      console.log(`[BB-8 FORCE MINE] Job started:`, job?.status || "unknown");

      return res.status(200).json({
        success: true,
        message: "✓ BB-8 está minando (sin pausas). Debería acumular crystals en los próximos ciclos.",
        jobStatus: job?.status || "started"
      });
    } finally {
      if (lease) await release(lease);
    }
  } catch (error) {
    console.error("[BB-8 FORCE MINE]", error.message);
    return res.status(500).json({ error: error.message });
  }
}
