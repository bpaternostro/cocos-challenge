# Tareas: Creación y Cancelación de Órdenes (`create_order`)

- [x] **T1: Lógica pura de órdenes (cálculo de `size` desde `amount` y `avgCost` ponderado) y tests unitarios**
  - **Descripción:** Implementar `src/modules/orders/orders.calculator.js` usando `decimal.js` para `calculateOrderSizeFromAmount` (`Math.floor(amount / price)`) y `calculateWeightedAvgCost`. Escribir tests unitarios en `src/modules/orders/__tests__/orders.calculator.test.js`.
  - **Cubre:** `RF-03`, `RF-05`.
  - **Hecho cuando:** Los tests unitarios de `orders.calculator.test.js` pasan al 100%.

- [ ] **T2: Endpoints `POST /api/orders` y `PATCH /api/orders/:orderId/cancel` (transacciones ACID, locks, idempotencia) y tests funcionales**
  - **Descripción:** Implementar `orders.schema.js` (validación Zod incluyendo `Idempotency-Key` UUID v4 y XOR `size`/`amount`), `orders.repository.js` (`FOR UPDATE` sobre usuario, check idempotencia, upsert atómico en `positions`), `orders.service.js`, `orders.controller.js`, `orders.routes.js` y montar en `src/app.js`. Escribir tests funcionales en `src/modules/orders/__tests__/orders.functional.test.js` cubriendo `CASH_IN`, `CASH_OUT`, `MARKET`, `LIMIT`, `REJECTED`, `CANCELLED`, idempotencia y concurrencia.
  - **Cubre:** `RF-01`, `RF-02`, `RF-03`, `RF-04`, `RF-05`, `RF-06`, `RF-07`, `RF-08`, `RF-09`, `RF-10`.
  - **Hecho cuando:** Todos los tests unitarios y funcionales de `orders` pasan al 100%.
