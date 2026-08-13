# SP: pSeleccionarCategoriaArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saCatArticulo`](../tables/saCatArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarColor
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarCategoriaArticulo] ( @sCo_Cat CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saCatArticulo
        WHERE
            co_cat = @sCo_Cat
    END
```
