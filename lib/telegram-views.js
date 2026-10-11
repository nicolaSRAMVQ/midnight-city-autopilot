// Texts for the Telegram buttons added in v3.31 (Ranking, Ritmo, Economía, Boxes,
// Prueba de ventas, one card per droid). All of them read getDashboardData():
// live state from the game plus the daily history kept in Supabase.
import { DASHBOARD_URL } from "./dashboard.js";

const TZ = "America/Argentina/Buenos_Aires";
const ORDER = ["R2", "BB-8", "C-3PO"];
const TEST_START = Date.parse("2026-10-11T04:44:00Z");
const BASE_WORK = { "R2": 76.3, "BB-8": 62.4, "C-3PO": 63.4 };

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const nf = (n, d = 0) => (n == null || Number.isNaN(n) ? "–" : Number(n).toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d }));
const short = (n) => (n == null ? "–" : Math.abs(n) >= 1e6 ? `${nf(n / 1e6, 2)} M` : Math.abs(n) >= 1e4 ? `${nf(n / 1e3, 1)} k` : nf(n));
const stamp = () => `⏰ ${new Date().toLocaleString("es-AR", { timeZone: TZ, day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`;

const days = (d, agent) => (d.history?.days ?? []).filter((x) => x.agent === agent);
const live = (d) => ORDER.map((n) => d.live.find((a) => a.name === n)).filter(Boolean);

function rankAt(d, agent, msAgo) {
  const mine = (d.history?.ranks ?? []).filter((r) => r.agent === agent);
  if (!mine.length) return null;
  const target = Date.now() - msAgo;
  let best = null;
  for (const r of mine) if (Date.parse(r.at) <= target) best = r;
  if (best) return { ...best, exact: true };
  return Date.now() - Date.parse(mine[0].at) > 3 * 36e5 ? { ...mine[0], exact: false } : null;
}

function delta(now, past, label) {
  if (!now || !past) return `${label} –`;
  const diff = past.rank - now;
  const pct = nf((Math.abs(diff) / past.rank) * 100, 1);
  const lab = past.exact ? label : `${Math.max(1, Math.round((Date.now() - Date.parse(past.at)) / 864e5))}d*`;
  return diff === 0 ? `${lab} =` : `${lab} ${diff > 0 ? "▲" : "▼"}${Math.abs(diff)} (${pct} %)`;
}

// Average over the last full days (today is still running).
function pace(d, agent) {
  const full = days(d, agent).slice(0, -1).slice(-3);
  if (full.length < 2) return { xpDay: null, crDay: null };
  const n = full.length - 1;
  return { xpDay: (full.at(-1).xp - full[0].xp) / n, crDay: (full.at(-1).crystal - full[0].crystal) / n };
}

const etaText = (days) => (days == null ? "–" : days < 1 ? `~${nf(days * 24)} h` : `~${nf(days, 1)} días`);

function rankLines(d, a) {
  const b = a.board ?? {};
  const { xpDay } = pace(d, a.name);
  const lines = [`🏁 <b>${esc(a.name)}</b> #${b.rank ?? "–"}`, `   ${[delta(b.rank, rankAt(d, a.name, 864e5), "1d"), delta(b.rank, rankAt(d, a.name, 7 * 864e5), "7d"), delta(b.rank, rankAt(d, a.name, 30 * 864e5), "30d")].join(" · ")}`];
  if (b.ahead && b.xp != null) {
    const gap = b.ahead.xp - b.xp;
    lines.push(`   ⬆️ #${b.ahead.rank} ${esc(b.ahead.name)} a ${short(gap)} xp${xpDay > 0 ? ` (lo pasa en ${etaText(gap / xpDay)})` : ""}`);
  }
  if (b.behind && b.xp != null) lines.push(`   ⬇️ #${b.behind.rank} ${esc(b.behind.name)} ${short(b.xp - b.behind.xp)} xp atrás`);
  return lines.join("\n");
}

function paceLines(d, a) {
  const { xpDay } = pace(d, a.name);
  const toLevel = a.nextLevelXp != null ? a.nextLevelXp - a.xp : null;
  return `📈 <b>${esc(a.name)}</b> ${esc(a.skill)} → L${(a.level ?? 0) + 1}\n   ${short(xpDay)} xp/día · ${short(xpDay == null ? null : xpDay / 24)} xp/h\n   faltan ${short(toLevel)} xp · llega en ${etaText(xpDay > 0 && toLevel > 0 ? toLevel / xpDay : null)}`;
}

function ecoLines(d, a) {
  const mine = days(d, a.name);
  const { crDay } = pace(d, a.name);
  const today = mine.at(-1), yest = mine.at(-2);
  const todaySoFar = today && yest ? a.crystals - yest.crystal : null;
  return `💎 <b>${esc(a.name)}</b> ${nf(a.crystals)}\n   promedio ${crDay == null ? "–" : `${crDay >= 0 ? "+" : ""}${nf(crDay)}`}/día · hoy ${todaySoFar == null ? "–" : `${todaySoFar >= 0 ? "+" : ""}${nf(todaySoFar)}`}`;
}

