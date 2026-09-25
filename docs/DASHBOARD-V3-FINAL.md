# Dashboard Cuadrilla Midnight — V3 Final

**Versión:** 3.0 (Producción)  
**Estado:** 🎨 En vivo + iterando  
**Última actualización:** 2026-09-23  
**Ubicación:** https://claude.ai/artifact/TKsYJPVZKxfdrLB5RxL9Ya

---

## 🎯 Propósito

**Centro de Mando unificado** para monitorear, documentar y controlar la Cuadrilla Midnight (R2, BB-8, C-3PO) en tiempo real.

No es una app estándar: es un **superdashboard interactivo** que combina:
- **Estado en vivo** de los 3 agentes (cards Pokemon 3D flip)
- **Documentación completa** de arquitectura, economía, evolución
- **Protocolos de decisión** (lógica de autopilot)
- **Roadmap técnico** (roadmap, tecnología, historial)
- **API reference** (endpoints disponibles)
- **Autorreferencia** (self-documentation del mismo dashboard)

---

## 📊 Estructura: 7 Tabs

### 1️⃣ **Estado** (Dashboard Principal)
**Qué es:** La "flota" visualizada como 3 cards de Pokémon con flip 3D.

**Frente (Front):**
- Imagen pixel art (r2.png, bb8.png, c3po.png)
- Nombre + Profesión
- Stats: Level, XP%, Crystals, Hambre, Estado
- Hint: "↻ Girar para más"

**Reverso (Back):**
- Estado Actual: Modo, Versión, Eficiencia
- Ubicación: Nombre, Proximidad
- Próxima Meta: Objetivo + Barra de progreso

**Interacción:** Click/tap en card → flip 3D suave (0.6s)

**Diseño:**
- Grid responsivo: 3 columns (desktop), 1 column (mobile)
- Colores por profesión:
  - R2 (Hacker): Cian `#3ec6ff`
  - BB-8 (Miner): Naranja `#ff9a4d`
  - C-3PO (Lumberjack): Púrpura `#c39bff`
- 3D perspective: `perspective: 1000px`, `transform-style: preserve-3d`, `backface-visibility: hidden`

---

### 2️⃣ **Protocolos**
**Qué es:** Documentación + especificación de la lógica de decisión.

**Secciones:**
1. **Explicación teórica:** Cómo funcionan P0/P1/P2/P3
   - P0 (Emergencia): hambre > 85 → comer
   - P1 (Mantenimiento): sobrecargado → vender
   - P2 (Producción): ubicación correcta → trabajar
   - P3 (Comercio): listo → vender a merchant

2. **Protocolos por agente:** R2, BB-8, C-3PO
   - Cada uno muestra sus triggers y acciones

3. **Próximo paso:** Conectar con `/api/agent-status` para traer datos en vivo

**Estado actual:** Hardcodeado (teoría). Necesita integración API.

---

### 3️⃣ **Tecnología**
**Qué es:** Árbol de progresión de herramientas por agente.

**Por agente (R2, BB-8, C-3PO):**
- Herramientas disponibles con:
  - Nombre
  - Costo en crystals
  - Tier (2, 3, etc)
  - Status: "✓ Adquirido" o vacío (no comprado)

**Uso:** Planificar compras, estimar ROI, decidir prioridades.

**Ejemplo:**
- BB-8: Obsidian Pickaxe = 20 crystals → +40 XP/h → se recupera en 30min
- R2: Cinder Decoder = 14 crystals → desbloquea... (TBD)
- C-3PO: Basalt Axe = 14 crystals → mejor ratio

**Estado actual:** Hardcodeado. Necesita conectar `/api/skill/merchants`.

---

### 4️⃣ **Historial**
**Qué es:** Timeline completo de evolución, cambios de código, optimizaciones.

**Campos por evento:**
- Fecha (YYYY-MM-DD)
- Tipo: `infra` (🏗️), `code` (💻), `perf` (📈)
- Título descriptivo
- Categoría (Protocolo, Navegación, Comercio, etc)
- Agentes afectados
- Versión de código (v1.8 → v1.9)
- Cambio: descripción
- Antes/Después: métricas
- Métrica: XP/h, crystals, etc
- Notas: detalles adicionales
- Impact: resumen del impacto

**Filtros:** Todo | Código | Stack | Rendimiento

**Eventos actuales:**
1. 2026-09-23: Migramos a GitHub Actions (infra)
2. 2026-09-23: BB-8 Overload Threshold (code)
3. 2026-09-22: R2 Velocidad Consistente (perf)
4. 2026-09-21: C-3PO Ruta Optimizada (code)
5. 2026-09-20: R2 Auto-Sell Lógica (code)

---

### 5️⃣ **API** 🔌
**Qué es:** Referencia técnica de Midnight City Observer API.

