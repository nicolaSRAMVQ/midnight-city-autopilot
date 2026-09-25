# Dashboard Cuadrilla Midnight — Propuesta V2

**Fecha:** 2026-09-23  
**Versión:** 2.0 (en diseño)  
**Estado:** 🎨 Esperando feedback de Nyx

---

## 🎯 Objetivo

Crear un **superdashboard** que muestre el estado **en vivo** de los tres agentes con:
- ✅ Diseño tipo **Pokemon cards** (frente/reverso con flip animation)
- ✅ **Información completa** del juego (inventory, skills, ubicación, hambre, velocidad)
- ✅ **Mobile-first** y responsivo
- ✅ **Sin redundancia** (una sola vista, no repetida)
- ✅ **Acceso a documentación** (MDs en GitHub, embedidas o linkeadas)

---

## 📊 Estructura del Dashboard

### Vista Principal: La Flota

Grid de 3 cards (1 por agente), cada una con:

#### **FRENTE (Stats Rápidos)**
```
┌─────────────────────┐
│   🖼️ IMAGEN PIXEL   │
│                     │
│  R2 - El Hacker     │
│  L2 · 95% XP        │
│  💎 1,908 crystals  │
│  ⚡ Trabajando      │
│  📍 Hacker House    │
│                     │
│  ↻ GIRAR PARA MÁS   │
└─────────────────────┘
```

**Al hacer click/tap:**

#### **REVERSO (Info Completa)**
```
┌─────────────────────────────────┐
│  R2 — El Hacker (nivel 2)       │
│─────────────────────────────────│
│                                 │
│  📊 STATS                        │
│  • Profesión: Hacker            │
│  • Ritmo: ~426 XP/h             │
│  • Skill actual: Hacking L2     │
│  • Hambre: 77/100 (hungry)      │
│  • Velocidad trabajo: 100%      │
│                                 │
│  🎒 INVENTARIO                  │
│  • crystal ×1908               │
│  • meme_coin ×18               │
│  • encrypted_packet ×565       │
│  • etched_cipher_deck ×20      │
│                                 │
│  📍 UBICACIÓN                    │
│  • Hacker House                 │
│  • Esperando en cola            │
│                                 │
│  🎯 PRÓXIMA ACCIÓN              │
│  • Vender 1 meme_coin          │
│  • Comprar Matcha Smoothie      │
│                                 │
│  ← VOLVER A FRENTE              │
└─────────────────────────────────┘
```

---

## 🎨 Diseño Visual

### Card Style (Pokemon-inspired)
- **Frente:** Gradiente oscuro, imagen pixel art, hover effect
- **Reverso:** Scrolleable, tipografía jerárquica, tags por sección
- **Animación:** Flip suave (0.3s), 3D perspective
- **Colores por profesión:**
  - R2 (Hacker): Azul cian (`#3ec6ff`)
  - BB-8 (Miner): Naranja (`#ff9a4d`)
  - C-3PO (Lumberjack): Púrpura (`#c39bff`)

### Responsive
- **Desktop:** 3 cards lado a lado
- **Tablet:** 2 cards + 1 abajo
- **Mobile:** 1 card por línea, full width

---

## 📋 Secciones Adicionales

### Tab 1: Dashboard (PRINCIPAL)
→ Cards con flip (como se describe arriba)

### Tab 2: Roadmap
→ Las 4 fases de evolución (sin cambios)

### Tab 3: Documentación
→ Links/embeds de las MDs:
- `00-START-HERE.md` — Intro
- `architecture.md` — Cómo funciona
- `midnight-city-guide.md` — Guía del juego
- `evolution.md` — Roadmap detallado
- `agents/R2.md`, `BB-8.md`, `C-3PO.md` — Perfiles completos

**Opción A (Links):** Clickeable → GitHub  
**Opción B (Embed):** Contenido mostrado en tabs  
**Opción C (Hybrid):** Preview + "Ver en GitHub"

---

## 🔗 Integración en Vivo

### Datos que Mostrar
Conexión a `/api/agent-status` endpoint en Vercel que devuelve:

```json
{
  "agents": [
    {
      "name": "R2",
      "profession": "hacker",
      "level": 2,
      "xp": 15834,
      "xpPercent": 95,
      "hunger": 77,
      "crystals": 1908,
      "working": false,
      "speed": 100,
      "location": "Hacker House",
      "skill": "Hacking L2",
      "inventory": { "crystal": 1908, "meme_coin": 18, ... }
    },
    ...
  ],
  "timestamp": "2026-09-23T14:14:29.245Z"
}
```

### Refresh Strategy
- **Auto-refresh:** Cada 30-60 segundos (configurable)
- **Manual refresh:** Botón en la esquina
- **Timestamp:** "Última actualización hace X minutos"

---

## ✨ Características Opcionales (Fase 2)

### Gráficos y Estadísticas
- **Crystals over time:** Línea mostrando tendencia
- **XP progress:** Barra de progreso hacia next level
- **Ritmo (XP/h):** Meter que se actualiza

### Alertas
- ⚠️ Hambre alta (>80)
- 🔴 Velocidad baja (<50%)
- 🟡 Sobrecarga detectada
- ✅ Level up!

### Comparativas
- "R2 vs BB-8 vs C-3PO" — Crystals/hora
- "Eficiencia" — XP/h ranking
- "Hambre" — Estado de cada uno

### Exportar/Compartir
- Screenshot de la flota
- CSV con datos históricos
- Link shareable al artifact

---

## 🎮 Interactividad

### Mobile (Touch)
- Tap card → flip
- Swipe ↔ entre agentes
- Long-press → opciones

### Desktop (Mouse)
- Click card → flip
- Hover → preview de info oculta
- Keyboard arrows ← → para navegar

---

## 📱 Casos de Uso

1. **Quick Check:** Mirar el frente de las cards → estado al instante
2. **Deep Dive:** Girar reverso → info completa de inventario/skills
3. **Documentación:** Abrir tab Docs → estudiar arquitectura
4. **Monitoreo:** Dejar abierto, refresh cada 30s → ver cambios en vivo

---

## 🚀 Próximos Pasos

1. **Feedback de Nyx:** ¿Qué más información necesita? ¿Qué se puede quitar?
2. **Iteración:** Basado en feedback, refinar diseño
3. **Implementación:** Código HTML/CSS/JS para artifact
4. **Testing:** Mobile, desktop, diferentes browsers
5. **Deployment:** Actualizar artifact en vivo

---

## 🤔 Preguntas para Nyx

- ¿Qué información es más importante ver de un vistazo?
- ¿Falta algún dato clave del juego que no estamos mostrando?
- ¿El flip card es intuitivo o preferís otro diseño?
- ¿Cada cuánto tiempo necesitás updates en vivo?
- ¿Hay límites de lo que el juego permite mostrar/monitorear?
- ¿Los agentes pueden estar en "modo combate" u otro estado especial que deba visualizarse?

---

**Versión:** Propuesta V2  
**Autor:** Claude (con Nyx feedback TBD)  
**Última actualización:** 2026-09-23

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
