# SP: pSeleccionarPrecioArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarPrecioArticulo
DESCRIPCION: Selecciona el articulo para obtener el precio
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarPrecioArticulo] ( @sco_art CHAR(30) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saArticulo
        WHERE
            co_art = @sco_art
        ORDER BY
            co_art ASC

    END
```
