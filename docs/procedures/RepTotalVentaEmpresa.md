# SP: RepTotalVentaEmpresa
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <18/08/2010>
-- Description:	<Reporte de Total de Ventas de la Empresa >
-- =============================================
CREATE PROCEDURE [RepTotalVentaEmpresa]
    @dCo_fecha_d SMALLDATETIME = NULL,
    @dCo_fecha_h SMALLDATETIME = NULL,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
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

   
        SELECT
            C.co_cli, C.cli_des,
            FV.fec_emis, ( CASE WHEN FV.anulado = 1 THEN 0.00
                                     ELSE ( FV.total_bruto - FV.monto_desc_glob + FV.monto_reca )
                                END ) AS total_neto, ( CASE WHEN FV.anulado = 1 THEN 0.00
                                                            ELSE FV.monto_imp
                                                       END ) AS monto_imp,
            ( CASE WHEN FV.anulado = 1 THEN 0.00
                   ELSE ( FV.otros1 + FV.otros2 + FV.otros3 )
              END ) AS otros, '0.00' AS neto_dev, '0.00' AS imp_dev, '0.00' AS otros_dev,
              
			FV.Campo1,
			FV.Campo2,
			FV.Campo3,
			FV.Campo4,
			FV.Campo5,
			FV.Campo6,
			FV.Campo7,
			FV.Campo8
			              
        FROM
            saCliente AS C
            INNER JOIN saFacturaVenta AS FV ON FV.co_cli = C.co_cli
        WHERE
            ( ( @dCo_fecha_d IS NULL
                OR dbo.FechaSimple(FV.fec_emis) >= @dCo_fecha_d
              )
              AND ( @dCo_fecha_h IS NULL
                    OR dbo.FechaSimple(FV.fec_emis) <= @dCo_fecha_h
                  )
            )
            AND ( @sCo_Moneda IS NULL
                  OR @sCo_Moneda = FV.co_mone
                )
            AND ( @sCo_Sucursal IS NULL
                  OR @sCo_Sucursal = C.co_sucu_in
                )
            AND ( FV.anulado = 0 )
        UNION ALL
        SELECT
             C.co_cli, C.cli_des,
             DC.fec_emis, '0.00' AS total_neto, '0.00' AS monto_imp, '0.00' AS otros,
            ( CASE WHEN DC.anulado = 1 THEN 0.00
                   ELSE ( DC.total_bruto - DC.monto_desc_glob + DC.monto
```
