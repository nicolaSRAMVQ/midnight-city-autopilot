# Informe final: experimento de entrenamiento (3 al 10 de octubre de 2026)

**Ganadora: fase D, "solo turno diario".** Ya quedó aplicada como regla vigente desde el 10/10 03:00 UTC (fase E en la base, mismas reglas que D). Se puede cambiar en un minuto.

## Qué se probó

| Fase | Regla | Horas |
|---|---|---|
| Antes | Sin entrenamiento (27/9 al 3/10) | 136 |
| A | Entrena cada vez que el puesto se llena, sin pausa | 47 |
| B | Igual que A, con 3 h de pausa entre entrenamientos | 36 |
| C | Skills secundarias con tope en nivel 5 (en la práctica casi no entrenaron: ya estaban arriba de 5) | 36 |
| D | Un solo turno de entrenamiento por día | 36 |

## Resultados por droide (por hora)

**Crystals ganados**

| | Antes | A | B | C | D |
|---|---|---|---|---|---|
| R2 | 179 | 33 | 290 | 1.380 | 954 |
| BB-8 | 77 | 25 | 62 | 310 | 262 |
| C-3PO | 44 | 14 | 18 | 36 | 35 |

**XP de la profesión principal**

| | Antes | A | B | C | D |
|---|---|---|---|---|---|
| R2 (hacking) | 1.334 | 55 | 2.098 | 24.270 | 22.649 |
| BB-8 (minería) | 1.765 | 33 | 1.285 | 15.306 | 18.460 |
| C-3PO (leña) | 20.180 | 11.435 | 12.343 | 25.702 | 24.843 |

**XP de skills secundarias:** A 5.500 a 6.700 (R2 y BB-8), B 3.200 a 3.700, C casi 0, **D 800 a 1.600**.

Tiempo dormido: 0 a 4 % en todas las fases (antes del experimento era 12 a 17 %).

## Qué significa

1. **Entrenar sin freno (A) es muy caro.** R2 y BB-8 casi dejaron de trabajar en lo suyo: la XP principal cayó más de 95 % y los crystals, a una fracción. La pausa de 3 h (B) mejora, pero sigue lejos.
2. **El costo no es lo que se gasta, es lo que se deja de ganar.** Entrenar consume solo 3 a 6 crystals por hora; la pérdida es el tiempo que el droide no trabaja en su profesión.
3. **D casi no cuesta nada contra C y suma skills.** Con un turno por día se mantiene 93 a 100 % de la XP principal y entre 70 y 98 % de los crystals, y las secundarias siguen subiendo (800 a 1.600 XP por hora).
4. **R2 es el que más resigna:** gana 954 crystals por hora en D contra 1.380 en C. Pero R2 cobra por tandas (vende de a lotes), así que en ventanas de 36 h el número salta mucho. No lo tomaría como definitivo.

## Recomendación

- **Dejar D como regla** (ya aplicada como fase E).
- **Volver a mirar R2 en una semana.** Si sigue ganando cerca de 30 % menos que sin entrenar, sacarlo del turno diario: su objetivo es llegar a Hacking 21 para usar el decodificador, y para eso importa la XP principal, no las secundarias.
- No volver a A ni a B.

## Lo más débil de este análisis

- Cada fase corrió una sola vez y en orden: los niveles subieron durante la semana, así que las fases del final (C y D) arrancan con droides más fuertes. Por eso comparo D contra C, que son vecinas, y no contra "antes".
- Las ventas de R2 son por lotes y meten mucho ruido en 36 h.
- A mitad de la fase D (9/10 02:31 UTC) cambié el momento en que se renueva el control para cortar los errores de Telegram. Tuvo que mejorar el trabajo, no empeorarlo, pero es un cambio adentro de la fase.

Datos: `midnight_experiment_summary()` en Supabase y `logs/*.jsonl` del repo para el "antes".
