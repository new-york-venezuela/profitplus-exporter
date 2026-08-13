# SP: pSeleccionarDescuentoProntoPago
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDescProntoPago`](../tables/saDescProntoPago.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarDescuentoProntoPago
DESCRIPCION: Seleccion de un registro de la tabla  dppago
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarDescuentoProntoPago] ( @sCo_Desc CHAR(6) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saDescProntoPago
        WHERE
            co_desc = @sCo_Desc

    END
```
