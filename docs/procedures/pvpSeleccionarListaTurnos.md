# SP: pvpSeleccionarListaTurnos
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurnoExe`](../tables/pvTurnoExe.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pvpSeleccionarListaTurnos
*DESCRIPCIÓN	: Selecciona una lista de turnos de Punto de Venta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 
CREATE PROCEDURE [dbo].[pvpSeleccionarListaTurnos]
AS 
    BEGIN
        SELECT
            *
        FROM
            pvTurnoExe
    END
```
