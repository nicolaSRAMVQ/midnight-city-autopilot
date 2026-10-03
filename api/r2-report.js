/**
 * Droid crew Telegram report — 4x/day (Supabase pg_cron). One short narrative
 * intro for the whole crew, then every metric for each agent in lib/agents.js.
 * Each agent goes through the same maintenance as the autopilot; agents under
 * another kind of control (e.g. the City app's own runtime) are only read.
 */

import { AGENTS } from "../lib/agents.js";
import {
  FOOD_ITEM_IDS,
  HUNGER_EAT_THRESHOLD,
  PROFESSION_SKILL,
  fetchGameContent,
  runConnectedMaintenance,
  tryReadWithoutConnecting,
} from "../lib/mcity-maintenance.js";
import { getTrainingRows } from "../lib/training.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_LIMIT = 4000;

const TZ = "America/Argentina/Buenos_Aires";
const num = (n) => Number(n ?? 0).toLocaleString("es-AR");
const listEs = (names) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`);
const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Progress inside the current level, from the game's own xpThresholds table
// (index = level - 1 holds the XP where that level starts).
function levelProgress(skill, thresholds) {
  if (!skill) return null;
  const start = thresholds?.[skill.level - 1];
  const next = skill.nextLevelXp;
  if (next == null) return { level: skill.level, xp: skill.xp, next: null, pct: 100 };
  if (start == null || next <= start) return { level: skill.level, xp: skill.xp, next, pct: null };
  return { level: skill.level, xp: skill.xp, next, pct: Math.floor(((skill.xp - start) / (next - start)) * 1000) / 10 };
}

const fmtProgress = (name, p) =>
  p.next == null
    ? `${name} L${p.level} (máximo)`
    : `${name} L${p.level} · ${p.pct ?? "?"}% → L${p.level + 1} (${num(p.xp)} / ${num(p.next)} XP)`;

function agentMetrics(agent, data, gameContent) {
  const { context, needs, inventory, progression } = data;
  const items = inventory.inventory ?? {};
  const load = inventory.load ?? {};
  const skills = progression.skills ?? {};
  const primaryName = PROFESSION_SKILL[agent.profession];
  const primary = levelProgress(skills[primaryName], gameContent?.xpThresholds);
  const others = Object.entries(skills)
    .filter(([name, s]) => name !== primaryName && s.xp > 0)
    .sort((a, b) => b[1].xp - a[1].xp)
    .map(([name, s]) => ({ name, p: levelProgress(s, gameContent?.xpThresholds) }));
  const tools = (gameContent?.items ?? []).filter((i) => i.tool && (items[i.id] ?? 0) > 0);
  const foodCount = FOOD_ITEM_IDS.reduce((sum, id) => sum + (items[id] ?? 0), 0);
  return {
    agent,
    working: Boolean(context.agent?.isPerformingJob),
    activity: context.agent?.activeAction?.activity ?? null,
    status: context.agent?.status ?? "?",
    place: context.currentSpace?.name ?? context.agent?.position?.spaceId ?? "?",
    hunger: needs.hunger?.value ?? 0,
    foodCount,
    health: progression.capabilities?.health,
    maxHealth: progression.capabilities?.maxHealth,
    crystals: items.crystal ?? 0,
    load,
    primaryName,
    primary,
    others,
    secondary: Object.fromEntries(others.map((o) => [o.name, o.p])),
    tools: tools.map((t) => ({ id: t.id, skill: t.tool.skill, requiredLevel: t.tool.requiredLevel, usable: (skills[t.tool.skill]?.level ?? 1) >= t.tool.requiredLevel })),
    inventory: Object.entries(items).filter(([id, q]) => id !== "crystal" && q > 0).sort((a, b) => b[1] - a[1]),
    contractsOpen: (progression.capabilities?.contracts ?? []).filter((c) => !c.completed && c.failureReason === null).length,
  };
}

function trainingLine(m, row) {
  if (!row) return null;
  if (row.active) {
    const p = m.secondary?.[row.skill];
    return `🎓 Entrenando ${esc(row.skill)} L${row.start_level} → L${row.target_level}${p?.pct != null ? ` (${p.pct}%)` : ""} en ${esc(row.source_id)}`;
  }
  const when = row.finished_at ? new Date(row.finished_at).toLocaleString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "?";
  return `🎓 Último entrenamiento: ${esc(row.last_note ?? row.skill)} (terminó ${when})`;
}

function formatAgentSection(m, notes, externallyControlled, trainingRow) {
  const doing = m.working ? `⚒️ ${esc(m.activity ?? "trabajando")}` : `🏕️ ${m.activity ? esc(m.activity) : "sin trabajo"} (${esc(m.status)})`;
  const hungerIcon = m.hunger >= HUNGER_EAT_THRESHOLD ? "🍽️" : "🥤";
  const loadLine = `⚖️ Velocidad ${m.load.workSpeedPercent ?? "?"}% · carga ${esc(m.load.state ?? "?")}${m.load.excessWeight ? ` (exceso ${num(m.load.excessWeight)}, lo más pesado: ${esc(m.load.heaviestItem)})` : ""}`;
  const toolLine = m.tools.length
    ? `🧰 ${m.tools.map((t) => `${esc(t.id)} ${t.usable ? "✅ activa" : `⏳ desde ${esc(t.skill)} L${t.requiredLevel}`}`).join(" · ")}`
    : "🧰 Sin herramienta";
  const lines = [
    `<b>✨ ${esc(m.agent.name)}</b> · ${esc(m.agent.profession)}${externallyControlled ? " · 🎮 controlado desde otro lado" : ""}`,
    `${doing} · 📍 ${esc(m.place)}`,
    m.primary ? `🎯 ${fmtProgress(esc(m.primaryName), m.primary)}` : `🎯 ${esc(m.primaryName)}: sin datos`,
    m.others.length ? `📚 ${m.others.map((o) => `${esc(o.name)} L${o.p.level}${o.p.pct != null ? ` (${o.p.pct}%)` : ""}`).join(" · ")}` : null,
    `💎 ${num(m.crystals)} crystals`,
    `${hungerIcon} Hambre ${m.hunger}/100 · comida ${m.foodCount}`,
    m.health != null ? `❤️ Salud ${m.health}/${m.maxHealth}` : null,
    loadLine,
    toolLine,
    `🎒 ${m.inventory.length ? m.inventory.map(([id, q]) => `${num(q)} ${esc(id)}`).join(", ") : "vacío"}`,
    m.contractsOpen ? `📜 ${m.contractsOpen} contrato(s) disponibles` : null,
    trainingLine(m, trainingRow),
    notes.length ? `🤖 ${notes.map(esc).join(" | ")}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function crewIntro(window, all, trainingRows) {
  const trainingOf = (a) => trainingRows.find((r) => r.agent_id === a.agent.id && r.active);
  const up = all.filter((a) => a.metrics);
  const total = up.reduce((sum, a) => sum + a.metrics.crystals, 0);
  const working = up.filter((a) => a.metrics.working && !trainingOf(a)).map((a) => a.metrics.agent.name);
  const training = up.filter((a) => trainingOf(a)).map((a) => `${a.metrics.agent.name} (${trainingOf(a).skill})`);
  const resting = up.filter((a) => !a.metrics.working && !trainingOf(a)).map((a) => a.metrics.agent.name);
  const asleep = all.filter((a) => !a.metrics).map((a) => a.agent.name);
  const best = up
    .filter((a) => a.metrics.primary?.pct != null)
    .sort((a, b) => b.metrics.primary.pct - a.metrics.primary.pct)[0];
  const worries = [];
  for (const a of up) {
    const m = a.metrics;
    if (m.hunger >= HUNGER_EAT_THRESHOLD && m.foodCount === 0) worries.push(`${m.agent.name} tiene hambre y nada para comer`);
    if ((m.load.workSpeedPercent ?? 100) < 100) worries.push(`${m.agent.name} va cargado al ${m.load.workSpeedPercent}%`);
  }
  const parts = [
    `${window.desc} La cuadrilla guarda ${num(total)} crystals.`,
    working.length ? `${listEs(working)} ${working.length > 1 ? "trabajan" : "trabaja"}` : "Nadie está trabajando ahora",
  ];
  let sentence = parts[1];
  if (training.length) sentence += `; ${listEs(training)} ${training.length > 1 ? "entrenan" : "entrena"} una skill nueva`;
  if (resting.length) sentence += `; ${listEs(resting)} ${resting.length > 1 ? "esperan" : "espera"} su turno`;
  if (asleep.length) sentence += `; ${listEs(asleep)} ${asleep.length > 1 ? "duermen" : "duerme"}`;
  const closing = worries.length
    ? `Ojo: ${worries.join(", ")}.`
    : best
      ? `El más cerca de subir es ${best.metrics.agent.name}, al ${best.metrics.primary.pct}% de ${esc(best.metrics.primaryName)} L${best.metrics.primary.level + 1}.`
      : "";
  return `${parts[0]} ${sentence}. ${closing}`.trim();
}

