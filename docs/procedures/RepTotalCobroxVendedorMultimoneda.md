# SP: RepTotalCobroxVendedorMultimoneda
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <17/08/2010>
-- Last Update: <2020-03-13>
-- Description:	<Reporte de Total de Cobros por Vendedor>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalCobroxVendedorMultimoneda]
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
	@sCo_Moneda_Rep CHAR (6) = NULL,
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

			  if (@sCo_Moneda_Rep is null)
                    set @sCo_Moneda_Rep = @MonedaBase

       
        SELECT
            ISNULL(A.co_ven, B.co_ven) AS co_ven, ISNULL(A.ven_des, B.ven_des) AS ven_des,
            ISNULL(A.anho_venta, B.anho_cobro) AS anho, ISNULL(A.mes_venta, B.mes_cobro) AS mes,

            ISNULL(A.total_venta, 0) AS total_venta, ISNULL(A.total_venta_OM, 0)  AS total_venta_OM , 

			ISNULL(B.total_EF, 0) AS total_EF, ISNULL(B.total_EF_OM, 0)  AS total_EF_OM,

            ISNULL(B.total_CH, 0) AS total_CH,ISNULL(B.total_CH_OM, 0)  AS total_CH_OM,
			
			ISNULL(B.total_TJ, 0) AS total_TJ, ISNULL(B.total_TJ_OM, 0)  AS total_TJ_OM,
			
			ISNULL(B.total_DP, 0) AS total_DP ,  ISNULL(B.total_DP_OM, 0)  AS total_DP_OM,

			ISNULL(B.total_TP , 0) AS total_TP , ISNULL(B.total_TP_OM , 0)  AS total_TP_OM ,
			
			ISNULL(B.total_CT , 0) AS total_CT , ISNULL(B.total_CT_OM , 0) AS total_CT_OM , 
			ISNULL(B.TotalCobro,0) as TotalCobro, ISNULL(B.TotalCobroOM,0)  as TotalCobroOM,
			
			@sCo_Moneda_Rep as co_mone , @MonedaBase as MonedaBase
        FROM
            ( SELECT
                V.co_ven, V.ven_des, TVENTAS.anho_venta, TVENTAS.mes_venta, TVENTAS.total_venta , TVENTAS.total_venta_OM
              FROM
                savendedor V
                INNER JOIN ( SELECT
                                DC.co_ven, YEAR(DC.fec_emis) AS anho_venta, MONTH(DC.fec_emis) AS mes_venta,
```
