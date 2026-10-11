/**
 * Live agent status endpoint — devuelve JSON con estado en vivo de los tres agentes.
 * v3.31: ?view=dashboard alimenta el tablero web (/tablero) con historial diario y ranking.
 */

import { AGENTS } from "../lib/agents.js";
import { getAgentStatus, getDashboardData } from "../lib/dashboard.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.MCITY_OBSERVER_URL || !process.env.MCITY_API_TOKEN) return res.status(500).json({ error: "Missing env variables" });

  try {
    if (req.query?.view === "dashboard") {
      res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
      return res.status(200).json(await getDashboardData(90));
    }
    const agents = await Promise.all(AGENTS.map(getAgentStatus));
    res.status(200).json({ success: true, timestamp: new Date().toISOString(), agents });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
