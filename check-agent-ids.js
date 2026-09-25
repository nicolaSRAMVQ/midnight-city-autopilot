#!/usr/bin/env node
/**
 * Script para verificar IDs de agentes en Midnight City
 *
 * Uso:
 *   MCITY_API_TOKEN="tu_token" MCITY_OBSERVER_URL="https://midnight.city/observer" node check-agent-ids.js
 */

const OBSERVER_URL = process.env.MCITY_OBSERVER_URL || "https://midnight.city/observer";
const API_TOKEN = process.env.MCITY_API_TOKEN;

if (!API_TOKEN) {
  console.error("❌ Error: MCITY_API_TOKEN no configurado");
  console.log("\nPaso 1: Obtén tu API Token en https://midnight.city → Settings → API Key");
  console.log("Paso 2: Ejecuta:");
  console.log('  MCITY_API_TOKEN="midnight_..." node check-agent-ids.js');
  process.exit(1);
}

async function checkAgent(agentId, name) {
  try {
    const response = await fetch(`${OBSERVER_URL}/api/skill/agents/${agentId}/context`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });

    if (response.status === 404) {
      return { status: '❌ 404', name, agentId, note: 'ID no encontrado o agente dormido' };
    }

    if (!response.ok) {
      return { status: `⚠️ ${response.status}`, name, agentId, note: 'Error de API' };
    }

    const data = await response.json();
    const agent = data.agent || {};
    return {
      status: '✅ OK',
      name,
      agentId,
      level: agent.level || '?',
      profession: agent.profession || '?',
      xp: agent.xp || 0,
    };
  } catch (e) {
    return { status: '⚠️ ERROR', name, agentId, note: e.message };
  }
}

async function main() {
  console.log('🔍 Verificando agentes...\n');

  // Probar IDs actuales
  const currentIds = {
    'R2': 'user-agent-z7oxfvxkjpod4b5',
    'BB-8': 'user-agent-326gbw4lg4sjiiv',
    'C-3PO': 'user-agent-r5wd1einkurgide',
  };

  console.log('📍 IDs actuales en lib/agents.js:\n');
  const results = [];
  for (const [name, id] of Object.entries(currentIds)) {
    const result = await checkAgent(id, name);
    results.push(result);
    console.log(`${result.status} ${name}: ${id}`);
    if (result.note) console.log(`        → ${result.note}`);
    if (result.level) console.log(`        → Nivel ${result.level}, Profesión: ${result.profession}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const anyOk = results.some(r => r.status === '✅ OK');
  if (anyOk) {
    console.log('\n✅ Algunos agentes están OK');
    console.log('\n📝 Próximo paso: Ejecutar con deploy en Vercel');
    console.log('  vercel deploy --prod');
  } else {
    console.log('\n❌ TODOS los IDs retornan 404');
    console.log('\n🔧 Opciones:');
    console.log('  1. Verifica que los agentes aún existen en Midnight City');
    console.log('  2. Actualiza lib/agents.js con IDs correctos (si los tienes)');
    console.log('  3. Verifica que MCITY_API_TOKEN es válido');
    console.log('\n📍 Para obtener los IDs correctos:');
    console.log('  - Abre https://midnight.city en tu navegador');
    console.log('  - Login con tu cuenta');
    console.log('  - Abre DevTools (F12) → Network tab');
    console.log('  - Haz cualquier acción (click, movimiento)');
    console.log('  - Busca una request a /api/skill/agents');
    console.log('  - Copia los IDs de los agentes en la respuesta');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
