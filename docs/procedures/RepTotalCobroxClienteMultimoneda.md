# SP: RepTotalCobroxClienteMultimoneda
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/06/2023>
-- Description:	<Reporte de Total De cobros x cliente multimoneda>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalCobroxClienteMultimoneda]
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Zona_d CHAR(6) = NULL ,
    @sCo_Zona_h CHAR(6) = NULL ,
    @sCo_Segmento_d CHAR(6) = NULL ,
    @sCo_Segmento_h CHAR(6) = NULL ,
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
            ISNULL(A.co_cli, B.co_cli) AS co_cli, ISNULL(A.cli_des, B.cli_des) AS cli_des,
            ISNULL(A.anho_venta, B.anho_cobro) AS anho, ISNULL(A.mes_venta, B.mes_cobro) AS mes,
            ISNULL(A.total_venta, 0) AS total_venta, ISNULL(A.total_venta_OM, 0) AS total_venta_OM, ISNULL(B.total_EF, 0) AS total_EF,ISNULL(Round(B.total_EF_OM,2), 0) AS total_EF_OM,
            ISNULL(B.total_CH, 0) AS total_CH,ISNULL(B.total_CH_OM, 0) AS total_CH_OM, ISNULL(B.total_TJ, 0) AS total_TJ,ISNULL(B.total_TJ_OM, 0) AS total_TJ_OM, ISNULL(B.total_DP, 0) AS total_DP,ISNULL(B.total_DP_OM, 0) AS total_DP_OM,
			ISNULL(B.total_TP, 0) AS total_TP,ISNULL(B.total_TP_OM, 0) AS total_TP_OM , ISNULL(B.total_CT, 0) AS total_CT,ISNULL(B.total_CT_OM, 0) AS total_CT_OM,
			ISNULL(B.TotalCobro,0) as TotalCobro, ISNULL(B.TotalCobroOM,0)  as TotalCobroOM,
			@sCo_Moneda_Rep as co_mone, @MonedaBase as MonedaBase

		

        FROM
            ( SELECT
                P.co_cli, P.cli_des, TVENTAS.anho_venta, TVENTAS.mes_venta, TVENTAS.total_venta, TVENTAS.total_venta_OM
              FROM
                sacliente P
                INNER JOIN ( SELECT
                                DC.co_cli, YEAR(DC.fec_emis) AS anho_ven
```
