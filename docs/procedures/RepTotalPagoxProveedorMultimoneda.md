# SP: RepTotalPagoxProveedorMultimoneda
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/06/2023>
-- Description:	<Reporte de Total De pagos x proveedor multimoneda>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalPagoxProveedorMultimoneda]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Zona_d CHAR(6) = NULL ,
    @sCo_Zona_h CHAR(6) = NULL ,
    @sCo_Segmento_d CHAR(6) = NULL ,
    @sCo_Segmento_h CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
    @cCo_Moneda_Rep CHAR (6) = NULL,
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

		if (@cCo_Moneda_Rep is null)
              set @cCo_Moneda_Rep = @MonedaBase

        SELECT
            ISNULL(A.co_prov, B.co_prov) AS co_prov, ISNULL(A.prov_des, B.prov_des) AS prov_des,
            ISNULL(A.anho_compra, B.anho_pago) AS anho, ISNULL(A.mes_compra, B.mes_pago) AS mes,
            ISNULL(A.total_compra, 0) AS total_compra, ISNULL(B.total_EF, 0) AS total_EF,
            ISNULL(B.total_CH, 0) AS total_CH, ISNULL(B.total_TR, 0) AS total_TR,

			ISNULL(A.total_compra_OM, 0) AS total_compra_OM, ISNULL(B.total_EF_OM, 0) AS total_EF_OM,
            ISNULL(B.total_CH_OM, 0) AS total_CH_OM, ISNULL(B.total_TR_OM, 0) AS total_TR_OM,
			 ISNULL(B.TotalPagoOM, 0) AS TotalPagoOM,
			@cCo_Moneda_Rep as co_mone_rep, @MonedaBase as MonedaBase
        FROM
            ( SELECT
                P.co_prov, P.prov_des, TCOMPRAS.anho_compra, TCOMPRAS.mes_compra, TCOMPRAS.total_compra, TCOMPRAS.total_Compra_OM
              FROM
                saProveedor P
                INNER JOIN ( SELECT
                                DC.co_prov, YEAR(DC.fec_emis) AS anho_compra, MONTH(DC.fec_emis) AS mes_compra,
                                SUM(DC.total_neto) AS total_compra, 
								
								 
								SUM(ROUND(CASE WHEN @cCo_Moneda_Rep = DC.co_mone  THEN
								DC.total_neto / DC.tasa ELSE DC.total_ne
```
