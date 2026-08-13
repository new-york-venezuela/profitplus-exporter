# SP: pSeleccionarArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarArticulo
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarArticulo] ( @sCo_Art CHAR(30) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saArticulo
        WHERE
            co_art = @sCo_Art
    END
```
