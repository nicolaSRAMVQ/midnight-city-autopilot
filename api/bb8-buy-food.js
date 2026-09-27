/**
 * BB-8 RESCUE PHASE 2: Buy + Feed
 * Purchases food for BB-8 (using 20 crystals or manual override)
 * Then forces eat to break the hunger loop
 */

import { AGENTS } from "../lib/agents.js";
import { connect, release, submitAndWait, readAgentEndpoint } from "../lib/mcity-maintenance.js";

const FOOD_MERCHANT = "Central Smoothies Matcha Outlet";
const FOOD_COST = 20;

export default async function handler(req, res) {
  const bb8 = AGENTS.find(a => a.name === "BB-8");
  if (!bb8) return res.status(404).json({ error: "BB-8 not found" });

  try {
    let lease = null;
    try {
      lease = await connect(bb8.id);
      console.log(`[BB-8 BUY+FEED] Connected`);

      // Check current crystals
      const inv = await readAgentEndpoint(bb8.id, "inventory");
      const crystals = inv.inventory?.crystal ?? 0;
      console.log(`[BB-8 BUY+FEED] Current crystals: ${crystals}`);

      // Buy food if we have at least 20 crystals
      let foodBought = false;
      if (crystals >= FOOD_COST) {
        console.log(`[BB-8 BUY+FEED] Attempting to buy food...`);
        const buy = await submitAndWait(
          lease,
          {
            kind: "trade",
            merchantName: FOOD_MERCHANT,
            itemId: "crystal",
            quantity: FOOD_COST
          },
          (p) => p.kind === "merchant_trade_completed" && p.merchantName === FOOD_MERCHANT,
          10000
        );
        if (buy.confirmed) {
          console.log(`[BB-8 BUY+FEED] ✓ Bought food`);
          foodBought = true;
        } else {
          console.log(`[BB-8 BUY+FEED] Buy failed:`, buy.reason);
        }
      } else {
        console.log(`[BB-8 BUY+FEED] Not enough crystals (have ${crystals}, need ${FOOD_COST})`);
      }

      // Now try to eat (regardless of whether we just bought)
      let ate = false;
      for (let i = 0; i < 3; i++) {
        const eat = await submitAndWait(
          lease,
          { kind: "eat" },
          (p) => p.kind === "agent_ate",
          8000
        );
        if (eat.confirmed) {
          console.log(`[BB-8 BUY+FEED] ✓ ATE: hunger ${eat.payload.hungerBefore}→${eat.payload.hungerAfter}`);
          ate = true;
          break;
        }
      }

      // Force work to resume
      if (ate || foodBought) {
        await submitAndWait(
          lease,
          { kind: "perform_job", jobKind: "minería" },
          (p) => p.kind === "activity_started",
          8000
        ).catch(() => null);
      }

      return res.status(200).json({
        success: true,
        crystals,
        foodBought,
        ate,
        message: ate ? "✓ BB-8 comió y volvió a trabajar" :
                 foodBought ? "✓ Comida comprada, esperando próximo ciclo" :
                 "⚠️ Sin crystals suficientes - BB-8 necesita minar primero"
      });
    } finally {
      if (lease) await release(lease);
    }
  } catch (error) {
    console.error("[BB-8 BUY+FEED]", error.message);
    return res.status(500).json({ error: error.message });
  }
}
