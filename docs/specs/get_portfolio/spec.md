# Especificación: Obtener Portfolio (`get_portfolio`)

## 1. Contexto y Objetivo
Permitir consultar el estado consolidado de la cuenta de un usuario: valor total de la cuenta en pesos argentinos (ARS), pesos disponibles para operar, pesos reservados en órdenes abiertas y el listado de activos financieros que posee con su cantidad, valor de mercado y rendimiento porcentual.

## 2. Historias de Usuario
- **Como** usuario del exchange, **quiero** consultar el resumen de mi portafolio, **para** conocer mi saldo disponible en pesos, el valor total de mi cuenta y la composición y rendimiento de mis inversiones.

## 3. Requisitos Funcionales (EARS)
- **RF-01 (Consulta de portafolio):** **Cuando** se solicite el portafolio de un usuario existente, el sistema deberá devolver el valor total de la cuenta en ARS, el efectivo total en ARS, el efectivo disponible para operar en ARS, el efectivo reservado en órdenes de compra abiertas y el listado de posiciones activas.
- **RF-02 (Usuario inexistente):** **Si** el identificador de usuario solicitado no existe, **entonces** el sistema deberá responder con un error de recurso no encontrado (`404`).
- **RF-03 (Posiciones activas):** **Mientras** un usuario tenga posiciones consolidadas con cantidad mayor a cero (`qty > 0`), el sistema deberá incluir cada activo con su identificador, ticker, nombre, cantidad de acciones, último precio de mercado (`close`), valor monetario total de la posición (`qty * close`) y rendimiento total porcentual.
- **RF-04 (Omisión de posiciones cerradas):** **Cuando** un usuario haya vendido la totalidad de un activo (`qty = 0`), el sistema deberá omitir dicho activo del listado de posiciones del portafolio.
- **RF-05 (Cálculo de rendimiento):** El sistema deberá calcular el rendimiento total porcentual de cada posición sobre su costo promedio ponderado de adquisición (`((close - avgCost) / avgCost) * 100`).
- **RF-06 (Cálculo de valor total de cuenta):** El sistema deberá calcular el valor total de la cuenta como la suma del efectivo total en ARS (disponible + reservado en órdenes de compra abiertas) más la sumatoria del valor monetario de mercado de todas sus posiciones activas.
- **RF-07 (Efectivo disponible vs reservado):** El sistema deberá calcular el efectivo disponible para operar descontando del efectivo consolidado en ARS los montos reservados en órdenes de compra `LIMIT` en estado `NEW`.
- **RF-08 (Precio de valuación):** El sistema deberá valuar cada activo utilizando el precio de cierre (`close`) más reciente disponible en los datos de mercado; **si** un activo no posee datos de mercado registrados, **entonces** el sistema deberá utilizar su costo promedio (`avgCost`) como respaldo para evitar fallos de lectura.

## 4. Casos Límite y Fuera de Alcance (Out of Scope)
- **Casos límite:**
  - Usuario existente sin movimientos ni efectivo: debe devolver valor total `0`, efectivo disponible `0` y listado de activos vacío (`[]`).
  - Usuario con efectivo en ARS pero sin activos: devuelve el saldo en ARS y listado de activos vacío (`[]`).
  - `avgCost = 0`: el rendimiento porcentual debe devolverse como `0` sin producir división por cero.
- **Fuera de alcance:**
  - Autenticación y autorización de usuarios.
  - Historial temporal de evolución del portafolio o gráficos.
  - Conversión a monedas extranjeras (todo se expresa en ARS).

## 5. Criterios de Finalización (Definition of Done)
- Todos los `RF-01` a `RF-08` validados mediante tests unitarios y funcionales contra base de datos de test.
- Precisión decimal garantizada en todos los cálculos monetarios y porcentuales.
- Respuesta validada y documentada en la colección de Postman.
