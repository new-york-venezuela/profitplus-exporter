# SP: RepArticulosConImagenes
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <25-05-2015>
-- Description:	<Articulos con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepArticulosConImagenes]
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Lin_d CHAR(6) = NULL ,
    @sCo_Lin_h CHAR(6) = NULL ,
    @sCo_SubLin_d CHAR(6) = NULL ,
    @sCo_SubLin_h CHAR(6) = NULL ,
    @sCo_Cat_d CHAR(6) = NULL ,
    @sCo_Cat_h CHAR(6) = NULL ,
    @sCo_Tipo_Imag_d CHAR(6) = NULL ,
    @sCo_Tipo_Imag_h CHAR(6) = NULL ,
    @sCo_Inactivo CHAR(4) = NULL ,    
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0	
AS 
    BEGIN
        SET NOCOUNT ON ;       
	
        SELECT  ART.co_art, ART.art_des, LA.co_lin, LA.lin_des, SL.co_subl, SL.subl_des, CA.co_cat, CA.cat_des, ART.modelo,
				TI.co_tipo_imag, TI.descrip, DI.co_imag, DI.des_imag, DI.rowguidDoc, DI.picture
		FROM            
			saArticulo ART
			LEFT JOIN saLineaArticulo LA ON LA.co_lin = ART.co_lin
			LEFT JOIN saSubLinea SL ON  LA.co_lin = SL.co_lin AND SL.co_subl = ART.co_subl
			LEFT JOIN saCatArticulo CA ON CA.co_cat = ART.co_cat
			LEFT JOIN dbo.saDocumentoImagen DI ON DI.rowguidDoc = ART.rowguid
			LEFT JOIN dbo.saTipoImagen TI ON TI.co_tipo_imag = DI.co_tipo_imag
        
		WHERE
			((@sCo_Art_d IS NULL OR ART.co_art >= @sCo_Art_d) AND (@sCo_Art_h IS NULL OR ART.co_art <= @sCo_Art_h)) AND 
			((@sCo_Lin_d IS NULL OR LA.co_lin >= @sCo_Lin_d) AND (@sCo_Lin_h IS NULL OR LA.co_lin <= @sCo_Lin_h)) AND
			((@sCo_SubLin_d IS NULL OR SL.co_subl >= @sCo_SubLin_d) AND (@sCo_SubLin_h IS NULL OR SL.co_subl <= @sCo_SubLin_h)) AND
			((@sCo_Cat_d IS NULL OR CA.co_cat >= @sCo_Cat_d) AND (@sCo_Cat_h IS NULL OR CA.co_cat <=  @sCo_Cat_h)) AND
			((@sCo_Tipo_Imag_d IS NULL OR TI.co_tipo_imag >= @sCo_Tipo_Imag_d) AND (@sCo_Tipo_Imag_h IS NULL OR TI.co_tipo_imag <= @sCo_Tipo_Imag_h)) AND
			((@sCo_Inactivo IS NULL OR  @sCo_Inactivo = 'TODO') OR (@sCo_Inactivo = 'SIT' AND ART.anulado = 1) OR ( @sCo_Inactivo = 'NOT' AND ART.anulado = 0)) AND
			(@sCo_Sucursal IS NULL OR ART.co_sucu_in = @sCo_Sucursal) AND
			DI.picture IS NOT NULL
			
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'art_des' THEN ART.art_des
                                 ELSE ART.co_a
```
