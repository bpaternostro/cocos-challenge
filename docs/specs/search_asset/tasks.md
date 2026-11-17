# Tareas: Búsqueda de Activos (`search_asset`)

- [x] **T1: Módulo `assets` (`GET /api/assets`) y tests funcionales**
  - **Descripción:** Implementar `src/modules/assets/assets.schema.js` (Zod para `query`, `type`, `limit` 1..100 default 20, `offset` >= 0 default 0), `assets.repository.js` (filtro `ILIKE`, exclusión por defecto de `'MONEDA'`, orden por `ticker ASC`, join con último `marketdata`), `assets.service.js` (cálculo de `dailyReturnPct` con `decimal.js`), `assets.controller.js`, `assets.routes.js` y montar en `src/app.js`. Escribir tests funcionales en `src/modules/assets/__tests__/assets.functional.test.js`.
  - **Cubre:** `RF-01`, `RF-02`, `RF-03`, `RF-04`, `RF-05`, `RF-06`.
  - **Hecho cuando:** Todos los tests funcionales de `assets` pasan (búsqueda por ticker/nombre, filtro por type, exclusión de MONEDA, paginación y validación 400).
