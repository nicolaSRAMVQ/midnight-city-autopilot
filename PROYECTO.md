# 🌳 Cuadrilla Midnight — Namarie Micelio v3.8

## Estado Actual (2026-09-25)

### Sistema
- **Autopilot**: v3.6 (Namarie micelio protocol)
- **Cron**: Cada 5 minutos (288 ciclos/día)
- **Dashboard**: https://dashboard-app-green-alpha.vercel.app
- **API Status**: https://r2-telegram-reporter.vercel.app/api/agent-status

### Tripulación
```
R2    | Level 3 | Hacking L3           | ~1,700 crystals | Hacker House
BB-8  | Level 2 | Mining L2 (emergencia)| 0 crystals      | Miners Cave (minando 3x ore)
C-3PO | Level 7 | Woodcutting L7 ⚒️   | ~1,900 crystals | Forest
```

### Cambios Implementados (Esta sesión)

#### v3.8: Autonomy Threshold Optimization
- **HUNGER_EAT_THRESHOLD**: 80 → 70 (comen más gradual, menos interrupciones de pánico)
- **SLOW_ACTION_WAIT_MS**: 12s → 8s (33% menos latencia de ciclo)
- **WOOD_SELL_THRESHOLD**: 100 → 150 logs (C-3PO hace -40% viajes a merchant)
- **BB8_CRYSTAL_EMERGENCY**: 50 → 100 (minería preventiva, imposible quedar sin crystals)
- Filosofía: Cada cambio = eliminar un punto de fricción

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
