/**
 * Training worker — every minute (Supabase pg_cron). For each agent with an
 * active row in midnight.agent_training, chains single `gather` pulls on the
 * training source for ~45 s until that skill reaches its target level, then
 * finishes the row and puts the agent back on its profession. Also starts the
 * campaign's daily training shift. The 5-min autopilot still handles eating,
 * selling and food, and leaves training agents to this worker.
 */

import { AGENTS } from "../lib/agents.js";
import {
  connect,
  fetchGameContent,
  fetchMerchants,
  readAgentEndpoint,
  submitAndWait,
  tryReadWithoutConnecting,
} from "../lib/mcity-maintenance.js";
import {
  DAILY_SHIFT_EVERY_MS,
  TRAINING_MAX_MS,
  chooseTraining,
  finishTraining,
  getTrainingPolicy,
  getTrainingRows,
  startTraining,
} from "../lib/training.js";

const LOOP_BUDGET_MS = 50_000;
const PULL_WAIT_MS = 20_000;

async function trainAgent(agent, row, shared) {
  const initial = await tryReadWithoutConnecting(agent.id);
  const control = initial?.context.controlStatus ?? null;
  if (control !== null && control.mode !== "browser_local") return { agent: agent.name, skipped: "externally_controlled" };

  let active = row?.active ? row : null;
  if (!active) {
    const lastShift = row?.finished_at ? Date.parse(row.finished_at) : 0;
    if (Date.now() - lastShift < DAILY_SHIFT_EVERY_MS || !initial) {
      // Keep-alive: the control lease lasts exactly the autopilot's 5-min interval, so
      // agents only touched by the autopilot dropped out of the city ~30% of the time
      // (C-3PO, 3/10). Renewing it every minute costs no action and doesn't stop work.
      // v3.29: not on the autopilot's minutes. A second connect while its run is
      // mid-flight voids its token and it got HTTP 401 (~100 alerts/day from 4/10).
      const minute = new Date().getUTCMinutes() % 5;
      if (minute === 0 || minute === 1) return { agent: agent.name, idle: true, keepAlive: "skipped_autopilot_minute" };
      await connect(agent.id);
      return { agent: agent.name, idle: true, keepAlive: true };
    }
    const [gameContent, merchants, policy] = await shared;
    const choice = chooseTraining(agent, initial.progression, gameContent, merchants, policy.maxLevel);
    if (!choice) return { agent: agent.name, idle: true, note: "sin skill de entrenamiento disponible" };
    await startTraining(agent, choice, `turno diario · fase ${policy.id ?? "libre"}`);
    active = { ...choice, skill: choice.skill, source_id: choice.sourceId, target_level: choice.targetLevel, started_at: new Date().toISOString() };
  }

  const lease = await connect(agent.id);
  const read = (endpoint) => readAgentEndpoint(agent.id, endpoint);
  const progression = await read("progression");
  const level = progression.skills?.[active.skill]?.level ?? 1;

  const backToMain = async (note) => {
    await finishTraining(agent, note);
    const job = await submitAndWait(lease, { kind: "perform_job" }, (p) => p.kind === "resource_gathered", 8_000);
    return { agent: agent.name, finished: note, backToMain: job.confirmed || !job.failed ? "ok" : job.reason };
  };
  if (level >= active.target_level) return backToMain(`${active.skill} llegó a L${level}`);
  if (Date.now() - Date.parse(active.started_at) > TRAINING_MAX_MS) return backToMain(`tope de 2 h en ${active.skill} (L${level})`);

  const context = await read("context");
  if (/trade|travel/.test(context.agent.activeAction?.kind ?? "")) return { agent: agent.name, waiting: context.agent.activeAction.kind };

  const deadline = Date.now() + LOOP_BUDGET_MS;
  let pulls = 0;
  let lastReason = null;
  // A pull from the previous minute may still be walking to its node: let it land.
  let current = context.agent.activeAction;
  while (current?.kind === "gather" && Date.now() + 5_000 < deadline) {
    await new Promise((r) => setTimeout(r, 3_000));
    current = (await read("context")).agent.activeAction;
  }
  while (Date.now() + 5_000 < deadline) {
    let r;
    try {
      r = await submitAndWait(
        lease,
        { kind: "gather", sourceId: active.source_id },
        (p) => p.kind === "resource_gathered",
        Math.min(PULL_WAIT_MS, deadline - Date.now()),
      );
    } catch (error) {
      lastReason = error.status === 401 ? "otro ciclo tomó el control" : error.message.slice(0, 80);
      break;
    }
    if (r.confirmed) {
      pulls += 1;
      continue;
    }
    if (r.failed) {
      lastReason = r.reason;
      break; // rejected: the next minute (or the autopilot) sorts it out
    }
    // Timeout: each node gives ~5 pulls and then regenerates, so the agent is walking
    // to a fresh node. Breaking here wasted the rest of the minute (3/10: BB-8 averaged
    // ~1 pull in those minutes vs ~11 otherwise); let the pull land and keep going.
    let walking = (await read("context")).agent.activeAction;
    while (walking?.kind === "gather" && Date.now() + 3_000 < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      walking = (await read("context")).agent.activeAction;
    }
    if (walking?.kind === "gather") {
      lastReason = "timeout";
      break;
    }
    pulls += 1;
  }
  return { agent: agent.name, skill: active.skill, level, target: active.target_level, pulls, stop: lastReason };
}

export default async function handler(req, res) {
  if (process.env.AUTOPILOT_PAUSED === "true") return res.status(200).json({ worker: true, paused: true });
  if (!process.env.MCITY_OBSERVER_URL || !process.env.MCITY_API_TOKEN) {
    return res.status(500).json({ worker: true, error: "Missing env variables" });
  }
  let rows;
  try {
    rows = await getTrainingRows();
  } catch (error) {
    return res.status(200).json({ worker: true, error: error.message });
  }
  const shared = Promise.all([fetchGameContent().catch(() => null), fetchMerchants(), getTrainingPolicy()]);
  const results = await Promise.all(
    AGENTS.map((agent) =>
      trainAgent(agent, rows.find((r) => r.agent_id === agent.id), shared).catch((error) => ({ agent: agent.name, error: error.message })),
    ),
  );
  res.status(200).json({ worker: true, results });
}
