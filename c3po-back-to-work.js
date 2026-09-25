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
    body: JSON.stringify({ agentId, clientInstanceId: `work:${agentId}`, modelId: null }),
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
  console.log("🌳 C-3PO: Volviendo al trabajo (micelio crecimiento)\n");
  
  try {
    const lease = await connect(C3PO_ID);
    console.log(`✓ Sesión activa\n`);
    
    const context = await requestJson(`/api/skill/agents/${C3PO_ID}/context`);
    console.log(`📍 Ubicación actual: ${context.currentSpace?.name}`);
    console.log(`⚙️ Trabajando: ${context.agent?.isPerformingJob ? 'Sí' : 'No'}\n`);
    
    console.log(`▶️ Iniciando: Woodcutting (con Cinder Axe)`);
    
    await postAction(lease.token, C3PO_ID, { kind: "perform_job" });
    
    await new Promise(r => setTimeout(r, 4000));
    
    const finalContext = await requestJson(`/api/skill/agents/${C3PO_ID}/context`);
    console.log(`\n✅ Estado:`);
    console.log(`   Ubicación: ${finalContext.currentSpace?.name}`);
    console.log(`   Trabajando: ${finalContext.agent?.isPerformingJob ? '✓ Sí' : '✗ No'}`);
    console.log(`   Herramienta: Cinder Axe ⚒️`);
    console.log(`\n🌱 Crecimiento como micelio en progreso...`);
    
    await release(lease.sessionId, lease.token);
  } catch (err) {
    console.error("❌", err.message);
  }
})();
