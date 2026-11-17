# Summary
Desarrollar un endpoint (`GET /api/portfolio/:userId`) que permita obtener el estado consolidado del portafolio de un usuario: valor total de la cuenta en ARS, efectivo total, efectivo disponible para operar, efectivo reservado en órdenes `LIMIT` (`NEW`) y el listado de activos con `qty > 0` (cantidad de acciones, valor monetario total en ARS y rendimiento porcentual total).

# Decisiones técnicas y de dominio
- Las transferencias entrantes y salientes se modelan como órdenes (`CASH_IN` / `CASH_OUT`) sobre el instrumento `'MONEDA'` (ARS).
- Las posiciones se leen desde la tabla materializada transaccional `positions(userid, instrumentid, qty, reservedqty, avgcost, updatedat)`, actualizada atómicamente en cada orden (`orders`).
- El efectivo disponible para operar se calcula como `qty - reservedqty` de la posición `'MONEDA'`.
- El rendimiento porcentual de cada activo se calcula sobre el costo promedio ponderado (`((close - avgcost) / avgcost) * 100`), omitiendo activos con `qty = 0`.
- Todos los cálculos monetarios usan `decimal.js`.
