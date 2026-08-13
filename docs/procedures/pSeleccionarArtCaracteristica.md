# SP: pSeleccionarArtCaracteristica
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarArtCaracteristica] ( @sCo_Art CHAR(30) )
AS 
    BEGIN

        SELECT
            saArtCaracteristica.* , saLineaArticulo.lin_des descripcion_linea
        FROM
            saArtCaracteristica , saLineaArticulo 
        WHERE
            co_art = @sCo_Art and
            saArtCaracteristica.co_lin01	= saLineaArticulo.co_lin

    END
```
