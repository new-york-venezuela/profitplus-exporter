# SP: pSeleccionarRenglonesCompuesto
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesCompuesto
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesCompuesto] ( @sCo_ArtC CHAR(20) )
AS 
    BEGIN
        SELECT
            c.*, a.relac_unidad, a.art_des AS Descripcion, a.rowguid AS RowGuid_Articulo
        FROM
            saArtCompuestoReng c
            INNER JOIN saArticulo a ON c.co_art = a.co_art
			INNER JOIN saArtCompuesto b ON  c.co_artc = b.co_artc
        WHERE
            b.co_artc = @sCo_ArtC
        ORDER BY
            reng_num ASC
    END
```
