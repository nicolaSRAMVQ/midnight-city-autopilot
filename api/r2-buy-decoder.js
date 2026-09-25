/**
 * Quick action: R2 buys cinder_decoder from Hacker House Decoder Vendor
 * Called directly from dashboard "Quick Buy" button
 */

import { AGENTS } from "../lib/agents.js";
import { connect, release, requestJson, submitAndWait, startWork } from "../lib/mcity-maintenance.js";

const SLOW_ACTION_WAIT_MS = 8_000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const r2 = AGENTS.find(a => a.name === "R2");
  if (!r2) return res.status(404).json({ error: "R2 not found" });

  try {
    let lease = null;
    try {
      lease = await connect(r2.id);
      console.log(`[R2 Quick Buy] Connected as ${r2.name}`);

      // Buy decoder: 14 crystals → cinder_decoder
      const buy = await submitAndWait(
        lease,
        {
          kind: "trade",
          merchantName: "Hacker House Decoder Vendor",
          itemId: "crystal",
          quantity: 14
        },
        (p) => p.kind === "merchant_trade_completed",
        SLOW_ACTION_WAIT_MS,
      );

      if (buy.confirmed) {
        console.log(`✓ R2 bought cinder_decoder!`);

        // Resume work to use new decoder
        await startWork(lease, r2, [], "Continuó con nuevo decoder");

        return res.status(200).json({
          success: true,
          message: "✓ R2 compró cinder_decoder y retomó trabajo",
          decoder_acquired: true
        });
      } else {
        return res.status(200).json({
          success: false,
          message: `⚠️ Compra pendiente: ${buy.reason}`,
          reason: buy.reason
        });
      }
    } finally {
      if (lease) await release(lease);
    }
  } catch (error) {
    console.error("[R2 Quick Buy] Error:", error);
    return res.status(500).json({
      error: error.message,
      details: "No se pudo ejecutar compra de decoder"
    });
  }
}
