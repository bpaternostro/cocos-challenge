# Reglas de Negocio y Dominio (`docs/domain.md`)

Contexto funcional del exchange para agentes de IA y desarrolladores. Para especificaciones por endpoint, consultar `docs/specs/<feature>/spec.md`.

## 1. Glosario del Dominio
- **Moneda base (`ARS`):** Todos los precios, saldos, valuaciones y montos operan en pesos argentinos. El efectivo se modela en `instruments` como un instrumento de tipo `'MONEDA'`.
- **Activos operables:** Instrumentos de mercado (ej. `'ACCIONES'`) cotizados en la tabla `marketdata` (`close` como último precio; `previousClose` para retorno diario). No se admiten fracciones de acciones (`size` entero).
- **Órdenes (`orders`):**
  - `BUY` / `SELL`: compra o venta de activos operables.
  - `CASH_IN` / `CASH_OUT`: depósitos o extracciones de efectivo sobre el instrumento `'MONEDA'` (`type = MARKET`, `price = 1`).
  - `MARKET`: se ejecuta inmediatamente al último `close` de `marketdata` en estado `FILLED`.
  - `LIMIT`: requiere `price` explícito del usuario y se registra en estado `NEW`.
- **Estados de orden:** `NEW` (abierta con reserva), `FILLED` (ejecutada), `REJECTED` (rechazada por fondos o tenencia insuficiente), `CANCELLED` (cancelada desde `NEW`).

## 2. Invariantes Contables (No Negociables)
1. **Disponible para operar (`available`):** `qty - reservedQty` en `positions`. Nunca puede volverse negativo tras una operación válida.
2. **Reserva en órdenes `LIMIT` (`NEW`):**
   - `LIMIT BUY` reserva `size * price` en la posición `'MONEDA'` (ARS).
   - `LIMIT SELL` reserva `size` en la posición del activo.
   - Al pasar a `CANCELLED` o `REJECTED`, se libera `reservedQty`; al pasar a `FILLED`, se libera `reservedQty` y se liquida `qty` (y `avgCost` en compras).
3. **Órdenes rechazadas (`REJECTED`):** Si no hay saldo o tenencia suficiente al crear la orden, la orden se persiste con `status = 'REJECTED'` sin modificar `positions`.
4. **Costo promedio ponderado (`avgCost`):** En cada compra `FILLED`, `avgCost = ((qty * avgCost) + (size * price)) / (qty + size)`. Si una venta cierra la posición (`qty = 0`), `avgCost` se reinicia a `0`.
5. **Portafolio (`GET /api/portfolio/:userId`):**
   - Omite activos con `qty <= 0`.
   - `totalAccountValue = totalCash + sum(marketValue)` usando el último `close` de `marketdata` (o `avgCost` como respaldo si no hay `marketdata`).
   - `totalReturnPct = ((price - avgCost) / avgCost) * 100` (`0` si `avgCost = 0`).
