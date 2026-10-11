// Cartera de la billetera $cmate para el bot de Telegram (v3.32). Todo es lectura
// pública, sin llaves: handle.me resuelve el handle, Koios da saldo y tokens,
// Minswap cotiza los tokens de Cardano y CoinGecko da ADA y NIGHT con su variación.
const HANDLE = "cmate";
const TZ = "America/Argentina/Buenos_Aires";
const GECKO = { ADA: "cardano", NIGHT: "midnight-3" };
const NIGHT_ID = "0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa4e49474854";

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const nf = (n, d = 0) => (n == null || Number.isNaN(n) ? "–" : Number(n).toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d }));
// Tiny token prices keep two significant digits (HOSKY is ~US$ 0,0000000056).
const usd = (n) => {
  if (n == null) return "–";
  if (n !== 0 && Math.abs(n) < 0.01) return `US$ ${Number(n.toPrecision(2)).toLocaleString("es-AR", { maximumSignificantDigits: 2 })}`;
  return `US$ ${nf(n, n < 1 ? 4 : n < 100 ? 2 : 0)}`;
};
const pct = (n) => (n == null ? "–" : `${n >= 0 ? "▲" : "▼"}${nf(Math.abs(n), 1)} %`);
const stamp = () => `⏰ ${new Date().toLocaleString("es-AR", { timeZone: TZ, day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`;

