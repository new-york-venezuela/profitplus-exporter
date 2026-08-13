# SP: RepTotalCobroEmpresaMultimoneda
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/06/2023>
-- Description:	<Reporte de Total De Cobros x empresa multimoneda>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalCobroEmpresaMultimoneda]
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
	@cCo_Moneda_Rep CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sOperacion CHAR(20) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
	
        IF @dCo_fecha_d IS NOT NULL 
            SET @dCo_fecha_d = dbo.FechaSimple(@dCo_fecha_d)
        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = dbo.FechaSimple(@dCo_fecha_h)


		Declare @MonedaBase char(6)
             Select @MonedaBase = g_moneda from par_emp

		if (@cCo_Moneda_Rep is null)
              set @cCo_Moneda_Rep = @MonedaBase
	   
        SELECT
            ISNULL(A.anho_venta, B.anho_cobro) AS anho, ISNULL(A.mes_venta, B.mes_cobro) AS mes,
            ISNULL(A.total_venta, 0) AS total_compra, ISNULL(B.total_EF, 0) AS total_EF,
            ISNULL(B.total_CH, 0) AS total_CH, ISNULL(B.total_TJ, 0) AS total_TJ, ISNULL(B.total_DP, 0) AS total_DP,
			ISNULL(B.total_TP , 0) AS total_TP , ISNULL(B.total_CT , 0) AS total_CT,

			 ISNULL( A.total_venta_OM, 0) AS total_compra_OM, ISNULL(B.total_EF_OM, 0) AS total_EF_OM,
            ISNULL(  B.total_CH_OM, 0) AS total_CH_OM, ISNULL(B.total_TJ_OM, 0) AS total_TJ_OM, ISNULL(B.total_DP_OM, 0) AS total_DP_OM,
			ISNULL(  B.total_TP_OM , 0) AS total_TP_OM , ISNULL(B.total_CT_OM , 0) AS total_CT_OM,
			
			ISNULL(B.TotalCobro, 0) AS TotalCobro ,ISNULL(B.TotalCobroOM , 0) AS TotalCobroOM ,
			@cCo_Moneda_Rep as Moneda_Reporar, @MonedaBase as Moneda_Base

        FROM
            ( SELECT
                anho_venta, mes_venta, SUM(total_venta) AS total_venta, SUM(total_venta_OM) as total_venta_OM
              FROM
                ( SELECT
                    nro_doc, YEAR(DC.fec_emis) AS anho_venta, MONTH(DC.fec_emis) AS mes_venta,
                    SUM(DC.total_neto) AS total_venta,		 SUM(ROUND(CASE WHEN @cCo_Moneda_Rep = DC.co_mone THEN DC.total_neto/ DC.tasa
															ELSE DC.total_neto/ [dbo].[TasaAUnaFecha](@cCo_Moneda_Rep, 1, DC.fec_emis)  END,2))
					
					AS total_venta_OM
                  FROM
```
