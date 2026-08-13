# SP: RepTotalPagoEmpresaMultimoneda
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/06/2023>
-- Description:	<Reporte de Total De Pagos x empresa multimoneda>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalPagoEmpresaMultimoneda]
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

		DECLARE @MonedaBase char(6)
		 SELECT @MonedaBase = g_moneda from par_emp

		IF (@sCo_Moneda_Rep is null)
		    SET @sCo_Moneda_Rep = @MonedaBase
	   
        SELECT
            ISNULL(A.anho_compra, B.anho_pago) AS anho, ISNULL(A.mes_compra, B.mes_pago) AS mes,
            ISNULL(A.total_compra, 0) AS total_compra, ISNULL(A.total_compra_OM,0) as total_compra_OM , ISNULL(B.total_EF, 0) AS total_EF, ISNULL(B.total_EF_OM, 0 ) as total_EF_OM , 
            ISNULL(B.total_CH, 0) AS total_CH, ISNULL(B.total_TR, 0) AS total_TR , ISNULL(B.total_CH_OM ,0) as total_CH_OM , ISNULL(B.total_TR_OM, 0) as total_TR_OM,
			 ISNULL(B.TotalPagoOM, 0) AS TotalPagoOM,
			 co_mone_rep ,MonedaBase
        FROM
            ( SELECT
                anho_compra, mes_compra, SUM(total_compra) AS total_compra , SUM(total_compra_OM) as total_compra_OM ,  @sCo_Moneda_Rep as co_mone_rep , @MonedaBase as MonedaBase
              FROM
                ( SELECT
                    nro_doc, YEAR(DC.fec_emis) AS anho_compra, MONTH(DC.fec_emis) AS mes_compra,
                    SUM(DC.total_neto) AS total_compra , 
																SUM( ROUND(CASE WHEN @sCo_Moneda_Rep = DC.co_mone THEN
																(DC.total_neto) /DC.tasa ELSE (DC.total_neto) / [dbo].[TasaAUnaFecha](@sCo_Moneda_Rep, 0, DC.fec_emis)END,2))
													

					AS total_compra_OM 
                  FROM
                    saDocumentoCompra DC
                  WHERE
                    DC.anulado = 0
                    AND DC.co_tipo_doc = 'FACT'
                    AND ( @sCo_fecha_d IS NULL
                          OR dbo.FechaSimple(DC.fec_emis) >= @sC
```