async function getJson(url, init) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}
const koios = (path, body) =>
  getJson(`https://api.koios.rest/api/v1/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function getPortfolio() {
  const handle = await getJson(`https://api.handle.me/handles/${HANDLE}`);
  const stake = handle.holder;
  const [[account], assets, market] = await Promise.all([
    koios("account_info", { _stake_addresses: [stake] }),
    koios("account_assets", { _stake_addresses: [stake] }),
    getJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${Object.values(GECKO).join(",")}&price_change_percentage=24h,7d,1y`),
  ]);
  const fungible = assets.filter((a) => BigInt(a.quantity) > 1n);
  const nfts = assets.length - fungible.length;
  const prices = fungible.length
    ? (await getJson("https://agg-api.minswap.org/aggregator/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "", only_verified: false, assets: fungible.map((a) => a.policy_id + a.asset_name) }),
      }).catch(() => ({ tokens: [] }))).tokens ?? []
    : [];
  const byId = Object.fromEntries(prices.map((p) => [p.token_id, p]));
  const coin = (sym) => {
    const m = market.find((x) => x.id === GECKO[sym]);
    return m && { price: m.current_price, d1: m.price_change_percentage_24h_in_currency, d7: m.price_change_percentage_7d_in_currency, y1: m.price_change_percentage_1y_in_currency };
  };
  const ada = coin("ADA"), night = coin("NIGHT");
  const adaQty = Number(account.total_balance) / 1e6;

  const tokens = fungible
    .map((a) => {
      const id = a.policy_id + a.asset_name;
      const p = byId[id];
      const decimals = p?.decimals ?? a.decimals ?? 0;
      const qty = Number(a.quantity) / 10 ** decimals;
      const priceUsd = id === NIGHT_ID ? night?.price : p?.price_by_usd;
      const name = p?.ticker || Buffer.from(a.asset_name || "", "hex").toString("utf8").replace(/[^\x20-\x7e]/g, "") || a.policy_id.slice(0, 8);
      return { id, name, qty, priceUsd: priceUsd ?? null, valueUsd: priceUsd != null ? qty * priceUsd : null };
    })
    .sort((x, y) => (y.valueUsd ?? -1) - (x.valueUsd ?? -1));

  const adaValue = ada ? adaQty * ada.price : null;
  const nightTok = tokens.find((t) => t.id === NIGHT_ID);
  const others = tokens.filter((t) => t.id !== NIGHT_ID);
  const total = (adaValue ?? 0) + tokens.reduce((s, t) => s + (t.valueUsd ?? 0), 0);

  // Variación de la cartera: la de ADA y NIGHT ponderada por su peso. El resto de
  // los tokens no tiene historial gratuito, así que se dice qué parte cubre.
  const tracked = [[adaValue, ada], [nightTok?.valueUsd, night]].filter(([v, c]) => v && c);
  const trackedValue = tracked.reduce((s, [v]) => s + v, 0);
  const change = (k) => {
    const parts = tracked.filter(([, c]) => c[k] != null);
    if (!parts.length) return null;
    const w = parts.reduce((s, [v]) => s + v, 0);
    return { value: parts.reduce((s, [v, c]) => s + v * c[k], 0) / w, partial: parts.length < tracked.length };
  };

  return {
    handle: HANDLE, stake, adaQty, ada, night, nightTok, others, nfts, total,
    totalAda: ada ? total / ada.price : null,
    coverage: total ? trackedValue / total : 0,
    change: { d1: change("d1"), d7: change("d7"), y1: change("y1") },
    unpriced: others.filter((t) => t.valueUsd == null).length,
  };
}

const coinLine = (icon, label, qty, c, value, total) =>
  `${icon} <b>${label}</b> ${nf(qty)} · ${usd(c?.price)}\n   24 h ${pct(c?.d1)} · 7 d ${pct(c?.d7)} · 1 año ${c?.y1 == null ? "– (menos de 1 año)" : pct(c.y1)}\n   = <b>${usd(value)}</b>${total ? ` (${nf((value / total) * 100)} %)` : ""}`;

export function portfolioSummary(p) {
  const top = p.others.filter((t) => t.valueUsd).slice(0, 5);
  const othersValue = p.others.reduce((s, t) => s + (t.valueUsd ?? 0), 0);
  return [
    `💼 <b>Cartera $${esc(p.handle)}</b>`,
    `💵 <b>${usd(p.total)}</b> · ₳ ${nf(p.totalAda)}`,
    `📊 24 h ${pct(p.change.d1?.value)} · 7 d ${pct(p.change.d7?.value)} · 1 año ${pct(p.change.y1?.value)}${p.change.y1?.partial ? "*" : ""}`,
    `<i>(variación de ADA y NIGHT, que son el ${nf(p.coverage * 100)} % de la cartera${p.change.y1?.partial ? "; *1 año solo ADA, NIGHT tiene menos de un año" : ""})</i>`,
    "",
    coinLine("₳", "ADA", p.adaQty, p.ada, p.ada ? p.adaQty * p.ada.price : null, p.total),
    p.nightTok ? coinLine("🌙", "NIGHT", p.nightTok.qty, p.night, p.nightTok.valueUsd, p.total) : "",
    "",
    `🪙 <b>Otros tokens</b> (${p.others.length}): ${usd(othersValue)}`,
    ...top.map((t) => `   ${esc(t.name)} ${nf(t.qty)} = ${usd(t.valueUsd)}`),
    `🖼️ NFTs: ${nf(p.nfts)} (sin valuar)`,
    "",
    stamp(),
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

export function portfolioTokens(p) {
  const priced = p.others.filter((t) => t.valueUsd);
  return [
    `🪙 <b>Tokens de $${esc(p.handle)}</b> (${priced.length} con precio)`,
    ...priced.slice(0, 40).map((t, i) => `${i + 1}. ${esc(t.name)} · ${nf(t.qty)} · ${usd(t.priceUsd)} = <b>${usd(t.valueUsd)}</b>`),
    p.unpriced ? `\n<i>${p.unpriced} sin precio en Minswap (sin liquidez o fuera de lista).</i>` : "",
    stamp(),
  ].filter(Boolean).join("\n");
}

export function marketView(p) {
  return [
    "📈 <b>Mercado</b>",
    coinLine("₳", "ADA", p.adaQty, p.ada, p.ada ? p.adaQty * p.ada.price : null, null),
    p.nightTok ? coinLine("🌙", "NIGHT", p.nightTok.qty, p.night, p.nightTok.valueUsd, null) : "",
    p.ada && p.night ? `\n1 NIGHT = ₳ ${nf(p.night.price / p.ada.price, 4)}` : "",
    "<i>Precios de CoinGecko.</i>",
    stamp(),
  ].filter(Boolean).join("\n");
}

export const PORTFOLIO_MENU = {
  inline_keyboard: [
    [{ text: "🔄 Actualizar", callback_data: "pf" }, { text: "🪙 Todos los tokens", callback_data: "pf:tokens" }],
    [{ text: "📈 ADA y NIGHT", callback_data: "pf:market" }, { text: "⬅️ Menú Midnight", callback_data: "menu" }],
  ],
};

export const PORTFOLIO_VIEWS = { pf: portfolioSummary, "pf:tokens": portfolioTokens, "pf:market": marketView };
