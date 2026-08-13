# SP: pSeleccionarRenglonesMargenArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtMargen`](../tables/saArtMargen.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesMargenArticulo
DESCRIPCION: Selecciona los margenes de un articulo de acuerdo a su codigo
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesMargenArticulo] ( @sco_art CHAR(30) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saArtMargen
        WHERE
            co_art = @sco_art
        ORDER BY
            co_art ASC, co_precio ASC

    END
```
