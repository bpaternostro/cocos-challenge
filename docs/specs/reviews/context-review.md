# Review Técnico de `docs/context.md` vs `docs/challenge.md`

Este documento resume los riesgos, contradicciones y decisiones pendientes detectadas al contrastar [context.md](./context.md) con [challenge.md](./challenge.md).  
Puedes dejar tus respuestas o decisiones directamente en los bloques **`> Tu anotación:`** de cada sección.

---

## 1. Crítico (Seguridad): Credenciales reales expuestas

- **Hallazgo:** En `docs/context.md` (línea 31) figura una connection string real de Neon PostgreSQL con usuario y password en texto plano (`postgresql://neondb_owner:...@ep-snowy-lab-be4h42cz-pooler...`).
- **Riesgo:** Si se sube a GitHub para la entrevista, expone acceso owner a la base de datos. Además, contradice el uso de Postgres local en Docker (`docker_compose`). 
- **Acción recomendada:**
  - Rotar la contraseña en Neon.
  - Eliminar la URL de `docs/context.md` (y limpiar historial de git si ya fue commiteada). 
  - Usar `.env` (ignorado en `.gitignore`) + `.env.example`.

> **Tu anotación:**
> **`> no vamos a utilizar una imagen de docker, para las keys vamos a utilizar un .env q no vamos a subir al repositorio:`**
> **`> este documento no se va a subir al repositorio:`**
---

## 2. Alcance y Sobre-ingeniería (YAGNI / KISS)

`docs/challenge.md` solicita 3 endpoints (portfolio, búsqueda de activos, envío de orden), 1 test funcional de envío de orden y opcionalmente una colección de Postman. `docs/context.md` agrega infraestructura que no responde a requisitos del challenge:

| Componente en `context.md` | Riesgo / Problema técnico | Alternativa recomendada |
| :--- | :--- | :--- |
| **DuckDB** (streaming de eventos de uso) | Es una DB embebida con lock de escritura por archivo; streamear eventos bajo concurrencia desde Express genera contención o exige un worker aparte. Además duplica la tabla `audit` de Postgres. | Eliminar DuckDB. Si se requiere auditoría/logs de uso, usar **Pino** (logs estructurados JSON). |
| **OpenTelemetry** | Agrega boilerplate de instrumentación sin collector/backend (Jaeger/Prometheus) definido en el stack. | Eliminar OTel SDK o dejar solo `requestId` + Pino logging. |
| **Redis** | Cachear portfolio o saldos introduce riesgo de *stale data* e invalidación compleja al ejecutar órdenes. Para `marketdata` (2 días) y búsqueda de activos, los índices en Postgres alcanzan. | Eliminar Redis salvo justificación explícita de lectura masiva de `marketdata`. |
| **Tablas extra (`risk_profiles`, `audit`)** | No tienen endpoints ni reglas funcionales en `challenge.md`. | Eliminarlas para no mantener código muerto o sin tests. |

> **Tu anotación:**
> **`> quitemos todos estos componentes`**

---

## 3. Contradicciones en el Modelo de Datos (`orders` vs `portfolio` / `portfolio_assets`)

- **Doble fuente de verdad:** `challenge.md` indica calcular tenencia, pesos disponibles, valor de mercado y rendimiento a partir de los movimientos de `orders` (`FILLED` y columna `size`). `context.md` agrega `portfolio` y `portfolio_assets`.
- **Campos faltantes / ambiguos en `context.md`:**
  - `portfolio` (`id, creationDate, updatedAt`) **no tiene `userId`**.
  - `portfolio_assets` (`instrumentId, qty, purchasePrice, sellPrice, purchaseDate, sellDate`) **no tiene `userId` ni `portfolioId`**, y un único `purchasePrice` / `sellPrice` no modela múltiples compras/ventas parciales a distintos precios.
- **Opciones:**
  - **Opción A (Recomendada por simplicidad y consistencia):** Calcular el portfolio desde `orders` con índices compuestos en `(userId, status, instrumentId)`. Una sola fuente de verdad.
  - **Opción B (Tabla materializada para performance):** Reemplazar `portfolio` + `portfolio_assets` por `positions(userId, instrumentId, qty, avgCost, updatedAt)` actualizada atómicamente dentro de la **misma transacción** que el `INSERT` en `orders`.

> **Tu anotación:**
> **`> vamos con la opcion B`**

---

## 4. Huecos Técnicos y Reglas de Dominio a Definir

### 4.1. Concurrencia / Double-Spending en órdenes
- **Problema:** Si un usuario con $1.000 ARS envía dos `POST /orders` de $1.000 en paralelo, ambas requests pueden leer $1.000 disponibles y ejecutarse como `FILLED`, dejando saldo negativo.
- **Solución:** Ejecutar la validación + creación de orden dentro de una transacción ACID serializada por usuario (`SELECT ... FROM users WHERE id = :userId FOR UPDATE` o `pg_advisory_xact_lock(userId)`).

> **Tu anotación:**
> **`> q es una transaccion acid?`**

### 4.2. Reserva de saldo/tenencia en órdenes `LIMIT` (`NEW`)
- **Pregunta de negocio:** Cuando una orden `LIMIT` queda en estado `NEW`, ¿bloquea/descuenta los pesos disponibles (en `BUY`) o las acciones disponibles (en `SELL`) mientras no sea `FILLED` o `CANCELLED`?
- **Recomendación:** Sí reservar saldo/tenencia para órdenes `NEW` al calcular *disponible para operar* (aunque el valor de mercado y rendimiento de la cuenta siga usando solo `FILLED`). Documentar esta decisión en el README.

> **Tu anotación:**
> **`> reservar saldo`**

### 4.3. Precisión Numérica en Dinero
- **Problema:** JS usa `float` (IEEE 754) y Sequelize devuelve columnas `DECIMAL`/`NUMERIC` como `string`.
- **Recomendación:** Usar `NUMERIC` en Postgres y `decimal.js` (o `big.js`) en la capa de dominio para evitar errores de redondeo en montos y rendimientos.

> **Tu anotación:**
> **`> ok `**

### 4.4. Estrategia de Acceso a Datos y Testing
- **ORM:** En `context.md` figura `sequilize` (Sequelize). Es válido si ya lo dominas, pero requiere cuidar transacciones, locks y evitar N+1. Alternativa: `pg` directo o Drizzle/Prisma.
- **Tests:** `context.md` menciona solo unitarias con Jest, pero `challenge.md` pide **un test funcional sobre el envío de orden**. Se recomienda Jest + Supertest contra una DB Postgres real de test (vía Docker) además de tests unitarios para la lógica de cálculo.

> **Tu anotación:**
> **`> cual es la diferencia entre sequelize o las opciones q propones? no se puede mantener simple con sequelize?`**

---

## 5. Checklist de Decisiones Finales

- [usar .env] Rotar y eliminar credenciales de Neon de `docs/context.md`.
- [quitar] Definir stack final (recortar Redis / DuckDB / OTel o justificar por qué se quedan).
- [B] Definir estrategia de portfolio: derivado de `orders` (Opción A) vs tabla `positions` transaccional (Opción B).
- [OK] Confirmar regla de reserva de saldo/acciones para órdenes `LIMIT` en estado `NEW`.
- [OK] Confirmar inclusión de test funcional con DB real además de unitarios.

> **Comentarios generales:**
> **`armemos un documento en docs/review/justificaciones.md que vamos a ir actualizando donde detallamos los justificativos de las decisiones tecnicas`**