**Endpoints disponibles:**
- `/api/skill/agents/{agentId}/context` → ubicación, nivel, XP, estado
- `/api/skill/agents/{agentId}/needs` → hambre
- `/api/skill/agents/{agentId}/inventory` → items, carga, velocidad
- `/api/skill/agents/{agentId}/progression` → skills, XP, vitalidad
- `/api/skill/agents/{agentId}/activity` → log de acciones
- `/api/skill/merchants` → todos los merchants, ofertas
- `/api/skill/districts` → mapa, rutas, distancias

**Datos que podemos extraer:**
- Histórico de rendimiento (XP/h promedio)
- Economía de crystals (predicción)
- Patrones de trabajo (ciclos, saturación)
- Salud de hambre (predicción de cuándo comen)
- Próximas metas (level up, equipo)
- Comparativas (eficiencia, gasto, distancia)

**Casos de uso avanzados:**
- Auto-ajuste de lógica (si XP/h < 50% → alerta)
- Análisis de rentabilidad (crystal/hora vs costo)
- Proyecciones (ETA a level milestones)
- Balance de recursos (si crystals bajan → prioridad)
- Optimización de rutas (usar distance data)

**Tabla de implementaciones propuestas:**
| Feature | Data Source | Valor | Complejidad |
|---------|-------------|-------|-------------|
| Gráfico XP/h histórico | activity + progression | Alto | Medio |
| Predictor de crystals | inventory + activity | Muy Alto | Alto |
| ETA a Level Up | progression + activity | Medio | Bajo |
| Hambre Predictor | needs + activity | Alto | Bajo |
| Mapa en Vivo | context + districts | Medio | Muy Alto |

---

### 6️⃣ **Arquitectura** ⚙️
**Qué es:** Documentación técnica completa para desarrollo e iteración.

**Flujo de ejecución (6 pasos):**
1. GitHub Actions cron dispara (*/10 * * * * para autopilot, 0 12/4 * * * para reportes)
2. Vercel endpoint recibe request (/api/r2-autopilot o /api/r2-report)
3. Conecta a Midnight City API con MCITY_API_TOKEN
4. Lee estado actual (context, needs, inventory, progression)
5. Ejecuta lógica: runConnectedMaintenance() en lib/mcity-maintenance.js
6. Envía resultado a Telegram (solo si reporte, 4x/día)

**Cronograma:**
- Cada 10 min: Autopilot (1 acción) | /api/r2-autopilot | 8-12s
- 09:00 ARG: Reporte | /api/r2-report | 12:00 UTC
- 13:00 ARG: Reporte | /api/r2-report | 16:00 UTC
- 18:00 ARG: Reporte | /api/r2-report | 21:00 UTC
- 21:00 ARG: Reporte | /api/r2-report | 00:00 UTC+1

**Stack técnico:**
- **GitHub Actions:** Cron (*/10, 0 12/4 * * *) | variables: AUTOPILOT_URL, REPORT_URL | Costo: $0
- **Vercel:** /api/r2-autopilot.js, /api/r2-report.js, /api/agent-status.js | Costo: $0
- **Librerías:** lib/mcity-maintenance.js (core), lib/agents.js (roster)

**Lógica de decisión:**
```
P0 (EMERGENCIA): if (hunger > HUNGER_EAT_THRESHOLD) → Comprar comida
P1 (SOBRECARGA): if (overloaded || BB-8 && speed < 80%) → Vender
P2 (PRODUCCIÓN): if (in_correct_location) → Ejecutar skill
P3 (COMERCIO):   if (inventory_good && ready_to_sell) → Vender
```

**Cómo iterar:**
1. Cambiar lógica en lib/mcity-maintenance.js
2. Deploy: vercel deploy --prod
3. Agregar métrica al dashboard (auto-refresh 30-60s)
4. Monitorear en Telegram (reporte cada 3h)
5. Documentar en CONTEXT.md

**Troubleshooting:**
- Cron no disparó → Ver GitHub Actions
- API 404 → Midnight City API down, env vars incorrectos, agent IDs cambiados
- Telegram no llega → Token/chat ID incorrectos, bot removido, vars no actualizadas
- Agent atrapado → Revisar protocolo, aumentar umbral, cambiar trigger

---

### 7️⃣ **Documentación** 📚
**Qué es:** Descargables con toda la documentación del proyecto.

**Archivos disponibles:**
1. 00-START-HERE.md (2.5 KB) — Intro rápida de la cuadrilla
2. architecture.md (4.8 KB) — Cómo funciona el autopilot
3. midnight-city-guide.md (7.4 KB) — Economía, ARG, game mechanics
4. evolution.md (6.8 KB) — 4 fases de desarrollo
5. DASHBOARD-V2-PROPOSAL.md (6.3 KB) — Especificación original
6. agents/R2.md (3.4 KB) — Perfil de R2
7. agents/BB-8.md (3.8 KB) — Perfil de BB-8
8. agents/C-3PO.md (3.9 KB) — Perfil de C-3PO

