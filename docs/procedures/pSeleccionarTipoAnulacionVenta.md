# SP: pSeleccionarTipoAnulacionVenta
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoAnulacionVenta`](../tables/saTipoAnulacionVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pSeleccionarTipoAnulacionVenta
DESCRIPCION:	Selecciona un registro de la tabla saTipoAnulacionVenta segun su primaryKey
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarTipoAnulacionVenta] ( @sCo_Anulacion CHAR(4) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saTipoAnulacionVenta
        WHERE
           co_anulacion = @sCo_Anulacion
    END
```
