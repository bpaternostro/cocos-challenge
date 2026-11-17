# Tareas: Obtener Portfolio (`get_portfolio`)

- [x] **T1: Bootstrap del proyecto, configuración, modelos base y migración de esquema**
  - **Descripción:** Inicializar `package.json` (`"type": "module"`), dependencias (`express`, `sequelize`, `pg`, `pg-hstore`, `zod`, `pino`, `pino-http`, `helmet`, `cors`, `express-rate-limit`, `decimal.js`, `dotenv`, `jest`, `supertest`), `.env.example`, `src/config/env.js`, `src/config/database.js`, `src/utils/` (`AppError.js`, `asyncHandler.js`, `logger.js`), `src/middlewares/` (`validate.js`, `errorHandler.js`, `requestId.js`), `src/db/models/` (`user.model.js`, `instrument.model.js`, `order.model.js`, `marketdata.model.js`, `position.model.js`, `index.js`), script SQL/migración para `positions`, `orders.idempotencykey` e índices, y `src/app.js` + `src/server.js` con `/health`.
  - **Cubre:** Infraestructura base y `constitution.md`.
  - **Hecho cuando:** `npm test` corre sin errores de configuración y `src/app.js` exporta la app Express.

- [x] **T2: Lógica pura de cálculo de portfolio y tests unitarios**
  - **Descripción:** Implementar `src/modules/portfolio/portfolio.calculator.js` usando `decimal.js` para calcular `availableCash`, `totalCash`, `reservedCash`, `marketValue`, `totalReturnPct` (con guard `avgCost = 0` y fallback de precio) y `totalAccountValue`. Escribir tests unitarios en `src/modules/portfolio/__tests__/portfolio.calculator.test.js`.
  - **Cubre:** `RF-05`, `RF-06`, `RF-07`, `RF-08`.
  - **Hecho cuando:** Los tests unitarios de `portfolio.calculator.test.js` pasan al 100%.

- [ ] **T3: Endpoint `GET /api/portfolio/:userId` (repository, service, controller, routes, schema) y tests funcionales**
  - **Descripción:** Implementar `portfolio.schema.js`, `portfolio.repository.js` (consulta sin N+1 con último `marketdata.close`), `portfolio.service.js`, `portfolio.controller.js`, `portfolio.routes.js` y montar en `src/app.js`. Escribir tests funcionales en `src/modules/portfolio/__tests__/portfolio.functional.test.js`.
  - **Cubre:** `RF-01`, `RF-02`, `RF-03`, `RF-04`, `RF-07`.
  - **Hecho cuando:** Todos los tests unitarios y funcionales de `portfolio` pasan.
