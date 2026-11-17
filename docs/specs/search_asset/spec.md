# Especificación: Búsqueda de Activos (`search_asset`)

## 1. Contexto y Objetivo
Permitir buscar y listar activos financieros disponibles en el mercado filtrando por ticker, nombre y/o tipo de instrumento, con soporte de paginación y referencia de su último precio de mercado.

## 2. Historias de Usuario
- **Como** usuario del exchange, **quiero** buscar activos por su ticker, nombre o tipo, **para** encontrar rápidamente los instrumentos disponibles antes de enviar una orden.

## 3. Requisitos Funcionales (EARS)
- **RF-01 (Búsqueda por texto y múltiple):** **Cuando** se envíe un criterio textual (`query`) o una lista de términos (`queries`), el sistema deberá devolver los activos cuyo `ticker` o `name` coincidan de forma parcial e insensible a mayúsculas/minúsculas (escapando comodines literal `%`, `_` y `\`). **Donde** se envíe una lista exacta de tickers (`tickers`), deberá filtrar por coincidencia exacta insensible a mayúsculas/minúsculas.
- **RF-02 (Filtro por tipo):** **Donde** se especifique un filtro de tipo de instrumento (`type`), el sistema deberá restringir los resultados únicamente a los activos de ese tipo.
- **RF-03 (Exclusión de moneda por defecto):** **Cuando** no se especifique explícitamente el filtro `type=MONEDA`, el sistema deberá excluir los instrumentos de tipo `'MONEDA'` del listado de activos operables.
- **RF-04 (Listado sin filtro textual):** **Cuando** no se envíe el parámetro `query`, el sistema deberá devolver el listado paginado de activos operables ordenados alfabéticamente por `ticker`.
- **RF-05 (Paginación y límites):** El sistema deberá soportar parámetros de paginación (`limit` y `offset`) con valores por defecto seguros (`limit = 20`, máximo `100`, `offset = 0`, máx. `2147483647`) y devolver metadatos de paginación (`total`, `limit`, `offset`).
- **RF-06 (Información de mercado en resultado):** El sistema deberá incluir para cada activo su identificador, `ticker`, `name`, `type`, `currency: "ARS"`, último precio de cierre (`close`) y retorno diario porcentual (`((close - previousClose) / previousClose) * 100`) cuando exista información de mercado.

## 4. Casos Límite y Fuera de Alcance (Out of Scope)
- **Casos límite:**
  - Búsqueda sin coincidencias: devuelve lista vacía `[]` y `total: 0` con estado HTTP `200`.
  - Parámetros de paginación inválidos (negativos, no numéricos o `limit > 100`): devuelve error de validación `400`.
  - Activo sin registros en datos de mercado: `close` y retorno diario se devuelven como `null`.
- **Fuera de alcance:**
  - Caché distribuida externa (Redis).
  - Búsqueda fuzzy avanzada o motores de búsqueda externos (Elasticsearch).
  - Cotizaciones en tiempo real vía WebSockets.

## 5. Criterios de Finalización (Definition of Done)
- Todos los `RF-01` a `RF-06` validados mediante tests automatizados.
- Validación estricta de query params con respuestas `400` claras ante entradas inválidas.
- Endpoint documentado en la colección de Postman.
