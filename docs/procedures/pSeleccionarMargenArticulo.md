# SP: pSeleccionarMargenArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarMargenArticulo
DESCRIPCION: Selecciona el articulo para obtener el margen
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarMargenArticulo] ( @sco_art CHAR(30) )
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
