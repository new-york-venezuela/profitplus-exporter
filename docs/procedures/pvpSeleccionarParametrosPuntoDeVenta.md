# SP: pvpSeleccionarParametrosPuntoDeVenta
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvParEmp`](../tables/pvParEmp.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpSeleccionarParametrosPuntoDeVenta
*DESCRIPCIÓN	: Seleccionar Parametros de Punto De Venta
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/ 
CREATE PROCEDURE [dbo].[pvpSeleccionarParametrosPuntoDeVenta] ( @sCod_Emp Char(20) )
AS 
    BEGIN
        SELECT
            *
        FROM
            pvParEmp
        WHERE
            cod_emp = @sCod_Emp
    END
```
