# Especificación: Creación y Cancelación de Órdenes (`create_order`)

## 1. Contexto y Objetivo
Permitir a un usuario enviar órdenes de compra (`BUY`), venta (`SELL`) y transferencias de efectivo (`CASH_IN`, `CASH_OUT`), así como cancelar órdenes abiertas (`NEW`), garantizando consistencia transaccional, reserva de saldo/tenencia, prevención de doble gasto e idempotencia.

## 2. Historias de Usuario
- **Como** usuario del exchange, **quiero** enviar órdenes `MARKET` o `LIMIT` indicando cantidad de acciones o monto en pesos, **para** operar activos financieros de forma segura y sin duplicados ante reintentos.
- **Como** usuario del exchange, **quiero** registrar ingresos (`CASH_IN`) y egresos (`CASH_OUT`) de pesos, **para** fondear o retirar dinero de mi cuenta.
- **Como** usuario del exchange, **quiero** cancelar una orden `LIMIT` pendiente (`NEW`), **para** liberar el saldo o las acciones reservadas.

## 3. Requisitos Funcionales (EARS)
- **RF-01 (Validación de entrada):** **Cuando** se envíe una solicitud de creación de orden, el sistema deberá validar que `userId`, `instrumentId`, `side`, `type` y exactamente uno entre `size` (entero positivo) o `amount` (monto en ARS positivo) sean válidos.
- **RF-02 (Idempotencia):** **Cuando** se envíe una solicitud de creación de orden con una clave de idempotencia (`Idempotency-Key` UUID v4) ya procesada previamente para el mismo usuario, el sistema deberá devolver la orden original sin crear una nueva ni alterar posiciones.
- **RF-03 (Cálculo por monto en pesos):** **Cuando** el usuario envíe `amount` en lugar de `size` para una orden `BUY` o `SELL`, el sistema deberá calcular `size = floor(amount / precioAplicable)`; **si** `size < 1`, **entonces** deberá rechazar la solicitud con error `400`.
- **RF-04 (Precio en órdenes MARKET y LIMIT):**
  - **Cuando** `type = MARKET` (`BUY` o `SELL`), el sistema deberá ignorar cualquier precio enviado (o prohibirlo) y utilizar el último precio `close` del instrumento en los datos de mercado.
  - **Cuando** `type = LIMIT` (`BUY` o `SELL`), el sistema deberá exigir un `price` positivo mayor a cero.
- **RF-05 (Ejecución de órdenes MARKET):** **Cuando** una orden `MARKET` (`BUY` o `SELL`) cumpla con el saldo o tenencia disponible, el sistema deberá guardarla en estado `FILLED` y actualizar la posición del usuario de forma atómica.
- **RF-06 (Registro de órdenes LIMIT y reserva):** **Cuando** una orden `LIMIT` (`BUY` o `SELL`) cumpla con el saldo o tenencia disponible, el sistema deberá guardarla en estado `NEW` y reservar el monto en ARS (`BUY`: `size * price`) o la cantidad de acciones (`SELL`: `size`) en la posición correspondiente.
- **RF-07 (Rechazo por fondos o tenencia insuficiente):** **Si** el usuario no posee pesos disponibles suficientes (en `BUY` o `CASH_OUT`) o acciones disponibles suficientes (en `SELL`), **entonces** el sistema deberá persistir la orden en estado `REJECTED` sin modificar las posiciones del usuario y devolver el detalle de la orden rechazada.
- **RF-08 (Transferencias `CASH_IN` y `CASH_OUT`):** **Cuando** `side` sea `CASH_IN` o `CASH_OUT` sobre el instrumento de tipo `'MONEDA'` (ARS), el sistema deberá procesarla como orden `MARKET` (`price = 1`), pasándola a `FILLED` si es válida (o `REJECTED` en `CASH_OUT` si excede el efectivo disponible) y actualizando el saldo en ARS.
- **RF-09 (Concurrencia / Doble gasto):** **Mientras** se procesa una orden para un usuario, el sistema deberá serializar las operaciones de dicho usuario de forma transaccional para impedir que solicitudes concurrentes gasten el mismo saldo o las mismas acciones dos veces.
- **RF-10 (Cancelación de órdenes `NEW`):** **Cuando** se solicite cancelar una orden existente en estado `NEW`, el sistema deberá cambiar su estado a `CANCELLED` y liberar la reserva de pesos o acciones correspondiente de forma atómica; **si** la orden no está en estado `NEW`, **entonces** deberá devolver error `409 Conflict`.

## 4. Casos Límite y Fuera de Alcance (Out of Scope)
- **Casos límite:**
  - Usuario o instrumento inexistente: devuelve `404` sin crear orden.
  - Instrumento sin datos de mercado para una orden `MARKET`: devuelve `422` / `400` indicando falta de cotización.
  - Envío simultáneo de `size` y `amount`, o ninguno de los dos: devuelve `400`.
  - Misma `Idempotency-Key` usada por el mismo usuario: devuelve la orden previamente creada (`200` o `201` consistente).
- **Fuera de alcance:**
  - Motor de matching de órdenes `LIMIT` (transición automática de `NEW` a `FILLED`).
  - Colas de mensajería externas (RabbitMQ) o API externa de mercado.
  - Órdenes fraccionarias.

## 5. Criterios de Finalización (Definition of Done)
- Todos los `RF-01` a `RF-10` validados con tests unitarios y test funcional/integración contra PostgreSQL real (incluyendo orden `FILLED`, `NEW`, `REJECTED`, `CANCELLED` e idempotencia).
- Cero condiciones de carrera en validaciones de saldo.
- Endpoints documentados en la colección de Postman.