**Interacción:** Botón "Descargar" por archivo, o "📦 Descargar Todos" para batch.

---

### 8️⃣ **Dashboard Final** (NEW) 🎯
**Qué es:** Autorreferencia del dashboard. Contiene:
- MD: Especificación completa (este documento)
- HTML: Código fuente descargable (dashboard-v3.html)
- Ambos se actualizan automáticamente con cada iteración

**Propósito:** 
- Que el dashboard se auto-documente
- Fácil acceso al código HTML para forks/debugging
- Trackear versión actual vs histórico

---

## 🎨 Diseño Visual

### Paleta de colores (CSS variables)
```css
--bg: #0a0e16 (fondo)
--surface: #10151f (paneles)
--surface-2: #161d2b (paneles secundarios)
--border: #232c40 (bordes)
--text: #e7ebf5 (texto principal)
--text-dim: #8b93aa (texto secundario)
--text-faint: #5b6478 (texto terciario)
--hacker: #3ec6ff (R2)
--miner: #ff9a4d (BB-8)
--lumber: #c39bff (C-3PO)
--good: #4ade80 (éxito)
--warn: #fbbf24 (advertencia)
--critical: #f87171 (crítico)
```

### Tipografía
- **Display:** Chakra Petch (títulos, tabs)
- **Body:** IBM Plex Sans (párrafos)
- **Mono:** IBM Plex Mono (código)

### Layout
- **Desktop:** Max-width 1200px, grid auto-fit
- **Mobile:** 1 column, 16px padding, safe-area inset
- **Tabs:** Horizontal scroll, active indicator

---

## 🔄 Ciclo de Iteración

**Cómo actualizar:**
1. Cambiar dashboard-v3.html o código del autopilot
2. Publicar nuevo versión en artifact
3. Actualizar este MD (DASHBOARD-V3-FINAL.md) con cambios
4. Tab "Dashboard Final" refleja automáticamente los cambios
5. HTML descargable siempre es la versión más reciente

**Control de versión:**
- Versión del dashboard: se incrementa con cada cambio material
- Versión de agentes: v1.7, v1.8, v1.9, v2.1, v2.3 (por cambios de código)
- Fecha de actualización: 2026-09-23 (se actualiza con cada iteración)

---

## 📈 Roadmap (Fases)

### ✅ Completadas
1. **Cimientos** — Skill instalado, R2 conectado, reporte auto, autopilot básico
2. **Escala a Cuadrilla** — BB-8 + C-3PO, multi-agente, venta automática

### 🔄 En Progreso
3. **Optimización** — BB-8 threshold optimizado, monitor en progreso, C-3PO benchmark, arbitraje
4. **Dashboard Final** — Auto-documentación, HTML descargable, versión tracking

### ⏳ Sin Confirmar
5. **Horizonte** — R2 L21, comercio entre jugadores, nuevas áreas

---

## 🚀 Deployment

**Artifact:** Privado (solo lectura/descarga para el propietario)  
**URL:** https://claude.ai/artifact/TKsYJPVZKxfdrLB5RxL9Ya  
**Tipo:** HTML + JavaScript (no requiere backend)  
**Capacidades:** Downloads (para descargar MD y HTML)

---

## 📝 Cambios Recientes

| Fecha | Cambio | Impacto |
|-------|--------|---------|
| 2026-09-23 | Agregado tab "Documentación" con 8 MDs descargables | +completitud |
| 2026-09-23 | Agregado tab "Dashboard Final" (autorreferencia) | +iteración rápida |
| 2026-09-23 | BB-8 overload threshold optimizado (v1.8→v1.9) | +18% eficiencia |
| 2026-09-23 | Migramos a GitHub Actions | $0 cost, +confiabilidad |

---

## 🎯 Próximas Acciones

1. ✅ Documentar dashboard actual (este MD)
2. ⬜ Hacer HTML descargable desde tab "Dashboard Final"
3. ⬜ Auto-actualizar MD y HTML con cada cambio
4. ⬜ Conectar Protocolos con /api/agent-status
5. ⬜ Conectar Tecnología con /api/skill/merchants
6. ⬜ Agregar auto-refresh en tab Estado (cada 30s)
7. ⬜ Monitor BB-8 por 1-2 ciclos (confirmar optimización)
8. ⬜ Explorar arbitraje (R2 es el más rápido)

---

**Mantenido por:** Claude Haiku 4.5  
**Para:** Nyx (Cuadrilla Midnight)  
**Última actualización:** 2026-09-23

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
