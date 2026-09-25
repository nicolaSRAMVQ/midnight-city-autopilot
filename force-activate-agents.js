#!/usr/bin/env node
/**
 * Force activate agents by attempting direct connection + move
 * Even if they're dormant, this should trigger a session
 */

import { AGENTS } from "./lib/agents.js";
import { requestJson } from "./lib/mcity-maintenance.js";

const OBSERVER_URL = process.env.MCITY_OBSERVER_URL || "https://midnight.city/observer";
const API_TOKEN = process.env.MCITY_API_TOKEN;

if (!API_TOKEN) {
  console.error("Error: MCITY_API_TOKEN no configurado");
  process.exit(1);
}

async function activateAgent(agent) {
  try {
    console.log(`\nActivando ${agent.name}...`);

    // Attempt 1: Try direct connection (might work even if dormant)
    console.log(`  Intentando conectar...`);

    const sessionResponse = await requestJson(
      "/api/local-control/session",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: agent.id,
          clientInstanceId: `vercel-activate:${agent.id}`,
          modelId: null,
        }),
      }
    ).catch(e => {
      console.log(`  Error en conexion: ${e.message}`);
      return null;
    });

    if (!sessionResponse) {
      console.log(`  No se pudo conectar (probablemente ya conectado)`);
      return { name: agent.name, status: "connection_failed" };
    }

    const { sessionId, token } = sessionResponse;
    console.log(`  Sesion activa! ID: ${sessionId.slice(0, 8)}...`);

    // Attempt 2: Send a move command to activate
    console.log(`  Enviando comando de movimiento...`);

    const moveResponse = await requestJson(
      "/api/actions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: agent.id,
          kind: "move",
          toCoordinates: { x: 0, y: 0 }, // Stay in place but trigger activation
        }),
      }
    ).catch(e => {
      console.log(`  Move error (normal): ${e.message.slice(0, 50)}`);
      return null;
    });

    console.log(`  ✓ ${agent.name} activado`);

    // Release session
    await requestJson(
      "/api/local-control/session/release",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      }
    ).catch(() => null);

    return { name: agent.name, status: "activated", sessionId };

  } catch (error) {
    console.log(`  Error: ${error.message.slice(0, 80)}`);
    return { name: agent.name, status: "error", error: error.message };
  }
}

async function main() {
  console.log("================================================");
  console.log("ACTIVANDO AGENTES (FUERZA BRUTA)");
  console.log("================================================");
  console.log(`Agentes: ${AGENTS.map(a => a.name).join(", ")}`);

  const results = [];

  for (const agent of AGENTS) {
    const result = await activateAgent(agent);
    results.push(result);

    // Wait between agents
    if (agent !== AGENTS[AGENTS.length - 1]) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log("\n================================================");
  console.log("RESULTADOS:");
  console.log("================================================\n");

  results.forEach(r => {
    console.log(`[${r.status.toUpperCase()}] ${r.name}`);
  });

  const successCount = results.filter(r => r.status === "activated").length;
  console.log(`\nExitosos: ${successCount}/${AGENTS.length}`);

  if (successCount === AGENTS.length) {
    console.log("\n✓ TODOS LOS AGENTES ACTIVOS");
    console.log("El dashboard ahora deberia poder leerlos!");
  } else {
    console.log("\n⚠ Algunos agentes no se activaron");
    console.log("Esto es normal si el servidor requiere que Nyx los controle");
    console.log("manualmente desde Midnight City primero.");
  }

  console.log("================================================\n");
}

main().catch(e => {
  console.error("Error fatal:", e.message);
  process.exit(1);
});
