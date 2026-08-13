# SP: RepTotalCompraEmpresa
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <18/08/2010>
-- Description:	<Reporte de Total de Compras de la Empresa >
-- =============================================
CREATE PROCEDURE [RepTotalCompraEmpresa]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
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
            FC.fec_emis, ( CASE WHEN FC.anulado = 1 THEN 0.00
                                ELSE ( FC.total_bruto - FC.monto_desc_glob + FC.monto_reca )
                           END ) AS total_neto, ( CASE WHEN FC.anulado = 1 THEN 0.00
                                                       ELSE FC.monto_imp
                                                  END ) AS monto_imp, ( CASE WHEN FC.anulado = 1 THEN 0.00
                                                                             ELSE ( FC.otros1 + FC.otros2 + FC.otros3 )
                                                                        END ) AS otros, '0.00' AS neto_dev,
            '0.00' AS imp_dev, '0.00' AS otros_dev
        FROM
            saProveedor AS P
            INNER JOIN saFacturaCompra AS FC ON FC.co_prov = P.co_prov
        WHERE
            ( ( @sCo_fecha_d IS NULL
                OR dbo.FechaSimple(FC.fec_emis) >= @sCo_fecha_d
              )
              AND ( @sCo_fecha_h IS NULL
                    OR dbo.FechaSimple(FC.fec_emis) <= @sCo_fecha_h
                  )
            )
            AND ( @cCo_Moneda IS NULL
                  OR @cCo_Moneda = FC.co_mone
                )
            AND ( @cCo_Sucursal IS NULL
                  OR @cCo_Sucursal = P.co_sucu_in
                )
            AND ( FC.anulado = 0 )
        UNION ALL
        SELECT
            DP.fec_emis, '0.00' AS total_neto, '0.00' AS monto_imp, '0.00' AS otros,
            ( CASE WHEN DP.anulado = 1 THEN 0.00
                   ELSE ( DP.total_bruto - DP.monto_desc_glob + DP.monto_reca )
              END ) AS neto_dev, ( CASE WHEN DP.anulado = 1 THEN 0.00
                                        ELS
```
