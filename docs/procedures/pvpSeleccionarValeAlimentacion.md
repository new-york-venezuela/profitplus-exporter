# SP: pvpSeleccionarValeAlimentacion
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)

## Código (excerpt)
```sql
/**************************************************************************************
*NOMBRE			: pvpSeleccionarValeAlimentacion
*DESCRIPCIÓN	: Selecciona un Vale de Alimentacion de Punto de Venta según su código
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************************/ 
CREATE PROCEDURE [dbo].[pvpSeleccionarValeAlimentacion] ( @sCo_Vale CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            pvValeAlimentacion
        WHERE
            co_Vale = @sCo_Vale
    END
```
