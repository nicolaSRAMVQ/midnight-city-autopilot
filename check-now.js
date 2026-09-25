#!/usr/bin/env node
import { AGENTS } from "./lib/agents.js";
import { readAgentEndpoint, requestJson } from "./lib/mcity-maintenance.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TZ = "America/Argentina/Buenos_Aires";
const fmtTime = (ms) => new Date(ms).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

async function checkAgent(agent) {
  try {
    const [context, needs, inventory, progression] = await Promise.all([
      readAgentEndpoint(agent.id, "context"),
      readAgentEndpoint(agent.id, "needs"),
      readAgentEndpoint(agent.id, "inventory"),
      readAgentEndpoint(agent.id, "progression"),
    ]);

    const current = context.agent || {};
    const hunger = needs.hunger?.value ?? 0;
    const items = inventory.inventory || {};
    const skills = Object.entries(progression.skills || {})
      .filter(([, s]) => s.xp > 0)
      .sort((a, b) => b[1].xp - a[1].xp)
      .slice(0, 1)
      .map(([name, s]) => `${name} L${s.level} (${s.xp}/${s.nextLevelXp})`)
      .join(", ");

    const load = inventory.load || {};
    const speed = load.workSpeedPercent ? `${load.workSpeedPercent}%` : "?";

    return {
      name: agent.name,
      level: current.level || "?",
      xp: `${Math.round((current.xp || 0) / 1000)}k`,
      hunger: hunger,
      crystals: items.crystal || 0,
      working: current.isPerformingJob ? "✓" : "✗",
      skills,
      speed,
      success: true,
    };
  } catch (error) {
    return {
      name: agent.name,
      error: error.message,
      success: false,
    };
  }
}

async function sendTelegram(text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
  });
}

async function main() {
  console.log("📊 Consultando API de Midnight City...\n");

  const results = await Promise.all(AGENTS.map(checkAgent));

  const table = results
    .map((r) => {
      if (!r.success) return `⚠️ ${r.name}: ${r.error}`;
      return `<b>${r.name}</b> | L${r.level} | Hambre: ${r.hunger}/100 | Crystals: ${r.crystals} | Working: ${r.working} | Speed: ${r.speed}`;
    })
    .join("\n");

  const now = new Date().toLocaleString("es-AR", { timeZone: TZ });
  const message = `🎯 <b>Dashboard en vivo:</b> https://claude.ai/artifact/Vo7adGNUuWPc2Kkh5L8NwU (público)

━━━━━━━━━━
<b>📊 Estado Actual (API consulta directa)</b>

${table}

⏰ ${now}`;

  console.log("\n" + message.replace(/<[^>]+>/g, "") + "\n");
  console.log("📤 Mandando a Telegram...");

  await sendTelegram(message);
  console.log("✅ Enviado a Telegram");
}

main().catch(console.error);
