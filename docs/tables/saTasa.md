# Tabla: saTasa
**Módulo**: Configuración (Multimoneda)
**Descripción de Negocio**: Historial de tasas de cambio por moneda. Registra la tasa de compra (`tasa_c`) y venta (`tasa_v`) para cada moneda en cada fecha. Es la fuente de conversión Bs↔USD para todos los cálculos multimoneda. Para indexar montos históricos a USD, siempre usar la tasa del documento (`saFacturaVenta.tasa`), NO la tasa actual.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_mone` | char | NOT NULL | Código de moneda (PK con fecha) | FK → `saMoneda.co_mone` |
| `fecha` | smalldatetime | NOT NULL | Fecha de vigencia de la tasa | PK (con co_mone) |
| `tasa_c` | decimal | NULL | Tasa de compra (Bs por unidad de moneda extranjera) | — |
| `tasa_v` | decimal | NULL | Tasa de venta (Bs por unidad de moneda extranjera) | — |

## Recetario SQL de Negocio
```sql
-- Tasa USD más reciente
SELECT TOP 1 co_mone, fecha, tasa_c, tasa_v
FROM saTasa
WHERE co_mone = 'USD'
ORDER BY fecha DESC;

-- Evolución de la tasa USD en el año
SELECT co_mone, CAST(fecha AS DATE) AS fecha_dia,
       tasa_c, tasa_v
FROM saTasa
WHERE co_mone = 'USD' AND YEAR(fecha) = 2024
ORDER BY fecha;

-- Tasa vigente en una fecha específica
SELECT TOP 1 tasa_v
FROM saTasa
WHERE co_mone = 'USD' AND fecha <= '2024-06-30'
ORDER BY fecha DESC;
```
