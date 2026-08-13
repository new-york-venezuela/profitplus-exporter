# SP: RepTotalCotizacionClientexVendedorMultimoneda
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Cotizaciones por Vendedor>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalCotizacionClientexVendedorMultimoneda]

    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Vendedor_d CHAR(6) = NULL ,
    @cCo_Vendedor_h CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
	@sCo_Moneda_Rep CHAR (6) = NULL,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sOperacion CHAR(20) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)


		Declare @MonedaBase char(6)
             Select @MonedaBase = g_moneda from par_emp

		if (@sCo_Moneda_Rep is null)
              set @sCo_Moneda_Rep = @MonedaBase


        SET @sOperacion = 'Cotización'

		

		
        SELECT
            @sOperacion AS Operacion, CC.descrip, CC.co_cli, CC.co_tran, CC.co_mone, CC.co_ven, CC.co_cond, CC.fec_emis,
            CC.fec_venc, CC.fec_reg, CC.anulado, CC.status, CC.n_control, CC.ven_ter, CC.tasa, CC.porc_desc_glob,
            CC.monto_desc_glob, CC.porc_reca, CC.monto_reca, CCR.monto_imp, CC.monto_imp2, CC.monto_imp3, CCR.otros1,
            CCR.otros2, CCR.otros3, CC.total_neto, CC.saldo, CC.dir_ent, CC.comentario, CC.dis_cen, CC.feccom, CC.numcom,
            CC.contrib, CC.impresa, CC.seriales_s, CC.salestax, CC.impfis, CC.impfisfac, CC.campo1, CC.campo2, CC.campo3,
            CC.campo4, CC.campo5, CC.campo6, CC.campo7, CC.campo8, CC.co_us_in, CC.co_sucu_in, CC.fe_us_in, CC.co_us_mo,
            CC.co_sucu_mo, CC.fe_us_mo, CC.revisado, CC.trasnfe, CC.validador, CC.rowguid, V.ven_des, CC.doc_num,
            CCR.total_art, CCR.coti, CCR.monto_desc, CCR.monto_desc_glob, CCR.pendiente,
           ( CCR.prec_vta - CCR.monto_desc_glob + CCR.monto_reca_glob ) AS total_bruto  , 
			total_art_OM as total_art_OM, prec_vta_OM as prec_vta_OM,
			Round(CC.monto_imp / CCR.tasa ,2 ) as monto_imp_OM, 
			monto_desc_OM as monto_desc_OM ,monto_desc_glob_OM as monto_desc_glob_OM ,monto_reca_glob_OM as monto_reca_glob_OM  ,pendiente_OM as pendiente_OM ,
			Round(CC.otros1 / CCR
```