async function buildAgentData(agent) {
  const initial = await tryReadWithoutConnecting(agent.id);
  const control = initial?.context.controlStatus ?? null;
  const externallyControlled = control !== null && control.mode !== "browser_local";
  if (externallyControlled) return { agent, data: initial, notes: [], externallyControlled };
  const m = await runConnectedMaintenance(agent, {
    context: initial?.context ?? null,
    needs: initial?.needs ?? null,
    inventory: initial?.inventory ?? null,
    progression: initial?.progression ?? null,
  });
  return { agent, data: m, notes: m.autopilotNotes ?? [], externallyControlled };
}

async function sendTelegramMessage(text) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`Telegram error: ${response.status} ${await response.text()}`);
}

const WINDOWS = [
  { center: 9 * 60, name: "CRÓNICA MATINAL", desc: "Los primeros rayos iluminan la Ciudad Medianoche." },
  { center: 13 * 60, name: "PARTE MERIDIANO", desc: "El sol en su apogeo revela nuevos secretos." },
  { center: 18 * 60, name: "RELATO VESPERTINO", desc: "Las sombras alargadas traen noticias del crepúsculo." },
  { center: 21 * 60, name: "SUSURRO NOCTURNO", desc: "En la oscuridad, tres corazones laten al ritmo de la Ciudad." },
];

