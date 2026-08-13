# SP: pSeleccionarComisionPrecioCategoria
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionPrecioCategoria`](../tables/saComisionPrecioCategoria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarComisionPrecioCategoria
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarComisionPrecioCategoria] ( @sCo_Comip CHAR(6) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saComisionPrecioCategoria
        WHERE
            co_comip = @sCo_Comip
    END
```
