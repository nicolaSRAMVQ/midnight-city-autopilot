// Exploración del juego para el tablero (v3.34): qué tiene Midnight City (habilidades, mapa,
// contratos, enemigos, recetas, equipo, obras) y qué hizo y qué no cada droide. Todo sale del
// contenido estático del juego y de lo que el juego le permite a cada uno ("capabilities").
import { AGENTS } from "./agents.js";
import { fetchGameContent, fetchMerchants, readAgentEndpoint, requestJson } from "./mcity-maintenance.js";
import { rpc } from "./supabase.js";

const BOARD_LABEL = {
  experience: "Experiencia total", completedContracts: "Contratos completados", mostLiked: "Más likes", richest: "Más ricos",
  mostPopular: "Más populares", bounty_hunting: "Caza de recompensas",
};

async function fetchWorld() {
  const stats = await requestJson("/api/stats");
  return (await requestJson(`/api/static-world/${encodeURIComponent(stats.staticVersion)}`)).staticWorld;
}

async function boardRank(board, agentId) {
  try {
    const base = (process.env.MCITY_OBSERVER_URL || "").replace(/\/$/, "");
    const r = await fetch(`${base}/api/leaderboards?board=${board}&agentId=${encodeURIComponent(agentId)}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.entry?.rank ?? null;
  } catch {
    return null;
  }
}

export async function getExploration() {
  const [world, merchants, places] = await Promise.all([
    fetchWorld(),
    fetchMerchants().catch(() => []),
    rpc("midnight_places").catch(() => []),
  ]);
  const gc = world.gameContent;
  const contractById = Object.fromEntries(gc.contracts.map((c) => [c.id, c]));
  const itemById = Object.fromEntries(gc.items.map((i) => [i.id, i]));
  // En cuántas recetas y contratos se usa cada objeto: para saber si lo guardado sirve para algo.
  const uses = {};
  for (const r of gc.recipes) for (const i of r.inputs ?? []) (uses[i.itemId] ??= { recipes: 0, contracts: 0 }).recipes++
  for (const c of gc.contracts) for (const i of c.requirements ?? []) (uses[i.itemId] ??= { recipes: 0, contracts: 0 }).contracts++
  // Qué compra cada mercader: lo que se puede vender por crystals.
  const sellable = new Map(merchants.filter((m) => m.offer?.paysItemId === "crystal").map((m) => [m.offer.acceptsItemId, m.offer.paysQuantity / m.offer.acceptsQuantity]));
  const boards = (await requestJson("/api/leaderboards?board=experience").catch(() => ({}))).availableBoards ?? [];

  const droids = await Promise.all(AGENTS.map(async (agent) => {
    const [prog, inv, ctx] = await Promise.all([
      readAgentEndpoint(agent.id, "progression"),
      readAgentEndpoint(agent.id, "inventory"),
      readAgentEndpoint(agent.id, "context").catch(() => null),
    ]);
    const cap = prog.capabilities ?? {};
    const items = inv.inventory ?? {};
    const available = (cap.contracts ?? []).filter((c) => !c.completed && !c.failureReason);
    const doable = available.filter((c) => (contractById[c.contractId]?.requirements ?? []).every((r) => (items[r.itemId] ?? 0) >= r.quantity));
    const ranks = Object.fromEntries(await Promise.all(boards.map(async (b) => [b, await boardRank(b, agent.id)])));
    const atRisk = cap.death?.atRiskItems ?? [];
    const tools = Object.keys(items).filter((id) => itemById[id]?.tool);
    // Lo que guarda sin poder vender: objetos con valor que ningún mercader compra.
    const unsold = Object.entries(items)
      .filter(([id, q]) => id !== "crystal" && q > 0 && !sellable.has(id))
      .map(([id, q]) => ({ id, name: itemById[id]?.name ?? id, qty: q, recipes: uses[id]?.recipes ?? 0, contracts: uses[id]?.contracts ?? 0 }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
    return {
      name: agent.name,
      profession: agent.profession,
      space: ctx?.currentSpace?.name ?? null,
      skills: Object.fromEntries(Object.entries(prog.skills ?? {}).map(([k, v]) => [k, { level: v.level, xp: v.xp }])),
      contracts: {
        completed: prog.completedContractIds?.length ?? 0,
        available: available.length,
        doable: doable.length,
        doableXp: doable.reduce((s, c) => s + (contractById[c.contractId]?.xp ?? 0), 0),
        examples: doable.slice(0, 4).map((c) => ({ name: contractById[c.contractId]?.name, xp: contractById[c.contractId]?.xp })),
      },
      sources: { usable: cap.sources?.length ?? 0, blocked: cap.blockedCounts?.sources ?? 0 },
      recipes: { usable: cap.recipes?.length ?? 0, blocked: cap.blockedCounts?.recipes ?? 0 },
      enemies: { fightable: cap.enemies?.length ?? 0 },
      equipment: { equipped: Object.keys(cap.equippedItems ?? {}).length, equippable: cap.equippableItemIds?.length ?? 0 },
      health: { health: cap.health ?? prog.vitals?.health ?? null, max: cap.maxHealth ?? prog.vitals?.maxHealth ?? null },
      death: { crystalsAtRisk: atRisk.find((i) => i.itemId === "crystal")?.quantity ?? 0, itemsAtRisk: atRisk.length, officeFee: cap.death?.officeFee ?? null },
      itemsDistinct: Object.keys(items).length,
      tools,
      unsold,
      ranks,
    };
  }));

  const spaces = world.spaces.map((s) => ({ id: s.id, name: s.name, kind: s.kind }));
  const byArea = (list) => list.reduce((acc, x) => ((acc[x.areaId] = (acc[x.areaId] ?? 0) + 1), acc), {});
  return {
    timestamp: new Date().toISOString(),
    totals: {
      skills: gc.skillIds.length, items: gc.items.length, recipes: gc.recipes.length, sources: gc.sources.length,
      contracts: gc.contracts.length, enemies: gc.enemies.length, constructionSites: gc.constructionSites.length,
      workstations: gc.workstations.length, spaces: spaces.length, boards: boards.length,
      equipment: gc.items.filter((i) => i.equipment).length, tools: gc.items.filter((i) => i.tool).length,
    },
    skillIds: gc.skillIds,
    skillSources: Object.fromEntries(gc.skillIds.map((s) => [s, {
      sources: gc.sources.filter((x) => x.skill === s).length,
      recipes: gc.recipes.filter((x) => x.skill === s).length,
      contracts: gc.contracts.filter((x) => x.skill === s).length,
    }])),
    enemies: [...new Map(gc.enemies.map((e) => [e.requiredLevel, e])).values()]
      .sort((a, b) => a.requiredLevel - b.requiredLevel)
      .map((e) => ({ tier: e.name.split(" ").pop(), level: e.requiredLevel, health: e.maxHealth, attack: e.attack, defence: e.defence, bountyXp: e.bountyXp, damageXp: e.damageXp })),
    enemyFactions: [...new Set(gc.enemies.map((e) => e.name.split(" ")[0]))],
    enemyArea: world.spaces.find((s) => s.id === gc.enemies[0]?.areaId)?.name ?? gc.enemies[0]?.areaId,
    construction: (() => { const c = gc.constructionSites[0]; return c ? { count: gc.constructionSites.length, installCost: c.installCost, upkeep: c.upkeepBaseCost, upkeepIncrease: c.upkeepDailyIncrease, workBonus: c.workBonusPercent } : null })(),
    spaces,
    activity: {
      sources: byArea(gc.sources.filter((s) => s.areaId)), contracts: byArea(gc.contracts), enemies: byArea(gc.enemies), workstations: byArea(gc.workstations),
    },
    places: places ?? [],
    boardLabels: BOARD_LABEL,
    droids,
  };
}
