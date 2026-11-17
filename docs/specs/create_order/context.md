# Summary
Crear endpoints para generar órdenes de compra/venta y transferencias (`POST /api/orders`) y cancelar órdenes límite abiertas (`PATCH /api/orders/:orderId/cancel`).

# Definiciones técnicas
- Idempotencia obligatoria/soportada en `POST /api/orders` mediante header `Idempotency-Key` (UUID v4), persistido en `orders.idempotencykey` con índice único parcial `(userid, idempotencykey)`.
- Sin RabbitMQ ni API externa de mercado: ejecución síncrona dentro de una transacción ACID en PostgreSQL con bloqueo pesimista por usuario (`SELECT ... FROM users WHERE id = :userId FOR UPDATE`) y precios tomados de `marketdata.close`.
- Aritmética financiera con `decimal.js` y `NUMERIC` en PostgreSQL.

# Comportamiento
- Soporta `BUY`, `SELL`, `CASH_IN` y `CASH_OUT`.
- Para `BUY`/`SELL` soporta `MARKET` (ejecuta inmediato a `marketdata.close` como `FILLED`) y `LIMIT` (requiere `price`, queda en estado `NEW` y reserva saldo en ARS o acciones en `positions.reservedqty`).
- Acepta `size` (entero) o `amount` (monto en ARS, calculando `floor(amount / price)`; si es `< 1` devuelve `400`).
- Si excede el disponible (`qty - reservedqty`), la orden se persiste en estado `REJECTED` sin alterar `positions`.
- Solo las órdenes en estado `NEW` pueden cancelarse (`CANCELLED`), liberando la reserva en `positions`.
