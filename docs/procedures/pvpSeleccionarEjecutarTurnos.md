# SP: pvpSeleccionarEjecutarTurnos
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurnoExe`](../tables/pvTurnoExe.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpSeleccionarEjecutarTurnos
*DESCRIPCIÓN	: Obtiene el detalle de un turno dado
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pvpSeleccionarEjecutarTurnos] 
(
	@sNum_Turno CHAR (20) 
)
AS 
    BEGIN
        SELECT
            *
        FROM
            pvTurnoExe
        WHERE
            Num_Turno = @sNum_Turno
    END
```
