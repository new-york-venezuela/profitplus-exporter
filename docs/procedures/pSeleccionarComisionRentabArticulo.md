# SP: pSeleccionarComisionRentabArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saComisionRentabArticulo`](../tables/saComisionRentabArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarComisionRentabArticulo
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarComisionRentabArticulo] ( @sCo_Comir CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saComisionRentabArticulo
        WHERE
            co_comir = @sCo_Comir
    END
```
