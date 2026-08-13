# SP: RepArticuloImagen
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtImagen`](../tables/saArtImagen.md)
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[RepArticuloImagen]
	-- Parámetros -------------
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
	@sCo_Linea_d CHAR(6) = NULL ,
	@sCo_Linea_h CHAR(6) = NULL ,
	@sCo_Cat_d CHAR(6) = NULL ,
	@sCo_Cat_h CHAR(6) = NULL ,
	@sCo_Color_d CHAR(6) = NULL ,
	@sCo_Color_h CHAR(6) = NULL ,
	@sCo_Almacen CHAR(6) = NULL ,
	@sCo_NivelStock CHAR(4) = NULL ,
	@sCo_Img CHAR(6) = NULL ,
	@sCo_Precio01 CHAR(6) = NULL,
	@dCo_FechaVigencia DATETIME = NULL ,
	@sCo_Inactivo CHAR(4) = NULL,
    @sParametroBarra CHAR(3) = NULL,
	----- Parametros por Defecto -----
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
	----------------------------------
AS 
    BEGIN
        SET NOCOUNT ON ;


/*********Valores por defecto*********/
IF @sParametroBarra IS NULL 
	SET @sParametroBarra = 'RAR'

IF @sCo_NivelStock IS NULL 
    SET @sCo_NivelStock = 'TODO'

IF(@sCo_Precio01 IS NULL)
	RAISERROR('Debe seleccionar un Tipo de Precio',16,1)

IF @dCo_FechaVigencia IS NOT NULL
    SET @dCo_FechaVigencia = dbo.FechaConMinutos(@dCo_FechaVigencia)

IF @sCo_Inactivo IS NULL
	SET @sCo_Inactivo = 'TODO'


		
		SELECT ART.co_art, ART.art_des, ART.modelo,
		CASE @sParametroBarra
				WHEN 'REF' THEN
					ISNULL(('*' + RTRIM(LTRIM(ART.ref)) + '*'),'')
				WHEN 'MOD' THEN
					ISNULL(('*' + RTRIM(LTRIM(ART.modelo)) + '*'),'')
				ELSE
					'*' + RTRIM(LTRIM(ART.co_art)) + '*'
		END as co_art_barra,
				AL.co_alma, LA.lin_des, SL.subl_des,
	dbo.PrecioAUnaFecha(ART.co_art,max(AP.desde),case when AP.co_precio = @sCo_Precio01 then AP.co_precio end,AL.co_alma,NULL,NULL,NULL,NULL) as Precio01,
	IMG.picture, IMG.co_imag as tip

		FROM
		saArticulo AS ART
		CROSS JOIN saAlmacen AS AL
		LEFT JOIN saStockAlmacen AS SA ON SA.co_art = ART.co_art and AL.co_alma = SA.co_alma AND SA.tipo = 'ACT'
		--LEFT JOIN saArtUnidad AS AU ON AU.co_art = ART.co_art AND AU.uni_principal = 1
		INNER JOIN saLineaArticulo AS LA ON ART.co_lin = LA.co_lin
		INNER JOIN saSubLinea AS SL ON ART.co_subl = SL.co_subl		
		--LEFT JOIN saArtImagen AS IMG ON ART.co_art = IMG.co_art
		LEFT JOIN saDocumentoImagen AS IMG ON ART.rowguid = IMG.rowguidDoc
		LEFT JOIN (SELECT  co_art,desde,co_precio,co_alma,hasta FROM saArtPrecio) AS AP ON AP.co_art = ART.co_art 
				AND (AP.co_precio = @sCo_Precio01)											 
				AND (AP.desde <= @dCo_FechaVigencia AND (AP.hasta > @dCo_FechaVigencia OR AP.hasta IS NULL)
```
