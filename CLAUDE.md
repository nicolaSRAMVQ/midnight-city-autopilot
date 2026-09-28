# Cuadrilla Midnight

Leé `PROYECTO.md` antes de hacer nada: es la fuente única de verdad (arquitectura,
estado, cómo desplegar, reglas del juego verificadas y pendientes).

- Respondé en castellano rioplatense.
- Todo se opera por la API del juego. No le pidas al dueño que haga cosas a mano
  en el juego, salvo lo que solo puede hacer el dueño (API key, transferencias,
  límite semanal, compras en la app).
- Un 200 no es un éxito: confirmá cada acción con su evento (`submitAndWait`)
  antes de reportarla como hecha.
- Nunca imprimas ni commitees tokens. El repo es público.
- Después de cambiar código: subí la versión en `api/version.js`, hacé rebase
  sobre `origin/main`, pusheá y desplegá a mano como indica `PROYECTO.md`.
  Verificá con `/api/version`.
- Cuando cambie algo importante (versión, estado, reglas aprendidas, pendientes),
  actualizá `PROYECTO.md` en el mismo commit.
- Verificá los datos del juego con `SKILL.md`, `references/` y
  `node scripts/mcity-control.mjs definition <tipo> <id>`, no con otras IAs.
