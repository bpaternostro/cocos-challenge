# AGENTS.md — `cocos-challenge-backend`

Guía de contexto para agentes de programación (Codex, Gemini, Claude, Cursor).

## Stack y Arquitectura
- **Runtime:** Node.js 20+ (ES Modules `"type": "module"`), Express.js, PostgreSQL + Sequelize.
- **Estructura modular en 3 capas (`src/modules/{portfolio,assets,orders}`):**
  - `*.routes.js` + `*.schema.js` (validación Zod en frontera HTTP).
  - `*.controller.js` (envuelto en `asyncHandler`, sin lógica de negocio).
  - `*.service.js` + `*.calculator.js` (reglas de negocio, transacciones ACID y `decimal.js`).
  - `*.repository.js` (acceso a datos Sequelize / SQL parametrizado).
- **Punto de entrada:** `src/app.js` (exporta `createApp()` sin `listen`) y `src/server.js` (levanta HTTP + Graceful Shutdown).
- **Contexto de negocio:** Para glosario financiero, invariantes contables y reglas de dominio, leer `docs/domain.md` y `docs/specs/<feature>/spec.md` antes de modificar lógica de negocio.

## Reglas Innegociables
1. **Validación:** Todo `params`, `query`, `body` y `headers` debe validarse con Zod (`src/middlewares/validate.js`) respetando los límites de PostgreSQL (`PG_INT_MAX = 2147483647`, `price <= 99999999.99`, `MAX_ORDER_TOTAL = 9999999999999`).
2. **Transacciones y Concurrencia:** Toda creación o transición de órdenes corre dentro de `sequelize.transaction` con `SELECT ... FROM users WHERE id = :userId FOR UPDATE` y actualiza `positions` atómicamente.
3. **Precisión numérica:** Usar `decimal.js` para toda aritmética monetaria o porcentual; nunca `Number` flotante en cálculos.
4. **Seguridad y Logs:** Prohibido `console.log` en `src/` (usar `logger` de Pino en `src/utils/logger.js`). Escapar comodines `ILIKE` (`%`, `_`, `\`) y parametrizar todo SQL con `replacements`. Nunca commitear `.env` ni credenciales.
5. **Testing:** Los tests funcionales (`*.functional.test.js`) ejecutan `TRUNCATE` y requieren `TEST_DATABASE_URL` distinta de `DATABASE_URL` (guarda en `src/test/testDbHelper.js`).

## Comandos Útiles
- `make lint` (`npm run lint`) — ESLint sobre `src/`.
- `make test-unit` (`npm run test:unit`) — Tests unitarios puros (sin DB).
- `make test` (`npm test`) — Suite completa (unitarios + funcionales; requiere `TEST_DATABASE_URL`).
- `make migrate` — Ejecuta `src/db/migrate.js`.
- `make docker-up` / `make docker-down` — Levanta/detiene la API en Docker usando `.env`.
