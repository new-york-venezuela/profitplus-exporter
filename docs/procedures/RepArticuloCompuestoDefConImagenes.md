# SP: RepArticuloCompuestoDefConImagenes
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <04-12-14>
 Description:	<Articulos Conpuesto con sus Imagenes>
 =============================================*/
CREATE PROCEDURE [dbo].[RepArticuloCompuestoDefConImagenes]
	-- Add the parameters for the stored procedure here
    @sCo_ArtC_d CHAR(20) = NULL ,
    @sCo_ArtC_h CHAR(20) = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sdFec_Emis_d SMALLDATETIME = NULL ,
    @sdFec_emis_h SMALLDATETIME = NULL ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        SELECT
            A.co_artc, A.descrip, A.fec_emis, A.co_art, A.co_uni, ARTE.art_des AS art_des_enc, ARTE.modelo AS modelo_enc, 
			ARTR.art_des AS art_des_ren, ARTR.modelo AS modelo_ren, DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip
        FROM
            saArtCompuesto A
            INNER JOIN saArticulo ARTE ON ARTE.co_art = A.co_art
            INNER JOIN saArticulo ARTR ON ARTR.co_art = A.co_art
			left outer join saDocumentoImagen DI 
			INNER JOIN saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON A.rowguid = DI.rowguidDoc
        WHERE
		DI.co_imag is not null and
            ( ( @sCo_ArtC_d IS NULL
                OR A.co_artc >= @sCo_ArtC_d
              )
              AND ( @sCo_ArtC_h IS NULL
                    OR A.co_artc <= @sCo_ArtC_h
                  )
            )
            AND ( ( @sCo_Art_d IS NULL
                    OR ARTE.co_art >= @sCo_Art_d
                  )
                  AND ( @sCo_Art_h IS NULL
                        OR ARTE.co_art <= @sCo_Art_h
                      )
                )
            AND ( ( @sdFec_Emis_d IS NULL
                    OR A.fec_emis >= @sdFec_Emis_d
                  )
                  AND ( @sdFec_Emis_h IS NULL
                        OR DATEDIFF(dd, 0, A.fec_emis) <= @sdFec_Emis_h
                      )
                )
            AND ( @sCo_Sucursal IS NULL
                  OR A.co_sucu_in = @sCo_Sucursal
                )
			AND ( @sCo_tipo_img_d IS NULL
                  OR TI.co_tipo_imag >= @sCo_tipo_img_d
                )
			AND ( @sCo_tipo_img_h IS NULL
                  OR TI.co_tipo_imag <= @sCo_tipo_img_h
```
