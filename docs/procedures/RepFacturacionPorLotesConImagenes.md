# SP: RepFacturacionPorLotesConImagenes
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saPlantillaVenta`](../tables/saPlantillaVenta.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)
- [`stgFactLoteGen`](../tables/stgFactLoteGen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-06-2015>
-- Description:	<Facturacion Por Lostes con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepFacturacionPorLotesConImagenes]
    @sCo_Fact_Lote_d CHAR(6) = NULL,
    @sCo_Fact_Lote_h CHAR(6) = NULL,    
	@dFecha_d SMALLDATETIME = NULL,
    @dFecha_h SMALLDATETIME = NULL,	
    @sPlantilla_d CHAR(20) = NULL,
	@sPlantilla_h CHAR(20) = NULL,
	@sCo_Tipo_Imag_d CHAR(6) = NULL,
	@sCo_Tipo_Imag_h CHAR(6) = NULL,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0	
AS 
    BEGIN
        SET NOCOUNT ON ;       
	
		IF @dFecha_d IS NOT NULL
			set @dFecha_d = dbo.FechaSimple(@dFecha_d)  
		IF @dFecha_h IS NOT NULL
			set @dFecha_h = dbo.FechaSimple(@dFecha_h)

        SELECT  FL.co_fact_lote_gen, FL.descrip as descrip_fact_lote, FL.fecha, PV.doc_num as doc_plantilla,
			TI.co_tipo_imag, TI.descrip, DI.co_imag, DI.des_imag, DI.rowguidDoc, DI.picture
		FROM            
			stgFactLoteGen AS FL
			LEFT JOIN saPlantillaVenta AS PV ON FL.co_plan_vta = PV.doc_num
			LEFT JOIN dbo.saDocumentoImagen DI ON DI.rowguidDoc = FL.rowguid
			LEFT JOIN dbo.saTipoImagen TI ON TI.co_tipo_imag = DI.co_tipo_imag
        
		WHERE
			((@sCo_Fact_Lote_d IS NULL OR FL.co_fact_lote_gen >= @sCo_Fact_Lote_d) AND (@sCo_Fact_Lote_h IS NULL OR FL.co_fact_lote_gen <= @sCo_Fact_Lote_h)) AND 
			((@dFecha_d IS NULL OR dbo.FechaSimple(FL.fecha) >= @dFecha_d) AND ( @dFecha_h IS NULL OR dbo.FechaSimple(FL.fecha) <= @dFecha_h)) AND 
			((@sPlantilla_d IS NULL OR FL.co_plan_vta >= @sPlantilla_d) AND (@sPlantilla_h IS NULL OR FL.co_plan_vta <= @sPlantilla_h)) AND
			((@sCo_Tipo_Imag_d IS NULL OR TI.co_tipo_imag >= @sCo_Tipo_Imag_d) AND (@sCo_Tipo_Imag_h IS NULL OR TI.co_tipo_imag <= @sCo_Tipo_Imag_h)) AND
			DI.picture IS NOT NULL
			
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'descrip' THEN FL.descrip
                                 ELSE FL.co_fact_lote_gen
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'descrip' THEN FL.descrip
                                          ELSE FL.co_fact_lote_gen
                                        END
                      EN
```