function boxesLines(d, a) {
  const mine = days(d, a.name);
  const row = (x, label) => (x ? `${label} ${nf(x.working_pct)} % trabajando · 🛒${x.sell_overload + x.sell_liquidity}${x.errors ? ` · ⚠️${x.errors}` : ""}` : `${label} –`);
  return `🔧 <b>${esc(a.name)}</b> ${a.working ? "⚒️" : "🏕️"} carga ${nf(a.speed)} %\n   ${row(mine.at(-1), "hoy")}\n   ${row(mine.at(-2), "ayer")}`;
}

function testLines(d) {
  const elapsed = Math.max(0, (Date.now() - TEST_START) / 864e5);
  const out = [`🧪 <b>Prueba de ventas</b> · día ${nf(elapsed, 1)} de 7`, "Solo vende por liquidez con menos de 1.000 crystals.", ""];
  for (const name of ORDER) {
    const mine = days(d, name);
    const after = mine.filter((x) => Date.parse(`${x.date}T23:59:59-03:00`) > TEST_START);
    const before = mine.filter((x) => x.date >= "2026-10-08" && x.date <= "2026-10-10");
    const samples = after.reduce((s, x) => s + x.samples, 0);
    const wNow = samples ? after.reduce((s, x) => s + x.working_pct * x.samples, 0) / samples : null;
    const trips = (arr) => { const t = arr.reduce((s, x) => s + x.samples, 0); return t ? (arr.reduce((s, x) => s + x.sell_overload + x.sell_liquidity, 0) * 144) / t : null; };
    const diff = wNow == null ? null : wNow - BASE_WORK[name];
    out.push(`<b>${name}</b> trabajando ${nf(BASE_WORK[name], 1)} % → ${wNow == null ? "–" : `${nf(wNow, 1)} %`}${diff == null ? "" : ` (${diff >= 0 ? "▲" : "▼"}${nf(Math.abs(diff), 1)})`}\n   viajes a vender/día ${nf(trips(before))} → ${nf(trips(after))}`);
  }
  out.push("", "<i>Se lee en serio desde el tercer día. Informe final el sábado 18/10.</i>");
  return out.join("\n");
}

export const DASH_VIEWS = {
  rank: (d) => [`🏁 <b>Ranking de experiencia</b>`, ...live(d).map((a) => rankLines(d, a)), "", "<i>* historial más corto que el período: el registro de puestos arrancó el 11/10.</i>", stamp()].join("\n"),
  pace: (d) => [`📈 <b>Ritmo de carrera</b>`, ...live(d).map((a) => paceLines(d, a)), "", "<i>Promedio de los últimos días completos.</i>", stamp()].join("\n"),
  eco: (d) => [`💎 <b>Economía</b> · cuadrilla ${nf(live(d).reduce((s, a) => s + (a.crystals ?? 0), 0))}`, ...live(d).map((a) => ecoLines(d, a)), stamp()].join("\n"),
  boxes: (d) => [`🔧 <b>Boxes</b>`, ...live(d).map((a) => boxesLines(d, a)), "", "<i>🛒 viajes a vender · ⚠️ ciclos con error</i>", stamp()].join("\n"),
  test: (d) => [testLines(d), stamp()].join("\n"),
};

export function agentCard(d, name) {
  const a = live(d).find((x) => x.name === name);
  if (!a) return `No encontré a ${esc(name)}.`;
  if (a.error) return `🤖 <b>${esc(name)}</b>\n⚠️ No pude leerlo ahora.`;
  return [`🤖 <b>${esc(a.name)}</b> · ${a.working ? "⚒️ trabajando" : "🏕️ parado"} en ${esc(a.location)}`, `🥤 hambre ${nf(a.hunger)}`, "", rankLines(d, a), paceLines(d, a), ecoLines(d, a), boxesLines(d, a), "", stamp()].join("\n");
}

export const MEGA_MENU = {
  inline_keyboard: [
    [{ text: "⚡ Resumen", callback_data: "short" }, { text: "📜 Completo", callback_data: "full" }],
    [{ text: "🏁 Ranking", callback_data: "rank" }, { text: "📈 Ritmo", callback_data: "pace" }],
    [{ text: "💎 Economía", callback_data: "eco" }, { text: "🔧 Boxes", callback_data: "boxes" }],
    [{ text: "🧪 Prueba de ventas", callback_data: "test" }, { text: "🩺 Piloto", callback_data: "status" }],
    [{ text: "🤖 R2", callback_data: "agent:R2" }, { text: "🤖 BB-8", callback_data: "agent:BB-8" }, { text: "🤖 C-3PO", callback_data: "agent:C-3PO" }],
    [{ text: "🌐 Abrir el tablero", url: DASHBOARD_URL }],
  ],
};
