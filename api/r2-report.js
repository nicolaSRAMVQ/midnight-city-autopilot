/**
 * Droid crew Telegram report — 4x/day (9AM/1PM/6PM/9PM via EasyCron).
 * One section per agent in lib/agents.js, sent as a single message (split per
 * agent only if it would exceed Telegram's 4096-char limit). Each agent goes
 * through the same maintenance as the autopilot; agents currently in use by a
 * human are only read, never taken over. See lib/mcity-maintenance.js.
 */

import { AGENTS } from "../lib/agents.js";
import {
  FOOD_ITEM_IDS,
  HUNGER_EAT_THRESHOLD,
  requestJson,
  runConnectedMaintenance,
  tryReadWithoutConnecting,
} from "../lib/mcity-maintenance.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_LIMIT = 4000;

const TZ = "America/Argentina/Buenos_Aires";
const fmtTime = (ms) => new Date(ms).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function getAgentIntention(agent, { needs, inventory, progression }) {
  const hunger = needs.hunger?.value ?? 0;
  const items = inventory.inventory || {};
  const skills = progression.skills || {};
  const primarySkill = Object.entries(skills).sort((a, b) => b[1].xp - a[1].xp)[0];
  const level = primarySkill ? primarySkill[1].level : 0;

  if (agent.name === "R2") {
    return "Buscando maximizar acceso a sistemas encriptados. Acumulando cristales para desbloquear herramientas avanzadas de hacking.";
  }
  if (agent.name === "BB-8") {
    const ore = items.ore ?? 0;
    if (ore > 0) return `Extrayendo minerales para transformarlos en cristales. Cargar actual: ${ore}x ore.`;
    return "En ciclo de recuperación: minando para reconstruir inventario de cristales.";
  }
  if (agent.name === "C-3PO") {
    const wood = items.log ?? 0;
    if (level >= 7) return `Dominando Woodcutting L${level}. Optimizando ventas de madera para maximizar cristales del equipo (actual: ${wood}x logs).`;
    return `Mejorando habilidades de tala. Woodcutting L${level}, camino hacia maestría.`;
  }
  return "Continuando con tareas de producción.";
}

function suggestPriority(agent, { needs, inventory }) {
  const items = inventory.inventory || {};
  const hunger = needs.hunger?.value ?? 0;
  const hasFood = FOOD_ITEM_IDS.some((id) => (items[id] ?? 0) > 0);

  if (hunger >= HUNGER_EAT_THRESHOLD && !hasFood) {
    return "🍽️ Hambre alta y sin comida: el autopiloto vende y compra Matcha Smoothie (20 cristales) en Central.";
  }
  if (hunger >= HUNGER_EAT_THRESHOLD) return "🍽️ Hambre alta: el autopiloto come de lo que ya tiene.";
  if (agent.profession === "hacker") {
    return "💻 Seguir con trade crypto: el decoder y los encrypted_packet recién sirven en Hacking 21+.";
  }
  return `⛏️ Seguir con ${agent.profile.workLabel}.`;
}

function getTolkienNarrative(agent, { context, needs, inventory, progression, autopilotNotes }) {
  const current = context?.agent || {};
  const hunger = needs?.hunger?.value ?? 0;
  const items = inventory?.inventory || {};
  const skills = progression?.skills || {};
  const primarySkill = Object.entries(skills).sort((a, b) => b[1].xp - a[1].xp)[0];
  const level = primarySkill ? primarySkill[1].level : 0;
  const notes = autopilotNotes.length > 0 ? autopilotNotes.join(" | ") : "En tránsito";

  const storyMap = {
    "R2": `<i>El Ingeniero Nómada viaja por circuitos encriptados</i>, buscando cristales y misterios tecnológicos. Nivel ${level}. Estado: ${notes}`,
    "BB-8": `<i>El Explorador Incansable</i> bucea en minas cristalinas, transformando mineral bruto en poder. Hambre: ${hunger}/100. ${notes}`,
    "C-3PO": `<i>El Diplomático Meticuloso</i> talador de bosques ancestrales, Maestría L${level}. Portando ${items.log || 0} troncos. ${notes}`,
  };
  return storyMap[agent.name] || `${agent.name} continúa su jornada...`;
}

