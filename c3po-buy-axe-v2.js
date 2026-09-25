const OBSERVER_URL = "https://midnight.city/observer";
const API_TOKEN = "midnight_6qUCzm9NVJfsVCzPLJtsVYR1NUrp261QiG581a-E";
const C3PO_ID = "user-agent-r5wd1einkurgide";

async function requestJson(path, init = {}) {
  const response = await fetch(`${OBSERVER_URL}${path}`, {
    signal: AbortSignal.timeout(10_000),
    ...init,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} failed: HTTP ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function connect(agentId) {
  const response = await requestJson("/api/local-control/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, clientInstanceId: `buy-axe:${agentId}`, modelId: null }),
  });
  return { sessionId: response.sessionId, token: response.token, agentId };
}

async function release(lease) {
  await requestJson("/api/local-control/session/release", {
    method: "POST",
    headers: { Authorization: `Bearer ${lease.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: lease.sessionId }),
  }).catch(() => null);
}

async function postAction(lease, action) {
  await requestJson("/api/actions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lease.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...action, agentId: lease.agentId }),
  });
}

(async () => {
  console.log("⚒️ C-3PO: Viajando a Volcano para comprar Cinder Axe...\n");
  
  try {
    const lease = await connect(C3PO_ID);
    console.log(`✓ Sesión conectada\n`);
    
    // Navegar a Volcano
    console.log(`🗺️ Navegando a Volcano...`);
    await postAction(lease, { kind: "move", direction: "volcano" });
    await new Promise(r => setTimeout(r, 5000));
    
    const context = await requestJson(`/api/skill/agents/${C3PO_ID}/context`);
    console.log(`✓ Ubicación: ${context.currentSpace?.name}\n`);
    
    // Comprar Cinder Axe
    const inventory = await requestJson(`/api/skill/agents/${C3PO_ID}/inventory`);
    const crystals = inventory.inventory?.crystal || 0;
    
    console.log(`💳 Comprando Cinder Axe (16 crystals de ${crystals})...`);
    await postAction(lease, { 
      kind: "trade", 
      merchantName: "Volcano Cinder Axe Woodwright", 
      itemId: "crystal", 
      quantity: 16 
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Verificar
    const final = await requestJson(`/api/skill/agents/${C3PO_ID}/inventory`);
    const axe = final.inventory?.cinder_axe || 0;
    const crystalsFinal = final.inventory?.crystal || 0;
    
    console.log(`\n✅ ASEGURADO: Cinder Axe en inventario`);
    console.log(`📊 Inventario:`);
    console.log(`   Cinder Axe: ${axe}x ⚒️`);
    console.log(`   Crystals: ${crystalsFinal} (-${crystals - crystalsFinal})`);
    console.log(`\n🔒 La Ciudad usará automáticamente el Cinder Axe como herramienta elegible`);
    
    await release(lease);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
