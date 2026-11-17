# Plan Técnico: Búsqueda de Activos (`search_asset`)

## 1. Estructura de Archivos y Módulos
- `src/modules/assets/`
  - `assets.routes.js`: `GET /api/assets`
  - `assets.schema.js`: validación Zod de query params (`query`, `type`, `limit`, `offset`).
  - `assets.controller.js`: `asyncHandler`, parsea query validada, invoca servicio y responde `200` con resultados y paginación.
  - `assets.service.js`: aplica reglas de filtro por defecto (exclusión de `'MONEDA'` si no se pide explícitamente) y calcula retorno diario con `decimal.js`.
  - `assets.repository.js`: consulta SQL/Sequelize optimizada sobre `instruments` + último `marketdata` por instrumento con `COUNT(*) OVER()` o `findAndCountAll`.
- `src/modules/assets/__tests__/`
  - `assets.functional.test.js` (integración HTTP con Supertest + PostgreSQL de test).

## 2. Modelo de Datos y Esquema
- **Tablas existentes (`sample-db.sql`):**
  - `instruments` (`id`, `ticker`, `name`, `type`)
  - `marketdata` (`id`, `instrumentid`, `close`, `previousclose`, `date`)
- **Índices recomendados:**
  - `CREATE INDEX idx_instruments_type_ticker ON instruments(type, ticker);`
  - `CREATE INDEX idx_marketdata_instrument_date ON marketdata(instrumentid, date DESC, id DESC);`

## 3. Decisiones Técnicas y Flujo Algorítmico
1. Validar query params con Zod (`RF-05`):
   - `query`: string opcional trimmeado (1..100 chars).
   - `queries`: lista separada por coma opcional (1..20 ítems, máx. 100 chars c/u).
   - `tickers`: lista separada por coma opcional (1..50 ítems, máx. 20 chars c/u).
   - `type`: string opcional (`ACCIONES`, `MONEDA`, etc., máx. 10 chars).
   - `limit`: entero `1..100` (default `20`).
   - `offset`: entero `0..2147483647` (default `0`).
2. Construcción de filtros en repositorio (escapando `%`, `_`, `\` con `escapeLikePattern` para `ILIKE`):
   - Si `query` está presente: `(ticker ILIKE '%query%' OR name ILIKE '%query%')` (`RF-01`).
   - Si `queries` está presente: `(ticker ILIKE ANY(ARRAY[:queryPatterns]) OR name ILIKE ANY(ARRAY[:queryPatterns]))` (`RF-01`).
   - Si `tickers` está presente: `UPPER(ticker) = ANY(ARRAY[:upperTickers])` (`RF-01`).
   - Si `type` está presente: `UPPER(type) = UPPER(:type)` (`RF-02`).
   - Si `type` NO está presente: `type <> 'MONEDA'` (`RF-03`).
3. Ordenar por `ticker ASC`, aplicar `LIMIT` y `OFFSET` (`RF-04`, `RF-05`).
4. Enriquecer cada instrumento con `currency: BASE_CURRENCY` (`'ARS'`) y su último `marketdata` (`close`, `previousclose`):
   - Si existe `close` y `previousclose > 0`: `dailyReturnPct = Decimal(close).minus(previousclose).div(previousclose).times(100).toFixed(2)` (`RF-06`).
   - Si no existe `marketdata`: `close: null`, `dailyReturnPct: null`.
5. Devolver `{ data: [...], pagination: { total, limit, offset } }`.

## 4. Estrategia de Testing
- **Funcionales (`assets.functional.test.js`):**
  - `RF-01`: búsqueda parcial case-insensitive por ticker y por nombre.
  - `RF-02` / `RF-03`: exclusión de `'MONEDA'` por defecto e inclusión cuando `type=MONEDA`.
  - `RF-04` / `RF-05`: listado paginado ordenado por `ticker`, límites por defecto y rechazo `400` con `limit > 100` o negativos.
  - `RF-06`: cálculo correcto de `close` y `dailyReturnPct` (y `null` cuando no hay `marketdata`).
