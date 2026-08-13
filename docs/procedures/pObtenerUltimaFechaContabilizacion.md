# SP: pObtenerUltimaFechaContabilizacion
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:                 [pObtenerUltimaFechaContabilizacion]
DESCRIPCION:      Obtener la última fecha de contabilización
CREADO POR:       SOFTECH SISTEMAS
FECHA:                  26/04/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerUltimaFechaContabilizacion]
(
      @sInte_num CHAR(20) = NULL
)

AS 
    BEGIN
        SELECT
            ISNULL(MAX(fec_emis), CONVERT(SMALLDATETIME, '2001-01-01 00:00:00', 103)) AS fecha
        FROM
            saintegr
        WHERE
            CONVERT(SMALLDATETIME, feccom, 103) <> CONVERT(SMALLDATETIME, '2001-01-01 00:00:00', 103)
            AND numcom <> 0 and inte_num <> @sInte_num
    END
```
