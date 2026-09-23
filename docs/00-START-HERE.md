# Cuadrilla Midnight — START HERE

**Autopiloto serverless para 3 agentes en Midnight City**

---

## 📍 Centro de Mando (Fuente Única de Verdad)

### Artifact Dashboard
→ https://claude.ai/artifact/Vo7adGNUuWPc2Kkh5L8NwU

**Contiene:**
- Dashboard en vivo (flota, niveles, XP, hambre, cristales)
- Roadmap interactivo (fases, checkboxes, generador de prompts)
- Bitácora de cambios (log de eventos por agente)
- Backend tab (costos, documento state, arquitectura)

---

## 🤖 La Cuadrilla

| Agente | Profesión | Skill | Ritmo | Botella |
|--------|-----------|-------|-------|---------|
| R2 | Hacker | Level 2 | ~426 XP/h | Cola en Hacker House |
| BB-8 | Miner | Level 2 | ~162 XP/h | Cola en Miners Cave (optimizada) |
| C-3PO | Lumberjack | Level 6 | ~4,407 XP/h | Ninguna |

**Cambio reciente (2026-09-23):** BB-8 ahora vende ore cuando velocidad < 80% (en lugar de esperar excessWeight > 0). Resultado: más aggressive selling, menos atrapado.

---

## 📊 Estado Actual

```
R2:    Level 2, ~95% XP, hambre OK, 1,504 crystals
BB-8:  Level 2, ~30% XP, hambre OK, 0 crystals
C-3PO: Level 6, ~92% XP, hambre OK, 1,782 crystals
```

---

## 🛠️ Infraestructura

- **GitHub Actions:** Cron cada 10 min (`*/10 * * * *`), gratis
- **Vercel:** Hobby plan, endpoints para autopilot + reporte
- **Telegram:** Reportes 4x/día
- **Costo:** $0/mes (EasyCron vence 27/9, evaluar alternativas)

---

## 📋 Roadmap

### ✅ Completadas
1. **Cimientos** — R2 conectado, reporte auto, autopilot básico
2. **Escala a Cuadrilla** — BB-8 + C-3PO, multi-agente, venta automática

### 🔄 En Progreso
3. **Optimización** — Ajuste de thresholds, arbitraje entre mercaderes

### ⏳ Sin Confirmar
4. **Horizonte** — Hacking L21, comercio entre jugadores, nuevas áreas

---

## 📚 Documentación Completa

**En este repo:**
- `architecture.md` — Cómo funciona el autopilot
- `midnight-city-guide.md` — Economía, ARG, descubrimientos
- `agents/R2.md` — Perfil de R2
- `agents/BB-8.md` — Perfil de BB-8
- `agents/C-3PO.md` — Perfil de C-3PO
- `evolution.md` — Cómo llegamos aquí, próximos pasos

**En el artifact:**
- Todas las secciones arriba + estado interactivo en vivo

---

## 🎯 Próximas Acciones

1. Monitor BB-8 sobre 1-2 ciclos de cron
2. Decidir EasyCron vs GitHub Actions nativo
3. Explorar arbitraje (R2 es el más rápido)
4. Evaluar si C-3PO necesita ajustes

---

**Última actualización:** 2026-09-23

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
