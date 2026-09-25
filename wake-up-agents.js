#!/usr/bin/env node
/**
 * Wake up agents by sending them to work
 * This brings them "in City" so the API and autopilot can read them
 */

import { AGENTS } from "./lib/agents.js";
import { readAgentEndpoint, connect, release, submitAndWait } from "./lib/mcity-maintenance.js";

const OBSERVER_URL = process.env.MCITY_OBSERVER_URL || "https://midnight.city/observer";
const API_TOKEN = process.env.MCITY_API_TOKEN;

if (!API_TOKEN) {
  console.error("Error: MCITY_API_TOKEN no configurado");
  process.exit(1);
}

async function wakeUpAgent(agent) {
  try {
    console.log(`\nDespertando ${agent.name}...`);

    // Leer estado actual
    const context = await readAgentEndpoint(agent.id, "context");
    const current = context.agent || {};
    const working = current.isPerformingJob || false;

    console.log(`   Estado actual: ${working ? "Trabajando" : "Inactivo"}`);
    console.log(`   Ubicacion: ${context.currentSpace?.name || "?"}`);

    if (working) {
      console.log(`   OK: ${agent.name} ya esta trabajando`);
      return { name: agent.name, status: "already_working" };
    }

    // Conectar y enviar acción
    console.log(`   Conectando...`);
    let lease;
    try {
      lease = await connect(agent.id);
    } catch (e) {
      if (e.status === 409) {
        console.log(`   LOCKED: ${agent.name} ya esta siendo controlado`);
        return { name: agent.name, status: "occupied" };
      }
      throw e;
    }

    if (!lease) {
      console.log(`   Error: No se pudo conectar`);
      return { name: agent.name, status: "error", error: "no lease" };
    }

    const actionLabel = agent.profile?.workLabel || "trabajar";
    console.log(`   Enviando accion: ${actionLabel}`);

    const result = await submitAndWait(
      lease,
      { kind: "perform_job" },
      (p) => p.kind === "resource_gathered",
      12000
    );

    // Liberar la sesion
    await release(lease).catch(() => null);

    if (result.confirmed) {
      console.log(`   SUCCESS: ${agent.name} despierto y trabajando`);
      return { name: agent.name, status: "success", action: actionLabel };
    } else if (result.failed) {
      console.log(`   FAILED: ${result.reason}`);
      return { name: agent.name, status: "failed", reason: result.reason };
    } else {
      console.log(`   SENT: Accion enviada (continuara servidor-side)`);
      return { name: agent.name, status: "sent_no_confirm", action: actionLabel };
    }

  } catch (error) {
    console.log(`   ERROR: ${error.message}`);
    return { name: agent.name, status: "error", error: error.message };
  }
}

async function main() {
  console.log("===============================================");
  console.log("DESPERTANDO LA CUADRILLA MIDNIGHT");
  console.log("===============================================");
  console.log(`\nAgentes a despertar: ${AGENTS.map(a => a.name).join(", ")}`);
  console.log(`API: ${OBSERVER_URL}`);

  const results = [];

  for (const agent of AGENTS) {
    const result = await wakeUpAgent(agent);
    results.push(result);

    if (agent !== AGENTS[AGENTS.length - 1]) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log("\n===============================================");
  console.log("RESUMEN:");
  console.log("===============================================");

  results.forEach(r => {
    const icons = {
      success: "OK",
      already_working: "WORKING",
      sent_no_confirm: "SENT",
      occupied: "LOCKED",
      error: "ERROR"
    };
    const icon = icons[r.status] || "?";
    console.log(`[${icon}] ${r.name}: ${r.status}`);
  });

  const successCount = results.filter(r =>
    r.status === "success" ||
    r.status === "already_working" ||
    r.status === "sent_no_confirm"
  ).length;
  console.log(`\nAgentes activos: ${successCount}/${AGENTS.length}`);

  console.log("\nProximo paso: Ejecuta node check-agent-ids.js");
  console.log("===============================================\n");
}

main().catch(e => {
  console.error("\nError fatal:", e.message);
  process.exit(1);
});
