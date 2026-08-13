# SP: pSeleccionarDescuentoCategoria
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saDescCategoria`](../tables/saDescCategoria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarDescuentoCategoria
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS.
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarDescuentoCategoria] ( @sCo_Desc CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saDescCategoria
        WHERE
            co_desc = @sCo_Desc
    END
```
