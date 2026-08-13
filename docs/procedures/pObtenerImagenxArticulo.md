# SP: pObtenerImagenxArticulo
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtImagen`](../tables/saArtImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:			pObtenerImagenxArticulo
-- DESCRIPCIÓN:		Selecciona la imagen del articulo
-- AUTOR:			SOFTECH CONSULTORES
-- =============================================
CREATE PROCEDURE [dbo].[pObtenerImagenxArticulo]	
AS
	BEGIN
		
	DECLARE @documento BIT

	IF (SELECT COUNT(tip) FROM saArtImagen) = 0
		BEGIN												
			SET @documento = 0 
		END
	ELSE 
		BEGIN
			SET @documento = 1
		END

	SELECT
		@documento

	END
```
