# SP: pObtenerDocumentoImagenxArticulo
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:			pObtenerDocumentoImagenxArticulo
-- DESCRIPCIÓN:		Selecciona la imagen del documento articulo
-- AUTOR:			SOFTECH CONSULTORES
-- =============================================
CREATE PROCEDURE [dbo].[pObtenerDocumentoImagenxArticulo]	
AS
	BEGIN
		
	DECLARE @documento BIT

	IF (SELECT COUNT(co_tipo_doc) FROM saDocumentoImagen
		  WHERE co_tipo_doc = 'ARTIC') = 0
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
