# Plan Técnico: Obtener Portfolio (`get_portfolio`)

## 1. Estructura de Archivos y Módulos
- `src/db/models/`
  - `user.model.js`, `instrument.model.js`, `marketdata.model.js`, `position.model.js` (con mapeo `field:` a columnas en minúsculas de PostgreSQL).
- `src/modules/portfolio/`
  - `portfolio.routes.js`: `GET /api/portfolio/:userId`
  - `portfolio.schema.js`: validación Zod de `params.userId` (entero positivo).
  - `portfolio.controller.js`: `asyncHandler`, extrae `userId`, invoca al servicio y responde `200`.
  - `portfolio.service.js`: orquesta verificación de usuario, lectura de posiciones + última cotización y cálculo financiero con `decimal.js`.
  - `portfolio.repository.js`: consultas Sequelize / SQL para usuario, posiciones activas (`qty > 0` o instrumento `'MONEDA'`) y último registro de `marketdata` por `instrumentid` (evitando N+1).
- `src/modules/portfolio/__tests__/`
  - `portfolio.calculator.test.js` (unitario: rendimiento, valuación, `avgCost = 0`).
  - `portfolio.functional.test.js` (integración HTTP con Supertest + PostgreSQL de test).

## 2. Modelo de Datos y Esquema
- **Tablas existentes (`sample-db.sql`):**
  - `users` (`id`, `email`, `accountnumber`)
  - `instruments` (`id`, `ticker`, `name`, `type`)
  - `marketdata` (`id`, `instrumentid`, `high`, `low`, `open`, `close`, `previousclose`, `date`)
- **Tabla nueva (`positions`):**
  - `userid` (INT, FK `users.id`), `instrumentid` (INT, FK `instruments.id`), `qty` (`NUMERIC(18,4)` o `INT` para acciones / `NUMERIC(18,2)` para ARS — usar `NUMERIC(18,2)` unificado), `reservedqty` (`NUMERIC(18,2)`), `avgcost` (`NUMERIC(18,4)`), `updatedat` (`TIMESTAMP`).
  - Clave primaria compuesta `(userid, instrumentid)`.
  - Índice en `marketdata(instrumentid, date DESC)` para obtener el último `close` en O(1) con `DISTINCT ON (instrumentid)` o lateral join.

## 3. Decisiones Técnicas y Flujo Algorítmico
1. Validar `userId` con Zod (`400` si no es entero positivo o supera `PG_INT_MAX = 2147483647`).
2. Verificar existencia de `user` en `users`; si no existe, lanzar `AppError(404, 'User not found')` (`RF-02`).
3. Obtener en una sola consulta las filas de `positions` del usuario junto con `instruments` y el último `marketdata.close` (por `date DESC, id DESC`).
4. Separar la posición cuyo `instrument.type === INSTRUMENT_TYPES.CURRENCY` (`'MONEDA'`):
   - `totalCash = Decimal(pos.qty)` (0 si no tiene fila aún).
   - `reservedCash = Decimal(pos.reservedqty)`.
   - `availableCash = totalCash.minus(reservedCash)`.
5. Para el resto de instrumentos con `qty > 0` (`RF-03`, `RF-04`), incluir `currency: BASE_CURRENCY` (`'ARS'` de `src/config/constants.js`):
   - `currentPrice = marketClose ? Decimal(marketClose) : Decimal(pos.avgcost)` (`RF-08`).
   - `marketValue = Decimal(pos.qty).times(currentPrice)`.
   - `totalReturnPct = Decimal(pos.avgcost).gt(0) ? currentPrice.minus(pos.avgcost).div(pos.avgcost).times(100) : Decimal(0)` (`RF-05`).
6. `totalAccountValue = totalCash.plus(sum(marketValue))` (`RF-06`) y devolver `currency: BASE_CURRENCY` en el resumen.
7. Formatear montos a 2 decimales (`toFixed(2)`) como números/strings consistentes en JSON.

## 4. Estrategia de Testing
- **Unitarios (`portfolio.calculator.test.js`):** Cubren `RF-05`, `RF-06`, `RF-07`, `RF-08` y caso borde `avgCost = 0`.
- **Funcionales (`portfolio.functional.test.js`):** Cubren `RF-01` (usuario con efectivo y acciones), `RF-02` (`404` usuario inexistente), `RF-03`/`RF-04` (omisión de `qty = 0`) y `RF-07` (descuento de efectivo reservado por orden `LIMIT NEW`).