export async function buildReport() {
  const gameContent = await fetchGameContent().catch(() => null);
  const trainingRows = await getTrainingRows().catch(() => []);
  const all = await Promise.all(
    AGENTS.map(async (agent) => {
      try {
        const r = await buildAgentData(agent);
        const ok = r.data?.context && r.data?.needs && r.data?.inventory && r.data?.progression;
        return { ...r, metrics: ok ? agentMetrics(agent, r.data, gameContent) : null };
      } catch (error) {
        return { agent, metrics: null, error: error.message };
      }
    }),
  );

  const [hh, mm] = new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
  const minutes = hh * 60 + mm;
  const gap = (w) => Math.min(Math.abs(minutes - w.center), 1440 - Math.abs(minutes - w.center));
  const window = WINDOWS.reduce((a, b) => (gap(a) <= gap(b) ? a : b));

  const header = `📜 <b>${window.name}</b>\n<i>${crewIntro(window, all, trainingRows)}</i>`;
  const sections = all.map((a) =>
    a.metrics
      ? formatAgentSection(a.metrics, a.notes ?? [], a.externallyControlled, trainingRows.find((r) => r.agent_id === a.agent.id))
      : `<b>✨ ${esc(a.agent.name)}</b>\n💤 Sin datos${a.error ? `: ${esc(a.error)}` : " (dormido)"}`,
  );
  const footer = `━━━━━━━━━━\n🌟 <a href='https://dashboard-app-green-alpha.vercel.app'>Mirador de la Ciudad</a>\n⏰ ${new Date().toLocaleString("es-AR", { timeZone: TZ })}`;

  const combined = `${header}\n\n${sections.join("\n\n")}\n\n${footer}`;
  const messages = combined.length <= TELEGRAM_LIMIT
    ? [combined]
    : [header, ...sections.slice(0, -1), `${sections.at(-1)}\n\n${footer}`];
  return messages;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.MCITY_OBSERVER_URL || !process.env.MCITY_API_TOKEN || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({ error: "Missing env variables" });
  }

  try {
    const messages = await buildReport();
    for (const message of messages) await sendTelegramMessage(message.slice(0, 4096));
    res.status(200).json({ success: true, agents: AGENTS.map((a) => a.name), messages: messages.length });
  } catch (error) {
    console.error(error);
    try {
      await sendTelegramMessage(`⚠️ No pude generar el reporte: ${esc(error.message)}`);
    } catch {
      // ignore secondary failure
    }
    res.status(500).json({ error: error.message });
  }
}
