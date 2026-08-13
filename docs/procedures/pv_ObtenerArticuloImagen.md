# SP: pv_ObtenerArticuloImagen
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtImagen`](../tables/saArtImagen.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerArticuloImagen]
*DESCRIPCIÓN	:	OBTIENE LA IMAGEN ASOCIADA A UN ARTICULO DADO Y EL CODIGO DE LA IMAGEN TOMADO
					DESDE LA CONFIGURACION DE EMPRESA DE PUNTO DE VENTA 2.0
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerArticuloImagen]
    (
      @sCo_Art	CHAR(30) ,
      @sTip		CHAR(6)
    )
AS 
    BEGIN

	DECLARE @rowGuidArt UNIQUEIDENTIFIER  

	SET @rowGuidArt = (SELECT rowguid from saArticulo where co_art = @sCo_Art)

  --      SELECT
  --          co_art, tip, imagen_des, picture
		--FROM
  --          saArtImagen
  --      WHERE
  --          co_art = @sCo_Art AND tip = @sTip

	SELECT	
		@sCo_Art as co_art , co_imag , des_imag , picture

	FROM 
		saDocumentoImagen
	WHERE 
		rowguidDoc = @rowGuidArt AND co_imag = @sTip
		
    END
```
