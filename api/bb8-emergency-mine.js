/**
 * EMERGENCY: BB-8 forced mining when stuck at 0 crystals + hunger 100
 */

import { AGENTS } from "../lib/agents.js";
import { connect, release, startWork } from "../lib/mcity-maintenance.js";

export default async function handler(req, res) {
  const bb8 = AGENTS.find(a => a.name === "BB-8");
  if (!bb8) return res.status(404).json({ error: "BB-8 not found" });

  try {
    let lease = null;
    try {
      lease = await connect(bb8.id);
      console.log(`[BB-8 Emergency] Connected`);

      // Force mining regardless of state
      await startWork(lease, bb8, [], "EMERGENCY: Forced mining to recover crystals");

      return res.status(200).json({
        success: true,
        message: "✓ BB-8 emergency mining initiated"
      });
    } finally {
      if (lease) await release(lease);
    }
  } catch (error) {
    console.error("[BB-8 Emergency]", error);
    return res.status(500).json({ error: error.message });
  }
}
