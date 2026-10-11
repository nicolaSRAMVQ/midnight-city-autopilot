/**
 * Telegram bot webhook (v3.29): the report on demand, instead of on a timer.
 * /menu (or /start) shows three buttons; /resumen, /reporte and /estado do the
 * same without the menu. Reports are built read-only, so asking for one never
 * takes the control lease from the autopilot.
 *
 * Only the configured chat is answered. Telegram proves each call with the
 * secret_token set when the webhook was registered (setWebhook), derived from
 * the bot token so no extra env var is needed.
 *
 * GET registers this endpoint as the bot's webhook and the "/" command list.
 * It takes no input and always registers the same URL, so calling it again is
 * harmless; it exists because the bot token only lives in Vercel. (Its own
 * file would be function #13, over the Hobby plan's 12.)
 */

import { createHash } from "node:crypto";
import { MENU, buildReport, sendTelegramMessage } from "./r2-report.js";
import { rpc } from "../lib/supabase.js";
import { getDashboardData } from "../lib/dashboard.js";
import { DASH_VIEWS, agentCard } from "../lib/telegram-views.js";
import { PORTFOLIO_MENU, PORTFOLIO_VIEWS, getPortfolio } from "../lib/portfolio.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TZ = "America/Argentina/Buenos_Aires";

const WEBHOOK_URL = "https://r2-telegram-reporter.vercel.app/api/telegram";

const webhookSecret = () => createHash("sha256").update(`midnight-webhook:${TELEGRAM_BOT_TOKEN}`).digest("hex").slice(0, 48);

const COMMANDS = {
  "/resumen": "short", "/reporte": "full", "/estado": "status", "/menu": "menu", "/start": "menu",
  "/ranking": "rank", "/ritmo": "pace", "/economia": "eco", "/boxes": "boxes", "/prueba": "test", "/tablero": "menu", "/cartera": "pf", "/tokens": "pf:tokens",
};

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: Boolean(json.ok), description: json.description ?? null };
}

async function setup(res) {
  const webhook = await telegram("setWebhook", {
    url: WEBHOOK_URL,
    secret_token: webhookSecret(),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  const commands = await telegram("setMyCommands", {
    commands: [
      { command: "menu", description: "Todos los botones y el tablero" },
      { command: "ranking", description: "Puestos y variación 1/7/30 días" },
      { command: "ritmo", description: "XP por día y cuándo sube de nivel" },
      { command: "economia", description: "Crystals de cada droide" },
      { command: "boxes", description: "Cuánto trabajan, viajes y errores" },
      { command: "prueba", description: "Prueba de ventas contra la base" },
      { command: "cartera", description: "Cartera $cmate: valor y variación" },
      { command: "tokens", description: "Todos los tokens de $cmate" },
      { command: "resumen", description: "Resumen corto de la cuadrilla" },
      { command: "reporte", description: "Reporte completo" },
      { command: "estado", description: "¿El piloto anda bien?" },
    ],
  });
  res.status(200).json({ webhook, commands });
}

async function answerCallback(id) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text: "Armando…" }),
  }).catch(() => null);
}

const ago = (ts) => {
  const min = Math.round((Date.now() - Date.parse(ts)) / 60000);
  return min < 60 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`;
};

async function statusText() {
  const [lastOk, open] = await Promise.all([
    rpc("midnight_last_autopilot_ok").catch(() => null),
    rpc("midnight_open_alerts").catch(() => null),
  ]);
  const lines = ["🩺 <b>Estado del piloto</b>", lastOk ? `Última corrida buena: ${ago(lastOk)}` : "Última corrida buena: sin dato"];
  const failing = (open ?? []).filter((a) => a.failing_count > 0);
  if (open === null) lines.push("No pude leer los problemas abiertos.");
  else if (failing.length === 0) lines.push("✅ Sin problemas abiertos.");
  else for (const a of failing) lines.push(`⚠️ ${a.key.replace("autopilot:", "")}: falla hace ${a.failing_count} ciclo(s)`);
  lines.push(`⏰ ${new Date().toLocaleString("es-AR", { timeZone: TZ })}`);
  return lines.join("\n");
}

async function run(action) {
  if (action === "menu") return sendTelegramMessage("¿Qué querés ver?", MENU);
  if (action === "status") return sendTelegramMessage(await statusText(), MENU);
  if (PORTFOLIO_VIEWS[action]) {
    try {
      return sendTelegramMessage(PORTFOLIO_VIEWS[action](await getPortfolio()).slice(0, 4096), PORTFOLIO_MENU);
    } catch {
      return sendTelegramMessage("No pude leer la cartera ahora (Koios, Minswap o CoinGecko no respondieron). Probá en un rato.", PORTFOLIO_MENU);
    }
  }
  if (DASH_VIEWS[action] || action.startsWith("agent:")) {
    try {
      const data = await getDashboardData(30);
      if (data.history?.error) throw new Error(data.history.error);
      const text = action.startsWith("agent:") ? agentCard(data, action.slice(6)) : DASH_VIEWS[action](data);
      return sendTelegramMessage(text.slice(0, 4096), MENU);
    } catch {
      return sendTelegramMessage("No pude leer los datos ahora. Probá de nuevo en un rato.", MENU);
    }
  }
  try {
    const messages = await buildReport({ mode: action, readOnly: true });
    for (const [i, m] of messages.entries()) await sendTelegramMessage(m.slice(0, 4096), i === messages.length - 1 ? MENU : undefined);
  } catch {
    await sendTelegramMessage("No pude leer el juego ahora. Probá de nuevo en un rato.", MENU);
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") return TELEGRAM_BOT_TOKEN ? setup(res) : res.status(500).json({ error: "Missing env variables" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!TELEGRAM_BOT_TOKEN || req.headers["x-telegram-bot-api-secret-token"] !== webhookSecret()) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const update = req.body ?? {};
  const chatId = String(update.message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? "");
  if (chatId !== String(TELEGRAM_CHAT_ID)) return res.status(200).json({ ignored: true });

  let action = null;
  if (update.callback_query) {
    await answerCallback(update.callback_query.id);
    action = update.callback_query.data;
  } else {
    const word = (update.message?.text ?? "").trim().split(/[\s@]/)[0].toLowerCase();
    action = COMMANDS[word] ?? null;
  }
  if (typeof action === "string" && (["short", "full", "status", "menu"].includes(action) || DASH_VIEWS[action] || PORTFOLIO_VIEWS[action] || /^agent:(R2|BB-8|C-3PO)$/.test(action))) await run(action);
  // Always 200: anything else makes Telegram resend the same update.
  res.status(200).json({ ok: true });
}
