# cocos-challenge-backend

API REST en Node.js + Express + PostgreSQL para gestión de portafolios, búsqueda de activos financieros y envío/cancelación de órdenes de mercado.

---

## Stack Tecnológico

- **Runtime & Framework:** Node.js 20+ (ESM), Express.js
- **Base de datos & ORM:** PostgreSQL + Sequelize (transacciones ACID, locks pesimistas `FOR UPDATE`, SQL nativo para consultas analíticas)
- **Validación & Seguridad:** Zod, Helmet, CORS, Express Rate Limit
- **Precisión financiera:** `decimal.js` sobre columnas `NUMERIC` en PostgreSQL
- **Observabilidad:** Pino (logs estructurados JSON con `X-Request-Id`)
- **Testing:** Jest + Supertest (unitarios y funcionales contra PostgreSQL real)

---

## Arquitectura

Arquitectura modular por funcionalidades en **3 capas** (`src/modules/{portfolio,assets,orders}`):
- `*.routes.js` + `*.schema.js`: definición de endpoints y validación estricta con Zod.
- `*.controller.js`: manejo HTTP (`req`/`res`), envuelto en `asyncHandler`.
- `*.service.js` + `*.calculator.js`: reglas de negocio, transacciones ACID y aritmética decimal.
- `*.repository.js`: acceso a datos (Sequelize / SQL parametrizado) sin lógica de negocio.

---

## Cómo levantar el proyecto

### Opción A: Con Docker (recomendado para evaluación)
1. Colocar el archivo `.env` en la raíz del proyecto.
2. Levantar la API en Docker (ejecuta migraciones automáticamente al iniciar y se conecta a la DB configurada en `.env`):

```bash
make docker-up
make docker-logs   # ver logs de la API
make docker-down   # detener contenedores
```

La API queda disponible en `http://localhost:3000`.

### Opción B: Local con Node.js (DB local o remota en Neon)
1. Instalar dependencias y crear `.env`:
   ```bash
   make setup
   ```
2. Configurar `DATABASE_URL` (y `TEST_DATABASE_URL` si vas a correr tests funcionales) en `.env`.
3. Ejecutar migraciones (crea tabla `positions`, columna `idempotencykey`, índices y backfill inicial):
   ```bash
   make migrate
   ```
4. Iniciar servidor:
   ```bash
   make dev     # desarrollo con --watch
   make start   # producción
   ```

---

## Endpoints

### 1. Healthcheck
`GET /health`  
Verifica el estado del servicio y la conexión a PostgreSQL (`200 OK` / `503 Service Unavailable`).

### 2. Obtener Portfolio
`GET /api/portfolio/:userId`

Devuelve el resumen consolidado de la cuenta en ARS:
- `totalAccountValue`: efectivo total en ARS + valor de mercado de posiciones activas (`qty > 0`).
- `totalCash`, `availableCash`, `reservedCash`: saldo en ARS consolidado, disponible para operar y reservado en órdenes `LIMIT` abiertas (`NEW`).
- `assets`: listado de activos con `qty > 0`, `price` (último `close` de `marketdata`), `marketValue` y `totalReturnPct` sobre costo promedio ponderado (`avgCost`).

### 3. Buscar Activos
`GET /api/assets?query=PAMP&type=ACCIONES&limit=20&offset=0`

- `query` *(opcional)*: búsqueda parcial case-insensitive por `ticker` o `name`.
- `queries` *(opcional)*: múltiples términos separados por coma para búsqueda parcial (ej. `queries=galicia,ypf`, máx. 20).
- `tickers` *(opcional)*: lista de tickers exactos separados por coma (ej. `tickers=GGAL,YPFD`, máx. 50).
- `type` *(opcional)*: filtra por tipo de instrumento. Por defecto excluye `'MONEDA'`, salvo que se envíe `type=MONEDA`.
- `limit` *(default `20`, máx `100`)* y `offset` *(default `0`)*.
- Devuelve `{ data, pagination: { total, limit, offset } }` incluyendo último `close` y `dailyReturnPct`.

### 4. Enviar Orden
`POST /api/orders`  
Header opcional recomendado: `Idempotency-Key: <uuid-v4>`

```json
{
  "userId": 1,
  "instrumentId": 47,
  "side": "BUY",
  "type": "MARKET",
  "amount": 5000
}
```

