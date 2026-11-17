# Plan Técnico: Creación y Cancelación de Órdenes (`create_order`)

## 1. Estructura de Archivos y Módulos
- `src/db/models/`
  - `order.model.js` (mapeo a `orders` incluyendo nueva columna `idempotencykey`), `position.model.js`.
- `src/modules/orders/`
  - `orders.routes.js`:
    - `GET /api/orders`
    - `POST /api/orders`
    - `PATCH /api/orders/:orderId/cancel`
    - `PATCH /api/orders/:orderId/status`
  - `orders.schema.js`: validación Zod para headers (`Idempotency-Key` UUID v4 opcional), body de `POST /orders` (sin coerción en `userId`/`instrumentId`, límites `PG_INT_MAX = 2147483647`, `price <= 99999999.99`, `MAX_ORDER_TOTAL = 9999999999999`, XOR estricto entre `size` y `amount`), `PATCH /status`, `PATCH /cancel` y `GET /orders`.
  - `orders.controller.js`: `asyncHandler`, extrae payload + `idempotencyKey`, delega al servicio y devuelve `201` (nueva orden) o `200` (idempotente repetida / cancelación).
  - `orders.service.js`: ejecuta toda la lógica dentro de `sequelize.transaction` con lock pesimista, cálculos en `decimal.js`, actualización atómica de `orders` y `positions`.
  - `orders.repository.js`: operaciones transaccionales sobre `users` (`LOCK.UPDATE`), `instruments`, `marketdata`, `orders` y `positions`.
- `src/modules/orders/__tests__/`
  - `orders.calculator.test.js` (unitario: `floor(amount / price)`, `avgCost` ponderado).
  - `orders.functional.test.js` (integración HTTP con Supertest + PostgreSQL real: `FILLED`, `NEW`, `REJECTED`, `CANCELLED`, idempotencia y concurrencia).

## 2. Modelo de Datos y Esquema
- **Alteración sobre `orders` (`sample-db.sql`):**
  - Agregar columnas `idempotencykey VARCHAR(36) NULL` e `idempotencyhash VARCHAR(64) NULL`.
  - Índice único parcial: `CREATE UNIQUE INDEX uq_orders_user_idempotency ON orders(userid, idempotencykey) WHERE idempotencykey IS NOT NULL;`
  - Índice de consulta: `CREATE INDEX idx_orders_user_status ON orders(userid, status);`
- **Tabla `positions`:**
  - `(userid, instrumentid)` PK, `qty NUMERIC(18,2) NOT NULL DEFAULT 0`, `reservedqty NUMERIC(18,2) NOT NULL DEFAULT 0`, `avgcost NUMERIC(18,4) NOT NULL DEFAULT 0`, `updatedat TIMESTAMP NOT NULL DEFAULT NOW()`.

## 3. Decisiones Técnicas y Flujo Algorítmico

### Flujo `POST /api/orders` (dentro de `sequelize.transaction`)
1. **Lock de usuario (`RF-09`):** `SELECT id FROM users WHERE id = :userId FOR UPDATE`. Si no existe -> `404`.
2. **Check de idempotencia (`RF-02`):** Si viene `Idempotency-Key`, buscar en `orders` por `(userid, idempotencykey)`. Si existe, devolverla inmediatamente (`200`) sin modificar nada.
3. **Validar instrumento:** Buscar en `instruments` por `instrumentId`. Si no existe -> `404`.
4. **Resolver precio aplicable (`RF-04`, `RF-08`):**
   - Si `side` es `CASH_IN` o `CASH_OUT`: exigir `instrument.type === 'MONEDA'` (si no -> `400`), forzar `type = 'MARKET'`, `price = 1`.
   - Si `type === 'MARKET'` (`BUY`/`SELL`): obtener último `marketdata.close`. Si no existe -> `422`.
   - Si `type === 'LIMIT'` (`BUY`/`SELL`): usar `body.price`.
