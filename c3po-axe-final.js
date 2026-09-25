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
    body: JSON.stringify({ agentId, clientInstanceId: `axe:${agentId}`, modelId: null }),
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
  console.log("⚒️ C-3PO: Cinder Axe acquisition\n");
  
  try {
    const lease = await connect(C3PO_ID);
    console.log(`✓ Sesión activa\n`);
    
    // Navegar a Volcano
    console.log(`🗺️ travel_to_district: volcano`);
    await postAction(lease, { kind: "travel_to_district", districtId: "volcano" });
    await new Promise(r => setTimeout(r, 6000));
    
    const context = await requestJson(`/api/skill/agents/${C3PO_ID}/context`);
    console.log(`✓ Ubicación: ${context.currentSpace?.name}\n`);
    
    // Comprar
    const inv = await requestJson(`/api/skill/agents/${C3PO_ID}/inventory`);
    const crystals = inv.inventory?.crystal || 0;
    console.log(`💳 trade: 16 crystals → Cinder Axe (tengo ${crystals})`);
    
    await postAction(lease, { 
      kind: "trade", 
      merchantName: "Volcano Cinder Axe Woodwright", 
      itemId: "crystal", 
      quantity: 16 
    });
    
    await new Promise(r => setTimeout(r, 4000));
    
    const final = await requestJson(`/api/skill/agents/${C3PO_ID}/inventory`);
    const axe = final.inventory?.cinder_axe || 0;
    const crystalsFinal = final.inventory?.crystal || 0;
    
    console.log(`\n${ axe > 0 ? '✅ ASEGURADO' : '⏳ PENDIENTE'}: Cinder Axe`);
    console.log(`   Cinder Axe: ${axe}x ⚒️`);
    console.log(`   Crystals: ${crystalsFinal}\n`);
    
    if (axe > 0) {
      console.log(`🔒 La Ciudad usará automáticamente el Cinder Axe como herramienta elegible`);
    }
    
    await release(lease);
  } catch (err) {
    console.error("❌", err.message);
  }
})();