- `side`: `BUY` | `SELL` | `CASH_IN` | `CASH_OUT`
- `type`: `MARKET` | `LIMIT` (`CASH_IN`/`CASH_OUT` operan como `MARKET` sobre `'MONEDA'`)
- Cantidad: enviar **exactamente uno** entre `size` (entero positivo) o `amount` (monto en ARS; calcula `floor(amount / precio)`). Si `amount` no alcanza para 1 unidad, responde `400`.
- `price`: obligatorio y positivo en `LIMIT`; prohibido en `MARKET` (usa el último `close` de `marketdata`).
- Estados resultantes:
  - `FILLED`: órdenes `MARKET` válidas.
  - `NEW`: órdenes `LIMIT` válidas (reservan saldo en ARS o acciones en `positions.reservedqty`).
  - `REJECTED`: fondos o tenencia insuficiente (se persiste en `orders` sin alterar `positions`).

### 5. Cancelar Orden `LIMIT`
`PATCH /api/orders/:orderId/cancel`

Cancela una orden en estado `NEW` (`status -> CANCELLED`) y libera atómicamente el saldo o acciones reservadas. Si la orden no está en estado `NEW`, responde `409 Conflict`.

### 6. Gestionar Estado de Orden `LIMIT`
`PATCH /api/orders/:orderId/status`

```json
{
  "status": "FILLED"
}
```

Permite transicionar una orden en estado `NEW` hacia `FILLED` (ejecuta y liquida posiciones), `CANCELLED` o `REJECTED` (libera reservas). Responde `409 Conflict` si la orden no está en estado `NEW`.

### 7. Listar Órdenes de un Usuario
`GET /api/orders?userId=1&status=FILLED&side=BUY&limit=20&offset=0`

- `userId` *(obligatorio)*: identificador del usuario (`404` si no existe).
- `status` *(opcional)*: `NEW` | `FILLED` | `REJECTED` | `CANCELLED`.
- `side` *(opcional)*: `BUY` | `SELL` | `CASH_IN` | `CASH_OUT`.
- `limit` *(default `20`, máx `100`)* y `offset` *(default `0`)*.

---

## Decisiones Técnicas y Supuestos

1. **Tabla materializada transaccional `positions`:** En lugar de escanear toda la tabla `orders` en cada lectura de portfolio, `positions(userid, instrumentid, qty, reservedqty, avgcost, updatedat)` se actualiza atómicamente dentro de la misma transacción ACID que `orders`. La migración realiza *backfill* automático desde `orders` si `positions` está vacía.
2. **Prevención de *double-spending*:** Todo envío o cancelación de orden adquiere un bloqueo pesimista por usuario (`SELECT ... FROM users WHERE id = :userId FOR UPDATE`) dentro de la transacción para serializar operaciones concurrentes.
3. **Reserva en órdenes `LIMIT` (`NEW`):** Las órdenes `LIMIT` abiertas bloquean el saldo en ARS (`BUY`) o acciones (`SELL`) sobre lo disponible (`qty - reservedqty`), evitando comprometer los mismos fondos en múltiples órdenes simultáneas.
4. **Idempotencia:** Soportada vía header `Idempotency-Key` (UUID v4 generado por el cliente) con índice único parcial `(userid, idempotencykey)` y verificación de hash SHA-256 del payload (`422` si se reutiliza la clave con distinto cuerpo).
5. **Precisión numérica:** Todos los cálculos monetarios y porcentuales utilizan `decimal.js` para evitar errores de punto flotante IEEE 754.
6. **Rendimiento porcentual:** Se calcula sobre costo promedio ponderado (`((close - avgCost) / avgCost) * 100`), omitiendo posiciones cerradas (`qty = 0`).
7. **Documentación extendida:** Ver [justificaciones.md](docs/review/justificaciones.md) (decisiones de arquitectura, Zod, diagramas Mermaid/UML) y [fuera-de-challenge.md](docs/review/fuera-de-challenge.md).

---

## Funcionalidades Agregadas Fuera del Alcance Base

Además de los 3 endpoints y el test funcional solicitados en [challenge.md](docs/challenge.md), se incorporaron las siguientes capacidades orientadas a calidad productiva:

- **Endpoints adicionales:**
  - `GET /health`: healthcheck con verificación de conectividad a PostgreSQL.
  - `GET /api/orders`: historial paginado de órdenes por usuario con filtros por `status` y `side`.
  - `PATCH /api/orders/:orderId/cancel`: cancelación de órdenes `LIMIT` en estado `NEW` con liberación atómica de reservas.
  - `PATCH /api/orders/:orderId/status`: transición de órdenes `NEW` a `FILLED`, `CANCELLED` o `REJECTED` (simula ejecución/rechazo de órdenes límite liquidando posiciones en `positions`).
- **Extensiones de búsqueda y contrato:**
  - Búsqueda múltiple por `queries` (términos parciales) y `tickers` (lista exacta) en `GET /api/assets`.
  - Campo explícito `currency: "ARS"` en activos y portafolio mediante constante centralizada (`BASE_CURRENCY`).
