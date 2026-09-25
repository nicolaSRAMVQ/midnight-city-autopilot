const OBSERVER_URL = "https://midnight.city/observer";
const API_TOKEN = "midnight_6qUCzm9NVJfsVCzPLJtsVYR1NUrp261QiG581a-E";
const BB8_ID = "user-agent-326gbw4lg4sjiiv";

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
    body: JSON.stringify({ agentId, clientInstanceId: `force-mine:${agentId}`, modelId: null }),
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
  console.log("🔨 Forzando BB-8 a minar...\n");
  
  try {
    const lease = await connect(BB8_ID);
    console.log(`✓ Sesión conectada: ${lease.sessionId.slice(0, 8)}...\n`);
    
    // Stop any job first
    await postAction(lease, { kind: "stop_job" });
    await new Promise(r => setTimeout(r, 1000));
    console.log("⏸️ Pausó trabajos previos");
    
    // Force mining
    await postAction(lease, { kind: "perform_job" });
    console.log("⏳ Enviando comando: MINAR");
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Get status
    const context = await requestJson(`/api/skill/agents/${BB8_ID}/context`);
    const inventory = await requestJson(`/api/skill/agents/${BB8_ID}/inventory`);
    
    console.log(`\n📊 Estado post-mining:`);
    console.log(`   Location: ${context.currentSpace?.name || '?'}`);
    console.log(`   Working: ${context.agent?.isPerformingJob ? '✓ Sí' : '✗ No'}`);
    console.log(`   Work Speed: ${inventory.load?.workSpeedPercent ?? 100}%`);
    
    await release(lease);
    console.log("\n✓ Sesión liberada");
    console.log("🆗 BB-8 debería estar minando ahora (próxima verificación en 30s)");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
