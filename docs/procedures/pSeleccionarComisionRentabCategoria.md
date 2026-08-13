# SP: pSeleccionarComisionRentabCategoria
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionRentabCategoria`](../tables/saComisionRentabCategoria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarComisionRentabCategoria
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarComisionRentabCategoria] ( @sCo_Comir CHAR(6) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saComisionRentabCategoria
        WHERE
            co_comir = @sCo_Comir
    END
```