- **Consistencia, concurrencia e idempotencia:**
  - Tabla materializada `positions` actualizada en la misma transacción ACID que `orders` (con *backfill* automático en `migrate.js`).
  - Bloqueo pesimista `SELECT ... FOR UPDATE` por usuario para prevenir *double-spending*.
  - Reserva de saldo/acciones para órdenes `LIMIT` abiertas (`NEW`).
  - Idempotencia con `Idempotency-Key` (UUID v4) y hash SHA-256 del payload (`422` ante colisión con distinto cuerpo).
- **Seguridad, testing y operación:**
  - Validación estricta con Zod (sin coerción booleana en JSON body, límites alineados a `INT` y `NUMERIC(10,2)`/`NUMERIC(18,2)`), escape de comodines `ILIKE` (`%`, `_`, `\`), `helmet`, `cors`, `express-rate-limit` y logs estructurados Pino con `X-Request-Id`.
  - Suite completa de **27 tests** (unitarios + funcionales con `Supertest` contra PostgreSQL real) y colección Postman de **36 requests** agrupados por endpoint con aserciones `pm.test(...)`.
  - Empaquetado Docker (`Dockerfile`, `compose.yaml` con soporte para `.env` remoto y perfil opcional `local-db`) y `makefile`.

---

## Fuera de Scope (Evolución para Producción)

Por simplicidad y foco en los requisitos del challenge, los siguientes componentes quedaron intencionalmente **fuera de alcance**, aunque forman parte de la arquitectura esperada en un exchange productivo a escala:

- **Gestión de Telemetría (OpenTelemetry):** Emisión estandarizada de trazas distribuidas (`trace_id`), métricas RED (*Rate, Errors, Duration*) e instrumentación de queries SQL y transacciones, correlacionadas con los logs estructurados de Pino.
- **Observabilidad con Datadog:** Centralización de telemetría (APM, dashboards de negocio, alertas sobre latencia p95/p99, tasa de errores `5xx`, contención de locks `FOR UPDATE` en PostgreSQL y picos de órdenes `REJECTED`).
- **Streams de Datos con Persistencia para Analítica:** Captura de eventos de órdenes y uso de API (vía CDC con Debezium o *event streaming*) hacia un almacenamiento analítico OLAP (ClickHouse, BigQuery o Data Lake con Parquet/DuckDB) para auditoría financiera, reportes regulatorios y BI sin degradar la base transaccional OLTP.
- **Tópicos y Consumers para Gestión de Órdenes con el Mercado:** Desacoplamiento de **todas las órdenes enviadas al mercado (`MARKET` y `LIMIT`)** hacia BYMA / Matba Rofex (vía gateway FIX/DMA) mediante colas/tópicos (Kafka o RabbitMQ) aplicando el **Outbox Pattern** (garantizando consistencia entre PostgreSQL y la publicación del evento), *consumers* idempotentes para procesar *Execution Reports* (`FILLED`, `PARTIALLY_FILLED`, `REJECTED`), *Dead Letter Queues* (DLQ) y TTL de expiración en reintentos de órdenes `MARKET` para evitar *slippage* tardío.

---

## Testing

- **Tests unitarios** (sin DB):
  ```bash
  make test-unit
  ```
- **Tests funcionales** (solo integración HTTP + PostgreSQL de test):
  ```bash
  make test-functional
  ```
- **Suite completa (unitarios + funcionales con Supertest):**
  Requiere configurar `TEST_DATABASE_URL` en `.env` apuntando a una base PostgreSQL **dedicada exclusivamente a tests** (los tests funcionales ejecutan `TRUNCATE` entre casos y bloquean la ejecución si `TEST_DATABASE_URL` coincide con `DATABASE_URL`).
  ```bash
  make test
  ```

---

## Colección de Postman

Importar [cocos-challenge.postman_collection.json](docs/postman/cocos-challenge.postman_collection.json) en Postman. Incluye variables de colección y scripts `pm.test(...)` para validar cada endpoint de punta a punta.

---

## Contexto para Agentes de IA

El repositorio incluye un archivo de contexto multi-harness en la raíz:
- [AGENTS.md](AGENTS.md): estándar leído por Codex, Gemini CLI/Antigravity, Cursor y otros harnesses con arquitectura, reglas de negocio/seguridad y comandos de verificación.
- [CLAUDE.md](CLAUDE.md): referencia directa (`@AGENTS.md`) para Claude Code manteniendo una única fuente de verdad sin duplicar instrucciones.
- [docs/domain.md](docs/domain.md): glosario financiero, reglas de negocio e invariantes contables del dominio (cargado bajo demanda desde `AGENTS.md`).
