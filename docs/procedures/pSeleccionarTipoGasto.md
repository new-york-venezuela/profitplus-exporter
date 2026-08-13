# SP: pSeleccionarTipoGasto
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoGasto`](../tables/saTipoGasto.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pSeleccionarTipoGasto
DESCRIPCION:	Selecciona un registro de la tabla saTipoGasto segun su primaryKey
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarTipoGasto] ( @sCo_Gasto CHAR(4) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saTipoGasto
        WHERE
           co_gasto = @sCo_Gasto
    END
```
