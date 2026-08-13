# SP: RepTotalPagoEmpresa
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <17/08/2010>
-- Description:	<Reporte de Total de Pagos de la Empresa>
-- =============================================
CREATE PROCEDURE [RepTotalPagoEmpresa]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
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
	   
        SELECT
            ISNULL(A.anho_compra, B.anho_pago) AS anho, ISNULL(A.mes_compra, B.mes_pago) AS mes,
            ISNULL(A.total_compra, 0) AS total_compra, ISNULL(B.total_EF, 0) AS total_EF,
            ISNULL(B.total_CH, 0) AS total_CH, ISNULL(B.total_TR, 0) AS total_TR
        FROM
            ( SELECT
                anho_compra, mes_compra, SUM(total_compra) AS total_compra
              FROM
                ( SELECT
                    nro_doc, YEAR(DC.fec_emis) AS anho_compra, MONTH(DC.fec_emis) AS mes_compra,
                    SUM(DC.total_neto) AS total_compra
                  FROM
                    saDocumentoCompra DC
                  WHERE
                    DC.anulado = 0
                    AND DC.co_tipo_doc = 'FACT'
                    AND ( @sCo_fecha_d IS NULL
                          OR dbo.FechaSimple(DC.fec_emis) >= @sCo_fecha_d
                        )
                    AND ( @sCo_fecha_h IS NULL
                          OR dbo.FechaSimple(DC.fec_emis) <= @sCo_fecha_h
                        )
                    AND ( @cCo_Moneda IS NULL
                          OR @cCo_Moneda = DC.co_mone
                        )
                    AND ( @cCo_Sucursal IS NULL
                          OR @cCo_Sucursal = DC.co_sucu_in
                        )
                  GROUP BY
                    nro_doc, YEAR(DC.fec_emis), MONTH(DC.fec_emis)
                ) W
              GROUP BY
                anho_compra, mes_compra
            ) A
            FULL OUTER JOIN ( SELECT
                                anho_pago, mes_pago, SUM(total_EF) AS total_EF, SUM(total_CH) AS total_CH,
```
