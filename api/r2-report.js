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

function formatAgentSection(agent, data) {
  const { context, needs, inventory, progression, merchants, activityLog, autopilotNotes, inUseBySomeoneElse } = data;
  if (!context || !needs || !inventory || !progression) {
    return `<b>📊 ${agent.name}</b>\n⚠️ Sin datos: ${autopilotNotes.join("; ") || "no se pudo leer el estado"}`;
  }
  const current = context.agent || {};
  const vitals = progression.vitals || { health: 0, maxHealth: 100 };
  const hunger = needs.hunger || { value: 0, state: "unknown" };
  const items = inventory.inventory || {};
  const spaceId = current.position?.spaceId;

  const inventoryText = Object.keys(items).length > 0
    ? Object.entries(items).map(([id, q]) => `• ${id} (x${q})`).join("\n")
    : "Sin ítems";

  const skillText = Object.entries(progression.skills || {})
    .filter(([, s]) => s.xp > 0)
    .sort((a, b) => b[1].xp - a[1].xp)
    .slice(0, 3)
    .map(([name, s]) => `• ${name}: nivel ${s.level} (${s.xp}/${s.nextLevelXp} XP)`)
    .join("\n") || "Sin XP todavía";

  const nearby = (merchants || []).filter((m) => m.position?.spaceId === spaceId);
  const merchantsText = nearby.length > 0 ? nearby.map((m) => `• ${m.name}: ${m.offer.summary}`).join("\n") : "Ninguno acá";

  const activityText = activityLog === null
    ? "No disponible (en uso ahora mismo)"
    : activityLog.length > 0 ? activityLog.join("\n") : "Sin eventos recientes";

  const load = inventory.load || {};
  const loadText = load.state && load.state !== "normal"
    ? `\n<b>⚖️ Carga:</b> ${load.state} (velocidad ${load.workSpeedPercent}%)`
    : "";
  const notes = autopilotNotes.length > 0 ? `\n<b>🤖 Autopiloto:</b>\n${autopilotNotes.join("\n")}\n` : "";
  const nextTick = needs.hunger?.nextPointAtMs ? ` — próximo punto ~${fmtTime(needs.hunger.nextPointAtMs)}` : "";

  return `<b>📊 ${agent.name} (${agent.profession})</b>${inUseBySomeoneElse ? " 🎮 <i>(en uso ahora)</i>" : ""}
<b>📍</b> ${context.currentSpace?.name || spaceId || "?"} · <b>⚙️ Trabajando:</b> ${current.isPerformingJob ? `Sí (${agent.profile.workLabel})` : "No"}
<b>❤️</b> ${vitals.health}/${vitals.maxHealth} · <b>🍽️</b> ${hunger.value}/100 (${hunger.state})${nextTick}

<b>📋 Actividad:</b>
${activityText}
${notes}
<b>📈 Skills:</b>
${skillText}

<b>🎒 Inventario:</b>
${inventoryText}${loadText}

<b>🏪 Mercaderes acá:</b>
${merchantsText}

<b>🎯</b> ${suggestPriority(agent, { needs, inventory })}`;
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
    const combined = `${sections.join("\n\n━━━━━━━━━━\n\n")}\n\n⏰ ${now}`;
    const messages = combined.length <= TELEGRAM_LIMIT ? [combined] : sections.map((s, i) => (i === sections.length - 1 ? `${s}\n\n⏰ ${now}` : s));
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
