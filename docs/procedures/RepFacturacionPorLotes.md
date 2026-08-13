# SP: RepFacturacionPorLotes
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaVenta`](../tables/saPlantillaVenta.md)
- [`stgFactLoteGen`](../tables/stgFactLoteGen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <01/12/2014>
-- Description:	<Facturacion Por Lotes>
-- =============================================
CREATE PROCEDURE [dbo].[RepFacturacionPorLotes] 

    @sCodigo_d CHAR(20) = NULL ,
    @sCodigo_h CHAR(20) = NULL ,
	@dFecha_d DATETIME = NULL ,
    @dFecha_h DATETIME = NULL ,
	@sPlantilla_d CHAR(20) = NULL ,
	@sPlantilla_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

		Set @dFecha_d =  [dbo].fechaSimple(@dFecha_d)
		Set @dFecha_h =  [dbo].fechaSimple(@dFecha_h)

        SELECT FL.co_fact_lote_gen, FL.descrip, FL.procesado, FL.co_cli_d, FL.co_cli_h, FL.co_serie_fact, FL.co_serie_nctrl,
		FL.man_ven_pl, FL.man_cond_pl, FL.fec_emis, FL.fec_venc, FL.fec_reg, FL.man_fec_emis, FL.man_fec_venc, FL.man_fec_reg,
		FL.prec_vta_act, FL.co_usuario, FL.co_sucu, FL.co_plan_vta, FL.sp_usuario, FL.arch_cod, PV.doc_num, PV.descrip       
        FROM
            stgFactLoteGen as FL
		LEFT JOIN saPlantillaVenta AS PV ON FL.co_plan_vta = PV.doc_num
		WHERE 
			((@sCodigo_d IS NULL OR FL.co_fact_lote_gen >= @sCodigo_d) AND (@sCodigo_h IS NULL OR FL.co_fact_lote_gen <= @sCodigo_h))
		AND ((@dFecha_d IS NULL OR dbo.FechaSimple(FL.fecha) >= @dFecha_d) AND ( @dFecha_h IS NULL OR dbo.FechaSimple(FL.fecha) <= @dFecha_h))
		AND ((@sPlantilla_d IS NULL OR FL.co_plan_vta >= @sPlantilla_d) AND (@sPlantilla_h IS NULL OR FL.co_plan_vta <= @sPlantilla_h))
    END
```
