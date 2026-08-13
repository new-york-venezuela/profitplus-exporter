# SP: pvpSeleccionarTurno
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurno`](../tables/pvTurno.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpSeleccionarTurno
*DESCRIPCIÓN	: Selecciona un turno Punto de Venta
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/ 
CREATE PROCEDURE [dbo].[pvpSeleccionarTurno] ( @sCo_Turno CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            pvTurno
        WHERE
            co_Turno = @sCo_Turno
    END
```
