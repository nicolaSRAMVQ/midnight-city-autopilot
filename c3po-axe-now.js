const API_TOKEN = "midnight_6qUCzm9NVJfsVCzPLJtsVYR1NUrp261QiG581a-E";
const C3PO_ID = "user-agent-r5wd1einkurgide";

async function requestJson(path, init = {}) {
  const response = await fetch(`https://midnight.city/observer${path}`, {
    signal: AbortSignal.timeout(10_000),
    ...init,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} failed: HTTP ${response.status}`);
  return text ? JSON.parse(text) : null;
}

async function connect(agentId) {
  const response = await requestJson("/api/local-control/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, clientInstanceId: `axe:${agentId}`, modelId: null }),
  });
  return response;
}

async function postAction(token, agentId, action) {
  await requestJson("/api/actions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...action, agentId }),
  });
}

async function release(sessionId, token) {
  await requestJson("/api/local-control/session/release", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  }).catch(() => null);
}

(async () => {
  console.log("⚒️ C-3PO: Cinder Axe - AHORA\n");
  
  try {
    const lease = await connect(C3PO_ID);
    console.log(`✓ Sesión: ${lease.sessionId.slice(0, 8)}...\n`);
    
    console.log(`💳 Comprando de: Volcano Cinder Axe Woodwright`);
    console.log(`   16 crystal → 1 cinder_axe\n`);
    
    await postAction(lease.token, C3PO_ID, { 
      kind: "trade", 
      merchantName: "Volcano Cinder Axe Woodwright", 
      itemId: "crystal", 
      quantity: 16 
    });
    
    console.log(`⏳ Procesando transacción...`);
    await new Promise(r => setTimeout(r, 5000));
    
    const inv = await requestJson(`/api/skill/agents/${C3PO_ID}/inventory`);
    const axe = inv.inventory?.cinder_axe || 0;
    const cryst = inv.inventory?.crystal || 0;
    
    if (axe > 0) {
      console.log(`\n✅ ASEGURADO: ${axe}x Cinder Axe ⚒️`);
      console.log(`📊 C-3PO Inventory:`);
      console.log(`   • Cinder Axe: ${axe}x`);
      console.log(`   • Crystals: ${cryst}`);
      console.log(`\n🔒 La Ciudad usará automáticamente el Cinder Axe`);
    } else {
      console.log(`\n⏳ Transacción en proceso`);
      console.log(`   Cinder Axe: ${axe}x`);
      console.log(`   Crystals: ${cryst}`);
    }
    
    await release(lease.sessionId, lease.token);
  } catch (err) {
    console.error("❌", err.message);
  }
})();
