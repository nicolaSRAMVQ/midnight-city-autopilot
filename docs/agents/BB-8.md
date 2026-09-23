# BB-8 — El Minero

**Profesión:** Miner  
**Skill:** Mining Level 2 (30% de progreso)  
**Ritmo:** ~162 XP/h (el más lento, pero optimizando)  
**Cuello de botella:** Cola en Miners Cave  
**Cristales:** 0 (acaba de vender)  
**Último estado:** OK (hambre normal, trabajando)

---

## Perfil

**Personality:** Curioso, observador, generador de insights.

**Flavor:** "Curioso y cálido. Se fija en todo lo que rueda, brilla o quedó olvidado en una galería, y siempre se toma un vistazo extra."

### Potenciales a Desarrollar
- Optimización de rutas
- Detección de patrones
- Escalabilidad

### Skills Actuales
- Geometría de mercados
- Logística
- Intuición

### Etiquetas
- Curiosidad
- Eficiencia
- Adaptabilidad

---

## Profesión: Minería

**Trabajo:** Extraer ore en Miners Cave

**Economía:**
- Recoge: **ore**
- Vende: **ore**
- Merchant: Central Merchant East
- Por batch: 3 unidades
- Ratio: 4 crystals por 3 ore

**Ventaja:** Recojo steady, no depende de merchant interno  
**Desventaja:** Cola en Miners Cave ralentiza todo

### Ciclo Típico
1. Ir a Miners Cave
2. Esperar turno en la cola (GRAN cuello de botella)
3. Extraer ore (XP por mineral)
4. Acumular hasta 3 ore (un batch)
5. Ir a Central Merchant East
6. Vender 3 ore → 4 crystals
7. Repetir

**Problema:** La cola es el 60-70% del tiempo de espera.

---

## El Cambio: Overload Threshold (2026-09-23)

### Problema Anterior
BB-8 acumulaba ore demasiado rápido. Una vez cargado, la métrica `excessWeight` no subía lo suficiente rápido, así que el autopilot no vendía. Resultado: BB-8 se frenaba más y más.

### Solución
```javascript
const isBB8 = agent.name === "BB-8";
const overloaded = isBB8
  ? (load.workSpeedPercent ?? 100) < 80  // ← NUEVO
  : (load.excessWeight ?? 0) > 0 || (load.state && load.state !== "normal");
```

**Lógica:** BB-8 vende cuando su velocidad de trabajo cae por debajo del 80%, no espera a excessWeight.

### Resultados Esperados
- Más aggressive selling
- Menos tiempo atrapado
- Ritmo debería aumentar (posible +20-30 XP/h)

### Monitoreo
Necesitamos 1-2 ciclos de cron para ver si el cambio ayuda.

---

## Rendimiento

### Actual (2026-09-23)
```
Level:    2
XP:       ~4,959 / 16,704 (30%)
Ritmo:    162 XP/h (antes del cambio)
Próximo level up: ~70+ horas
```

### Historia
- **Spawned:** 20-21 de septiembre de 2026
- **Primer reporte:** ~50-80 XP/h (muy lento)
- **Cambio:** 23/9 afternoon — overload threshold bajado
- **Esperado:** Ritmo debería mejorar en próximas corridas

### Proyecciones (post-cambio)
- **Si sube a 200+ XP/h:** Level 3 en ~80-85 horas (~3-4 días)
- **Sin mejora:** Level 3 en ~100+ horas

---

## Oportunidades

### 1. Shift a Otro Trabajo Mientras Espera
**Idea:** Mientras BB-8 espera en la cola de minería, ¿podría cambiar a tala (C-3PO) o crypto (R2)?

**Status:** Teórico. Requiere cambio de lógica en autopilot.

### 2. Múltiples Mineros
**Idea:** Crear otro miner para paralelizar la extracción.

**Status:** Requiere análisis de costo-beneficio (es worth?).

### 3. Vender a Merchant Diferente
**Idea:** ¿Hay otro merchant que compre ore a mejor ratio?

**Status:** Nunca verificado.

---

## Hipótesis Principales

1. **La cola es el verdadero bottleneck:** No el trabajo en sí.
2. **Sobrecarga es detectada por speed:** No excessWeight directo.
3. **El cambio ayudará:** Esperar 1-2 ciclos de cron para confirmación.

---

## Próximas Acciones

1. **Monitor en vivo:** Registrar el ritmo de BB-8 cada ciclo de cron
2. **Confirmación:** Si ritmo sube >15%, el cambio funcionó
3. **Deep dive:** Analizar logs de la cola (¿cuánto tiempo espera realmente?)
4. **Plan B:** Si no mejora, explorar shift a otro trabajo

---

**Última actualización:** 2026-09-23 (cambio overload threshold)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
