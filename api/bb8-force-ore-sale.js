/**
 * EMERGENCY: BB-8 ore sale bypass
 * Sell ore directly without waiting for connect/pause/work flow
 */

import { AGENTS } from "../lib/agents.js";
import { readAgentEndpoint, connect, release, requestJson } from "../lib/mcity-maintenance.js";

export default async function handler(req, res) {
  const bb8 = AGENTS.find(a => a.name === "BB-8");
  if (!bb8) return res.status(404).json({ error: "BB-8 not found" });

  try {
    // 1. Check current inventory
    let inv = await readAgentEndpoint(bb8.id, "inventory");
    const oreCount = inv.items?.find(i => i.id === "ore")?.quantity || 0;
    console.log(`[BB-8 FORCE SALE] Ore in inventory: ${oreCount}`);

    if (oreCount < 3) {
      return res.status(200).json({
        success: false,
        reason: `Not enough ore (have ${oreCount}, need 3)`,
        inventory: inv.items || []
      });
    }

    // 2. Connect and sell
    let lease = null;
    try {
      lease = await connect(bb8.id);
      console.log(`[BB-8 FORCE SALE] Connected`);

      // Try to sell 3 ore = 4 crystals
      const saleResult = await requestJson("/api/trade", {
        method: "POST",
        headers: { Authorization: `Bearer ${lease.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: bb8.id,
          quantity: 3,
          item: "ore",
          merchant: "Central Merchant East",
        }),
      });

      console.log(`[BB-8 FORCE SALE] Trade result:`, saleResult);

      // 3. Check crystals after
      const after = await readAgentEndpoint(bb8.id, "inventory");
      const crystalsBefore = inv.items?.find(i => i.id === "crystal")?.quantity || 0;
      const crystalsAfter = after.items?.find(i => i.id === "crystal")?.quantity || 0;

      return res.status(200).json({
        success: true,
        message: `✓ Sold 3 ore`,
        crystallsBefore,
        crystalsAfter,
        gain: crystalsAfter - crystallsBefore
      });
    } finally {
      if (lease) await release(lease);
    }
  } catch (error) {
    console.error("[BB-8 FORCE SALE]", error.message);
    return res.status(500).json({
      error: error.message,
      details: error.status ? `HTTP ${error.status}` : "Unknown"
    });
  }
}
