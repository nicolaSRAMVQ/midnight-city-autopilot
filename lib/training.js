// Secondary-skill training. The game's profession loop (`perform_job`) repeats
// on its own, but `gather` is a single pull, so training needs a worker that
// chains pulls (api/training-worker.js, every minute). State lives in Supabase
// (midnight.agent_training): one row per agent, `active` while training.
import { AGENTS } from "./agents.js";
import { rpc } from "./supabase.js";

export const TRAINING_MAX_MS = 2 * 60 * 60 * 1000; // never more than 2 h away from the main job
export const DAILY_SHIFT_EVERY_MS = 20 * 60 * 60 * 1000; // campaign: one forced shift per ~day
const CREW_PRIMARY_SOURCES = new Set(AGENTS.map((a) => a.profile.primarySourceId));
const SHAREABLE_NODES = 5;

export async function getTrainingRows() {
  return (await rpc("midnight_get_training")) ?? [];
}

// Lowest-level skill of the agent's plan that has a source available now; the
// source prefers outputs a merchant buys, then more free nodes. Single-node
// worksites of crewmates are skipped (R2's terminal).
export function chooseTraining(agent, progression, gameContent, merchants) {
  const plan = agent.trainingPlan ?? [];
  const skills = progression.skills ?? {};
  const sources = (progression.capabilities?.sources ?? []).filter((s) => {
    const nodes = s.availableNodeIds?.length ?? 0;
    if (s.sourceId === agent.profile.primarySourceId || s.failureReason !== null || nodes === 0) return false;
    return !CREW_PRIMARY_SOURCES.has(s.sourceId) || nodes >= SHAREABLE_NODES;
  });
  const sellable = new Set(merchants.filter((m) => m.offer?.paysItemId === "crystal").map((m) => m.offer.acceptsItemId));
  const sells = (s) => (gameContent?.sources?.find((d) => d.id === s.sourceId)?.outputs ?? []).some((o) => sellable.has(o.itemId));

  const skill = plan
    .filter((sk) => sources.some((s) => s.skill === sk))
    .sort((a, b) => (skills[a]?.level ?? 1) - (skills[b]?.level ?? 1) || plan.indexOf(a) - plan.indexOf(b))[0];
  if (!skill) return null;
  const source = sources
    .filter((s) => s.skill === skill)
    .sort((a, b) => sells(b) - sells(a) || b.availableNodeIds.length - a.availableNodeIds.length)[0];
  const level = skills[skill]?.level ?? 1;
  return { skill, sourceId: source.sourceId, startLevel: level, targetLevel: level + 1 };
}

export async function startTraining(agent, choice, reason) {
  await rpc("midnight_start_training", {
    p_agent_id: agent.id,
    p_skill: choice.skill,
    p_source_id: choice.sourceId,
    p_start_level: choice.startLevel,
    p_target_level: choice.targetLevel,
    p_reason: reason,
  });
}

export async function finishTraining(agent, note) {
  await rpc("midnight_finish_training", { p_agent_id: agent.id, p_note: note });
}
