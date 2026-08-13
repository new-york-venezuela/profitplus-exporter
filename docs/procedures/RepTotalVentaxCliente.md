# SP: RepTotalVentaxCliente
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
-- Description:	<Reporte de Total de Ventas por Cliente>
-- =============================================
CREATE PROCEDURE [RepTotalVentaxCliente]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Zona_d CHAR(6) = NULL ,
    @sCo_Zona_h CHAR(6) = NULL ,
    @sCo_Segmento_d CHAR(6) = NULL ,
    @sCo_Segmento_h CHAR(6) = NULL ,
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
            C.*, FV.fec_emis, ( CASE WHEN FV.anulado = 1 THEN 0.00
                                     ELSE ( FV.total_bruto - FV.monto_desc_glob + FV.monto_reca )
                                END ) AS total_neto, ( CASE WHEN FV.anulado = 1 THEN 0.00
                                                            ELSE FV.monto_imp
                                                       END ) AS monto_imp,
            ( CASE WHEN FV.anulado = 1 THEN 0.00
                   ELSE ( FV.otros1 + FV.otros2 + FV.otros3 )
              END ) AS otros, '0.00' AS neto_dev, '0.00' AS imp_dev, '0.00' AS otros_dev
        FROM
            saCliente AS C
            INNER JOIN saFacturaVenta AS FV ON FV.co_cli = C.co_cli
        WHERE
            ( ( @sCo_fecha_d IS NULL
                OR dbo.FechaSimple(FV.fec_emis) >= @sCo_fecha_d
              )
              AND ( @sCo_fecha_h IS NULL
                    OR dbo.FechaSimple(FV.fec_emis) <= @sCo_fecha_h
                  )
            )
            AND ( ( @sCo_Cli_d IS NULL
                    OR FV.co_cli >= @sCo_Cli_d
                  )
                  AND ( @sCo_Cli_h IS NULL
                        OR FV.co_cli <= @sCo_Cli_h
                      )
                )
            AND ( ( @sCo_Zona_d IS NULL
                    OR C.co_zon >= @sCo_Zona_d
                  )
                  AND ( @sCo_Zona_h IS NULL
                        OR C.co_zon <= @sCo_Zona_h
                      )
                )
```
