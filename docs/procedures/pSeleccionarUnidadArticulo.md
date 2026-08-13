# SP: pSeleccionarUnidadArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarUnidadArticulo] ( @sCo_Art CHAR(30) )
AS 
    BEGIN

        SELECT
            saArtUnidad.* , saUnidad.des_uni descripcion_unidad, case when relacion = 0 then equivalencia else 1.0/equivalencia end as relacionConvertida 
        FROM
            saArtUnidad , saUnidad  
        WHERE
            co_art = @sCo_Art and
            saArtUnidad.co_uni    = saUnidad.co_uni 

    END
```
