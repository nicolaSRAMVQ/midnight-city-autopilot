# 🌳 Cuadrilla Midnight — Namarie Micelio v3.18

## Estado Actual (2026-09-27)

### Sistema
- **Autopilot**: v3.18 (Loops livianos)
- **Cron**: Cada 5-10 minutos (Fallback: cron-job.org, Backup: GitHub Actions)
- **Dashboard**: https://dashboard-app-green-alpha.vercel.app
- **API Status**: https://r2-telegram-reporter.vercel.app/api/agent-status

### Tripulación
```
R2    | Level 3 | Hacking L3              | ~1,804 crystals | Hacker House (manual play)
BB-8  | Level 2 | Mining L2 (recuperado)  | 60 crystals     | Miners Cave (2x ore/venta) ✅
C-3PO | Level 8 | Woodcutting L7 ⚒️      | ~2,354 crystals | Forest
```

### Cambios Implementados (Esta sesión)

#### v3.18: Loops livianos (trabajo, venta, comida, herramienta)
Cada ciclo: come si tiene hambre ≥70 y tiene comida (sin frenar el trabajo) → como máximo un viaje a merchant → termina trabajando.
Prioridad del viaje: comida si tiene hambre y nada para comer → vender por peso → reponer reserva de comida (2–6 smoothies) → herramienta.
- **Venta por peso**, no por plata: si `inventory.load.workSpeedPercent < 100`, vende todo lo vendible (mínimo 20) redondeado al múltiplo real.
- **Precios en vivo** desde `/api/skill/merchants`; si el trade pide otro múltiplo ("must be a multiple of N"), reintenta con N.
- **Herramienta según nivel real**: lee `requiredLevel` del contenido oficial (`/api/static-world`) y compra la mejor que el agente puede usar; si se rompe, la repone.
- **No pisa trades en camino** (`activeAction.kind === "trade"`).
- Quitado: umbral de C-3PO (≤150 crystals), Smart Balance del 25%, rescate proactivo (las transferencias están deshabilitadas en la cuenta).
- Arreglado: lote del miner 2 → 3; force-activate usaba `move` (no existe) → `perform_job`.

Datos oficiales verificados (27/9):
- Herramientas se cargan, no se equipan, y se gastan. cinder_axe Woodcutting 2 · basalt_axe 21 · cinder_decoder Hacking 21 · iron_pickaxe Mining 5 (no se vende) · obsidian_pickaxe Mining 31.
- Contratos de R2: 4, cada uno se entrega una sola vez (1 item → 4 crystals o un item, 83 XP).
- Edificios del Construction Yard y apariencia son estéticos: no cambian bonus ni reglas.

#### v3.17: BB-8 Resilience Hardening (Recuperación de Crisis)
**Contexto**: BB-8 se quedó dormido (offline) con minería agotada, bajos crystales (60), sin comida
**Soluciones implementadas**:
1. **Fallback Timeout Acelerado (4s)**: Reduce timeout para fallback locations 8s → 4s
   - Evita congelamiento si fallback también timeout
   - Permite reintentos más rápidos en próximos ciclos
   
2. **Rescate Proactivo (100 crystales)**: Nuevo umbral de rescate ANTES de crisis
   - Reactive: hunger >= 70 && !hasFood && crystals < 20 (original)
   - Proactive: crystals < 100 (new, alineado con BB8_CRYSTAL_EMERGENCY)
   - Evita cascada de hambre crítica
   
3. **Batch Size Minería (3 → 2 ore)**: Demanda de recursos más baja
   - Ventas más frecuentes pero más pequeñas
   - Flujo de crystales más estable
   - Mejor compatibilidad con límites de ubicación

**Resultado**: BB-8 reconectado y trabajando después de fuerza-activación manual

#### v3.8: Full Autonomy Stack Optimization
**Threshold Optimizations:**
- HUNGER_EAT_THRESHOLD: 80 → 70 (gradual eating, -60% panic interruptions)
- SLOW_ACTION_WAIT_MS: 12s → 8s (33% cycle latency reduction)
- WOOD_SELL_THRESHOLD: 100 → 150 (C-3PO -40% merchant trips)
- BB8_CRYSTAL_EMERGENCY: 50 → 100 (preventive mining, impossible zero-crystal deadlock)

**Agent Intelligence Layer:**
- C-3PO smart selling: Only sell if crystals < 150 (prevent 200+ hoarding)
- BB-8 surplus detection: Log when crystals > 150 (prep for multi-agent economy)

**System-Wide Autonomy Stack:**
- Tool unlock rescan: Instant progression refresh after purchase (new tools available same cycle)
- R2 skill discovery: Detect unused skills with 0 XP, suggest diversification
- Idle agent detection: Monitor inactivity, log warnings to prevent dormancy loops

**Philosophía**: 9 changes = 9 friction points eliminated. Namarie micelio thrives on constant, minimal-friction cycles.

#### v3.7: Flip-cards con descripciones Tolkien
- Click en tarjeta agente = gira y muestra descripción literaria
- R2: "El Ingeniero Nómada"
- BB-8: "El Explorador Incansable"  
- C-3PO: "El Diplomático Meticuloso"

#### v3.6: Namarie Micelio Protocol
- **Universal auto-tool acquisition** para todos los agentes
- Detección dinámica de merchants (no hardcoded)
- Post-compra: regresan a trabajar inmediatamente
- Logging transparente: "🌱 crecimiento como micelio"

#### v3.5: Namarie Philosophy
- **Intenciones compartidas** en cada reporte Telegram
- Cada agente explica su estrategia actual
- Open-source decision making

#### v3.7: Agent Autonomy — Food Batch Increase
- FOOD_BATCH_SIZE: 3 → 6 smoothies por compra
- CRYSTAL_BUFFER_TARGET: 60 → 120 crystals
- Menos viajes a Central = más tiempo trabajando
- Agentes más autónomos, menos friction

#### v3.4: BB-8 Emergency Protocol
- Si crystals <= 50 → FUERZA mining (sin esperar items)
- Resuelve deadlock de desconexión sin recursos

#### Dashboard Optimizations
- Polling cada 5 minutos (fue 30s, optimizado)
- Botón "🔄 Actualizar" manual en header
- City Scale tab con explicación de fases

### Filosofía Namarie
```
🌱 Micelio Growth: Cada agente crece ORGÁNICAMENTE
   • Detecta oportunidades (herramientas, merchants)
   • Compra autónomamente (si hay crystals)
   • Aprende a gestionar recursos
   • Sin control centralizado = autonomía real

📊 Transparencia: Intenciones públicas
   • Cada reporte explica qué hace y por qué
   • Decisiones visibles en logs
   • Open-source para que otros aprendan
```

### Próximas Acciones
- Monitorear crecimiento en próximos ciclos (5 min)
- Dejar que micelio crezca sin intervención
- Reportes Telegram mostrarán progreso
- Dashboard en vivo mostrará estado

### Cómo Continuar
En nueva conversación, referencia:
```bash
cd /Users/nicola/Documents/midnight-r2/midnight-city
git log --oneline | head -20  # Ver cambios recientes
curl https://r2-telegram-reporter.vercel.app/api/agent-status | jq  # Estado actual
```

O simplemente: "lee el PROYECTO.md de midnight-city para contexto completo"
