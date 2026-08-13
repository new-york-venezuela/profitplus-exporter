# SP: pSeleccionarTipoPrecio
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pSeleccionarTipoPrecio
DESCRIPCION:	Selecciona un registro de la tabla saTipoPrecio segun su primaryKey
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTipoPrecio] ( @sCo_Precio CHAR(6) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saTipoPrecio
        WHERE
            co_precio = @sCo_Precio

    END
```
