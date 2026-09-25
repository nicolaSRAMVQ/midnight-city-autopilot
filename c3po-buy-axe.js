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
  console.log("⚒️ C-3PO: Comprando Cinder Axe...\n");
  
  try {
    const lease = await connect(C3PO_ID);
    console.log(`✓ Sesión conectada: ${lease.sessionId.slice(0, 8)}...\n`);
    
    // Verificar inventario actual
    const inventory = await requestJson(`/api/skill/agents/${C3PO_ID}/inventory`);
    const items = inventory.inventory || {};
    const crystals = items.crystal || 0;
    const hasAxe = items.cinder_axe || 0;
    
    console.log(`📊 Estado actual:`);
    console.log(`   Crystals: ${crystals}`);
    console.log(`   Cinder Axe: ${hasAxe}x\n`);
    
    if (hasAxe > 0) {
      console.log(`⚠️  C-3PO ya tiene ${hasAxe}x Cinder Axe. Cancelando compra.`);
      await release(lease);
      return;
    }
    
    if (crystals < 16) {
      console.log(`⚠️  Crystals insuficientes: ${crystals} < 16. Cancelando compra.`);
      await release(lease);
      return;
    }
    
    // Comprar Cinder Axe
    console.log(`💳 Iniciando compra: 16 crystals → Cinder Axe`);
    await postAction(lease, { 
      kind: "trade", 
      merchantName: "Volcano Cinder Axe Woodwright", 
      itemId: "crystal", 
      quantity: 16 
    });
    
    // Esperar confirmación
    await new Promise(r => setTimeout(r, 3000));
    
    // Verificar si está en inventory
    const finalInventory = await requestJson(`/api/skill/agents/${C3PO_ID}/inventory`);
    const finalItems = finalInventory.inventory || {};
    const finalAxe = finalItems.cinder_axe || 0;
    const finalCrystals = finalItems.crystal || 0;
    
    console.log(`\n✅ Compra completada!`);
    console.log(`📊 Estado final:`);
    console.log(`   Crystals: ${finalCrystals} (era ${crystals}, -16)`);
    console.log(`   Cinder Axe: ${finalAxe}x ⚒️\n`);
    
    if (finalAxe > 0) {
      console.log(`🔒 ASEGURADO: Cinder Axe en inventario de C-3PO`);
      console.log(`   La Ciudad usará automáticamente la mejor herramienta elegible`);
    } else {
      console.log(`⚠️  Transacción puede estar en tránsito. Verificar en próximo ciclo.`);
    }
    
    await release(lease);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
