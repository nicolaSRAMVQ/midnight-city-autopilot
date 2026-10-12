/**
 * Live agent status endpoint — devuelve JSON con estado en vivo de los tres agentes.
 * v3.31: ?view=dashboard alimenta el tablero web (/tablero) con historial diario y ranking.
 */

import { AGENTS } from "../lib/agents.js";
import { getAgentStatus, getDashboardData } from "../lib/dashboard.js";
import { getExploration } from "../lib/explore.js";
import { createHash, timingSafeEqual } from "node:crypto";
import { connect, fetchRecentEvents, readAgentEndpoint, requestJson, submitAndWait } from "../lib/mcity-maintenance.js";

// v3.36: control manual de un agente para pruebas supervisadas (por ejemplo el combate de BB-8).
// Solo con la clave MIDNIGHT_CONTROL_KEY; nunca la usa el tablero. Solo POST.
const sameKey = (a, b) => { const h = (x) => createHash("sha256").update(String(x)).digest(); return timingSafeEqual(h(a), h(b)); };
async function control(req, res) {
  const key = process.env.MIDNIGHT_CONTROL_KEY;
  if (req.method !== "POST" || !key || !sameKey(req.headers["x-control-key"] ?? "", key)) return res.status(401).json({ error: "unauthorized" });
  const { agent: name, action, expect, waitMs } = req.body ?? {};
  const agent = AGENTS.find((a) => a.name === name);
  if (!agent) return res.status(400).json({ error: "agente desconocido" });
  const state = async () => {
    const [ctx, inv, prog] = await Promise.all(["context", "inventory", "progression"].map((e) => readAgentEndpoint(agent.id, e)));
    const c = prog.capabilities ?? {};
    return { space: ctx.currentSpace?.id, pos: ctx.agent?.position, status: ctx.agent?.status, action: ctx.agent?.activeAction ?? null,
      working: ctx.agent?.isPerformingJob, crystals: inv.inventory?.crystal, hunger: null, health: c.health ?? prog.vitals?.health, maxHealth: c.maxHealth ?? prog.vitals?.maxHealth,
      skills: { combat: prog.skills?.combat, defence: prog.skills?.defence, ranged: prog.skills?.ranged, vitality: prog.skills?.vitality },
      enemies: c.enemies ?? [], recovery: c.death?.recovery ?? [], healthItems: c.healthItemIds ?? [] };
  };
  if (!action) return res.status(200).json({ state: await state() });
  const lease = await connect(agent.id);
  // Combate cuerpo a cuerpo: el enemigo se mueve, así que se lee dónde pararse, se camina ahí
  // y se ataca enseguida, hasta 3 intentos dentro de la misma llamada.
  if (action.kind === "__melee") {
    const tries = [];
    for (let i = 0; i < 3; i++) {
      const prog = await requestJson(`/api/skill/agents/${encodeURIComponent(agent.id)}/progression?includeBlocked=true`);
      const e = (prog.capabilities?.enemies ?? []).find((x) => x.enemyId === action.enemyId);
      if (!e) { tries.push("no aparece"); break; }
      if (e.meleeFailureReason && e.approachPosition) {
        await submitAndWait(lease, { kind: "move_to", destination: e.approachPosition }, (p) => p.kind === "agent_arrived", 6000);
      }
      const r = await submitAndWait(lease, { kind: "attack", enemyId: action.enemyId }, () => true, 5000);
      tries.push(r.confirmed ? r.payload.kind : r.reason);
      if (r.confirmed) break;
    }
    const events = (await fetchRecentEvents(agent.id)).slice(-10).map((e) => e.payload);
    return res.status(200).json({ tries, events, state: await state() });
  }
  const r = await submitAndWait(lease, action, (p) => !expect || p.kind === expect, Math.min(Number(waitMs) || 15000, 20000));
  const events = (await fetchRecentEvents(agent.id)).slice(-8).map((e) => ({ kind: e.payload?.kind, reason: e.payload?.reason, ...(e.payload?.kind?.includes("attack") || e.payload?.kind?.includes("damage") || e.payload?.kind?.includes("enemy") ? { p: e.payload } : {}) }));
  return res.status(200).json({ result: r, events, state: await state() });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "HEAD" && req.query?.view !== "control") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.MCITY_OBSERVER_URL || !process.env.MCITY_API_TOKEN) return res.status(500).json({ error: "Missing env variables" });

  if (req.query?.view === "control") return control(req, res).catch((e) => res.status(500).json({ error: e.message }));

  try {
    if (req.query?.view === "explore") {
      res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
      return res.status(200).json(await getExploration());
    }
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
