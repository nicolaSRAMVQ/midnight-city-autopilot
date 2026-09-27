/**
 * BB-8 EMERGENCY RESCUE: Direct food infusion
 * Bypasses all checks — just feeds BB-8 to break the hunger loop
 */

import { AGENTS } from "../lib/agents.js";
import { connect, release, submitAndWait } from "../lib/mcity-maintenance.js";

export default async function handler(req, res) {
  const bb8 = AGENTS.find(a => a.name === "BB-8");
  if (!bb8) return res.status(404).json({ error: "BB-8 not found" });

  try {
    let lease = null;
    try {
      lease = await connect(bb8.id);
      console.log(`[BB-8 RESCUE] Connected - EMERGENCY FEED INITIATED`);

      // Force eat immediately - bypass all checks
      // Try multiple times to ensure it sticks
      let ate = false;
      for (let i = 0; i < 3; i++) {
        const eat = await submitAndWait(
          lease,
          { kind: "eat" },
          (p) => p.kind === "agent_ate",
          8000
        );
        if (eat.confirmed) {
          console.log(`[BB-8 RESCUE] ATE on attempt ${i + 1}: hunger ${eat.payload.hungerBefore}→${eat.payload.hungerAfter}`);
          ate = true;
          break;
        }
      }

      if (!ate) {
        // If eat failed, force start mining to at least get working
        console.log(`[BB-8 RESCUE] Eat failed, forcing WORK`);
        await submitAndWait(
          lease,
          { kind: "perform_job", jobKind: "minería" },
          (p) => p.kind === "activity_started",
          8000
        );
      }

      return res.status(200).json({
        success: true,
        message: ate ? "✓ BB-8 salvado - comió!" : "✓ BB-8 forzado a trabajar (mining)",
        ate
      });
    } finally {
      if (lease) await release(lease);
    }
  } catch (error) {
    console.error("[BB-8 RESCUE]", error.message);
    return res.status(500).json({
      error: error.message,
      hint: "BB-8 puede estar durmiendo - intenta nuevamente en 10 segundos"
    });
  }
}
