# SP: pObtenerCantidadImagenArticulo
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtImagen`](../tables/saArtImagen.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:					[pObtenerCantidadImagenArticulo]
DESCRIPCION:			OBTIENE LA CANTIDAD DE IMAGENES ASIGNADAS A UN ARTICULO
CREADO POR:				SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerCantidadImagenArticulo]
(
	@sCoArt CHAR(30)
)
AS 
    BEGIN
       SELECT SUM (cantidad) from ( 
			SELECT COUNT(co_art) cantidad FROM saArtImagen WHERE co_art = @sCoArt
			UNION ALL 
			SELECT COUNT(co_art) FROM saArticulo A
			INNER JOIN saDocumentoImagen DI ON DI.rowguidDoc = A.rowguid
			WHERE co_art = @sCoArt ) as a 
    END
```
