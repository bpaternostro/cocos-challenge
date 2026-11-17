# Summary
Crear un endpoint (`GET /api/assets`) de búsqueda que acepte criterios de consulta y liste activos financieros de la tabla `instruments` (`docs/sample-db.sql`), enriquecidos con su último precio de cierre (`close`) y retorno diario porcentual desde `marketdata`.

# Decisiones técnicas
- Permite filtrar por `query` (búsqueda parcial case-insensitive por `ticker` y/o `name`) y por `type`.
- Por defecto excluye instrumentos de tipo `'MONEDA'`, salvo que se envíe explícitamente `type=MONEDA`.
- Sin Redis ni caché externa: consultas indexadas directamente sobre PostgreSQL.
- Soporta paginación mediante `limit` (default `20`, máximo `100`) y `offset` (default `0`), devolviendo `{ data, pagination: { total, limit, offset } }`.
