# SP: RepTotalVentaxVendedor
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Ventas por Vendedor>
-- =============================================
CREATE PROCEDURE [RepTotalVentaxVendedor]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Vendedor_d CHAR(6) = NULL ,
    @cCo_Vendedor_h CHAR(6) = NULL ,
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
            V.*, FV.fec_emis, ( CASE WHEN FV.anulado = 1 THEN 0.00
                                     ELSE ( FV.total_bruto - FV.monto_desc_glob + FV.monto_reca )
                                END ) AS total_neto, ( CASE WHEN FV.anulado = 1 THEN 0.00
                                                            ELSE FV.monto_imp
                                                       END ) AS monto_imp,
            ( CASE WHEN FV.anulado = 1 THEN 0.00
                   ELSE ( FV.otros1 + FV.otros2 + FV.otros3 )
              END ) AS otros, '0.00' AS neto_dev, '0.00' AS imp_dev, '0.00' AS otros_dev
        FROM
            saVendedor AS V
            INNER JOIN saFacturaVenta AS FV ON FV.co_ven = V.co_ven
        WHERE
            ( ( @sCo_fecha_d IS NULL
                OR dbo.FechaSimple(FV.fec_emis) >= @sCo_fecha_d
              )
              AND ( @sCo_fecha_h IS NULL
                    OR dbo.FechaSimple(FV.fec_emis) <= @sCo_fecha_h
                  )
            )
            AND ( ( @cCo_Vendedor_d IS NULL
                    OR V.co_ven >= @cCo_Vendedor_d
                  )
                  AND ( @cCo_Vendedor_h IS NULL
                        OR V.co_ven <= @cCo_Vendedor_h
                      )
                )
            AND ( @cCo_Moneda IS NULL
                  OR @cCo_Moneda = FV.co_mone
                )
            AND ( @cCo_Sucursal IS NULL
                  OR @cCo_Sucursal = V.co_sucu_in
                )
            AND ( FV.anulado = 0 )
		/*AND
		(DV.co_tipo_doc = 'FACT')*/
        UNION ALL
        SELECT
            V.*, DC.fec_emis, '0.00' AS tota
```
