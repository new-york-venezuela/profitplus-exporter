# SP: pSeleccionarProcedencia
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saProcedencia`](../tables/saProcedencia.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarProcedencia
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarProcedencia] ( @sCod_Proc CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saProcedencia
        WHERE
            coD_proc = @sCod_Proc
    END
```