5. **Resolver `size` (`RF-03`):**
   - Si viene `size`: usarlo (entero `>= 1`).
   - Si viene `amount`: `size = Math.floor(Decimal(amount).div(price).toNumber())`. Si `size < 1` -> lanzar `AppError(400, 'Amount is insufficient to buy/sell at least 1 unit')`.
6. **Validar disponibilidad (`RF-05`, `RF-06`, `RF-07`, `RF-08`):**
   - Obtener/bloquear filas de `positions` del usuario para el instrumento `'MONEDA'` (ARS) y para `instrumentId`.
   - `availableCash = Decimal(arsPos.qty).minus(arsPos.reservedqty)`.
   - `availableShares = Decimal(assetPos.qty).minus(assetPos.reservedqty)`.
   - Reglas:
     - `BUY`: requiere `availableCash >= Decimal(size).times(price)`.
     - `SELL`: requiere `availableShares >= Decimal(size)`.
     - `CASH_OUT`: requiere `availableCash >= Decimal(size)`.
     - `CASH_IN`: siempre válido.
   - Si **no cumple** -> insertar en `orders` con `status = 'REJECTED'` (y `idempotencykey`), hacer `COMMIT` y devolver la orden `REJECTED` (`201`).
7. **Aplicar estado y actualizar `positions`:**
   - Si `type === 'MARKET'` (`BUY`, `SELL`, `CASH_IN`, `CASH_OUT`):
     - `status = 'FILLED'`.
     - `BUY`: `arsPos.qty -= size * price`; en `assetPos`: recalcular `avgcost = ((qty * avgcost) + (size * price)) / (qty + size)` y `assetPos.qty += size`.
     - `SELL`: `arsPos.qty += size * price`; `assetPos.qty -= size` (si `qty === 0`, `avgcost = 0`).
     - `CASH_IN`: `arsPos.qty += size`.
     - `CASH_OUT`: `arsPos.qty -= size`.
   - Si `type === 'LIMIT'` (`BUY` / `SELL`):
     - `status = 'NEW'`.
     - `BUY`: `arsPos.reservedqty += size * price`.
     - `SELL`: `assetPos.reservedqty += size`.
8. Insertar orden en `orders` y hacer `COMMIT`.

### Flujo `PATCH /api/orders/:orderId/cancel` (`RF-10`)
1. Iniciar transacción, buscar orden por `id`; si no existe -> `404`.
2. Adquirir lock sobre usuario (`users FOR UPDATE`). Releer orden; si `status !== 'NEW'` -> `409 Conflict`.
3. Cambiar `order.status = 'CANCELLED'`.
4. Liberar reserva en `positions`:
   - Si `BUY`: `arsPos.reservedqty -= order.size * order.price`.
   - Si `SELL`: `assetPos.reservedqty -= order.size`.
5. `COMMIT` y devolver orden actualizada (`200`).

## 4. Estrategia de Testing
- **Unitarios (`orders.calculator.test.js`):** Cálculo de `size` desde `amount` (`RF-03`), cálculo de `avgCost` ponderado.
- **Funcionales (`orders.functional.test.js`):**
  - `RF-01`/`RF-04`: errores `400` de validación.
  - `RF-02`: reintento con mismo `Idempotency-Key` no duplica orden ni saldo.
  - `RF-05`/`RF-08`: `CASH_IN` -> `MARKET BUY` (`FILLED`) -> `MARKET SELL` (`FILLED`) -> `CASH_OUT`.
  - `RF-06`/`RF-10`: `LIMIT BUY`/`SELL` (`NEW` reserva saldo/acciones) y `PATCH /cancel` libera reserva.
  - `RF-07`: orden por monto superior al disponible se guarda como `REJECTED` sin alterar `positions`.
  - `RF-09`: dos `POST /orders` concurrentes con `Promise.all` donde solo uno tiene saldo suficiente -> uno `FILLED` y el otro `REJECTED` (cero saldo negativo).
