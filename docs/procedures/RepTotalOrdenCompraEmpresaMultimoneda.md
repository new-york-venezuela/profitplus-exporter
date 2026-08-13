# SP: RepTotalOrdenCompraEmpresaMultimoneda
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Ordenes de Compra de la Empresa Multimoneda>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalOrdenCompraEmpresaMultimoneda]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
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

        SET @sOperacion = 'Orden de Compra'

        SELECT
            @sOperacion AS Operacion, OC.doc_num, OC.descrip, OC.co_prov, OC.co_mone, OC.co_cond, OC.fec_emis,
            OC.fec_venc, OC.fec_reg, OC.anulado, OC.status, OC.n_control, OC.tasa, OC.porc_desc_glob, OC.monto_desc_glob,
            OC.porc_reca, OC.monto_reca, CPR.monto_imp, OC.monto_imp2, OC.monto_imp3, CPR.otros1, CPR.otros2, CPR.otros3,
            OC.total_neto, OC.saldo, OC.dir_ent, OC.comentario, OC.dis_cen, OC.feccom, OC.numcom, OC.impresa,
            OC.seriales_e, OC.salestax, OC.campo1, OC.campo2, OC.campo3, OC.campo4, OC.campo5, OC.campo6, OC.campo7,
            OC.campo8, OC.co_us_in, OC.co_sucu_in, OC.fe_us_in, OC.co_us_mo, OC.co_sucu_mo, OC.fe_us_mo, OC.revisado,
            OC.trasnfe, OC.validador, OC.rowguid, CPR.coti,
           ( CPR.cost_vta  - CPR.monto_desc_glob + CPR.monto_reca_glob ) AS total_bruto , 
	
		    Round((( CPR.cost_vta -CPR.monto_desc_glob ) + CPR.monto_reca_glob) / CPR.tasa ,2 ) AS total_brutoOM , 
	
			Round(OC.monto_imp / CPR.tasa ,2 ) as monto_imp_OM, 
			
			Round(OC.otros1 / CPR.tasa ,2 )as otros1_OM ,
			Round(OC.otros2 / CPR.tasa ,2 ) as otros2_OM, 
			Round(OC.otros3 / CPR.tasa ,2 ) as otros3_OM,
							   
			OC.total_neto as TotalNeto,

			Round(OC.total_neto / CPR.tasa,2) as TotalNetoOM,  co_mone_rep ,MonedaBase
        FROM
            saOrdenCompra AS OC 
            INNER JOIN ( SELECT DISTIN
```