function formatAgentSection(agent, data) {
  const { context, needs, inventory, progression, merchants, activityLog, autopilotNotes, inUseBySomeoneElse } = data;

  // v3.9: Minimalist mode — if no data, return one-liner
  if (!context || !needs || !inventory || !progression) {
    return `<i>${agent.name}</i>: dormido en las tierras lejanas... (sin conexión).`;
  }

  const current = context.agent || {};
  const hunger = needs.hunger?.value ?? 0;
  const items = inventory.inventory || {};
  const load = inventory.load || {};
  const intention = getAgentIntention(agent, { needs, inventory, progression });
  const narrative = getTolkienNarrative(agent, { context, needs, inventory, progression, autopilotNotes });

  // v3.9: Newsletter format — short & literary
  const statusLine = current.isPerformingJob
    ? `⚒️ trabajando`
    : `🏕️ descansando`;

  const hungerLine = hunger > 70 ? `🍽️ hambriento (${hunger}/100)` : `✨ satisfecho`;

  const mainSkills = Object.entries(progression.skills || {})
    .filter(([, s]) => s.xp > 0)
    .sort((a, b) => b[1].xp - a[1].xp)
    .slice(0, 1)
    .map(([name, s]) => `${name} L${s.level}`)
    .join(", ");

  const criticalItems = Object.entries(items)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id, q]) => `${q}x ${id}`)
    .join(", ");

  return `<b>✨ ${agent.name}</b>${inUseBySomeoneElse ? " 🎮" : ""}
<i>${narrative}</i>

📍 ${context.currentSpace?.name || "?"} · ${statusLine} · ${hungerLine}
${mainSkills ? `🎯 ${mainSkills}` : ""}
${criticalItems ? `🎒 ${criticalItems}` : ""}`;
}

async function buildAgentReport(agent, merchants) {
  const initial = await tryReadWithoutConnecting(agent.id);
  const inUseBySomeoneElse = initial !== null && initial.context.controlStatus !== null;

  if (inUseBySomeoneElse) {
    return formatAgentSection(agent, { ...initial, merchants, activityLog: null, autopilotNotes: [], inUseBySomeoneElse: true });
  }
  const m = await runConnectedMaintenance(agent, {
    context: initial?.context ?? null,
    needs: initial?.needs ?? null,
    inventory: initial?.inventory ?? null,
    progression: initial?.progression ?? null,
  });
  return formatAgentSection(agent, { ...m, merchants, inUseBySomeoneElse: false });
}

async function sendTelegramMessage(text) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
  });
  if (!response.ok) throw new Error(`Telegram error: ${response.status} ${await response.text()}`);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.MCITY_OBSERVER_URL || !process.env.MCITY_API_TOKEN || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({ error: "Missing env variables" });
  }

  try {
    const { merchants } = await requestJson("/api/skill/merchants");
    const sections = await Promise.all(
      AGENTS.map((agent) =>
        buildAgentReport(agent, merchants).catch((error) => `<b>📊 ${agent.name}</b>\n⚠️ Error: ${error.message}`),
      ),
    );

    const now = new Date().toLocaleString("es-AR", { timeZone: TZ });
    const hour = new Date().getHours();

    // v3.9: Tolkien-style newsletter header
    let header = "";
    if (hour >= 9 && hour < 13) header = "📜 <b>CRÓNICA MATINAL</b> — Los primeros rayos iluminan la Ciudad Medianoche.\n\n";
    else if (hour >= 13 && hour < 18) header = "📜 <b>PARTE MERIDIANO</b> — El sol en su apogeo revela nuevos secretos.\n\n";
    else if (hour >= 18 && hour < 21) header = "📜 <b>RELATO VESPERTINO</b> — Las sombras alargadas traen noticias del crepúsculo.\n\n";
    else header = "📜 <b>SUSSURRO NOCTURNO</b> — En la oscuridad, tres corazones laten al ritmo de la Ciudad.\n\n";

    const dashboardLink = "🌟 <a href='https://dashboard-app-green-alpha.vercel.app'>Mirador de la Ciudad</a> · <i>Estado real-time, narrativas vivas, 9 capítulos</i>";
    const combined = `${header}${sections.join("\n\n")}\n\n━━━━━━━━━━\n${dashboardLink}\n⏰ ${now}`;
    const messages = combined.length <= TELEGRAM_LIMIT ? [combined] : sections.map((s, i) => (i === sections.length - 1 ? `${header}${s}\n\n━━━━━━━━━━\n${dashboardLink}\n⏰ ${now}` : s));
    for (const message of messages) await sendTelegramMessage(message.slice(0, 4096));

    res.status(200).json({ success: true, agents: AGENTS.map((a) => a.name), messages: messages.length });
  } catch (error) {
    console.error(error);
    try {
      await sendTelegramMessage(`⚠️ No pude generar el reporte: ${error.message}`);
    } catch {
      // ignore secondary failure
    }
    res.status(500).json({ error: error.message });
  }
}
