# SP: RepGiroCompraConImagenes
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saGiroCompra`](../tables/saGiroCompra.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <30/11/2015>
-- Description:	<Giro de Compra Con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepGiroCompraConImagenes]
	-- Add the parameters for the stored procedure here
    @sCo_giro_d CHAR(20) = NULL,
    @sCo_giro_h CHAR(20) = NULL,
    @dFecha_d DATETIME = NULL,
    @dFecha_h DATETIME = NULL,
    @sCo_prov_d CHAR(16) = NULL,
    @sCo_prov_h CHAR(16) = NULL,
    @sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,    
    @sCampOrderBy VARCHAR(16) = NULL,
    @sDir VARCHAR(6) = NULL,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		        
        SELECT
            GC.co_giro, GC.des_giro, GC.co_prov, PROV.prov_des, dbo.fechasimple(GC.fecha) AS fecha,
			DI.co_imag, DI.des_imag, DI.picture, DI.co_tipo_imag, TI.descrip AS descripImagen
        FROM
            saGiroCompra AS GC
            LEFT JOIN saProveedor AS PROV ON PROV.co_prov = GC.co_prov
			left outer join saDocumentoImagen DI ON GC.rowguid = DI.rowguidDoc
			INNER JOIN saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag
        WHERE			
			DI.co_imag IS NOT NULL AND
            ((@sCo_giro_d IS NULL OR GC.co_giro >= @sCo_giro_d) AND (@sCo_giro_h IS NULL OR GC.co_giro <= @sCo_giro_h)) AND
			((@dFecha_d IS NULL OR dbo.fechasimple(GC.fecha) >= @dFecha_d) AND (@dFecha_h IS NULL OR dbo.fechasimple(GC.fecha) <= @dFecha_h)) AND 
			((@sCo_prov_d IS NULL OR GC.co_prov >= @sCo_prov_d) AND (@sCo_prov_h IS NULL OR GC.co_prov <= @sCo_prov_h)) AND
			((@sCo_tipo_img_d IS NULL OR TI.co_tipo_imag >= @sCo_tipo_img_d) AND (@sCo_tipo_img_h IS NULL OR TI.co_tipo_imag <= @sCo_tipo_img_h))
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_giro' THEN GC.des_giro
                                 ELSE GC.co_giro
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_giro' THEN GC.des_giro
                                          ELSE GC.co_giro
                                        END
                      END ASC
    END
```
