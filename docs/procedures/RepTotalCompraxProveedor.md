# SP: RepTotalCompraxProveedor
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
-- Description:	<Reporte de Total de Compras por Proveedor>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalCompraxProveedor]

    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
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
            P.co_prov, P.prov_des, FC.fec_emis, FC.anulado, '0' AS anulado_dev,
            ( CASE WHEN FC.anulado = 1 THEN 0.00
                   ELSE ( FC.total_bruto - FC.monto_desc_glob + FC.monto_reca )
              END ) AS total_neto, ( CASE WHEN FC.anulado = 1 THEN 0.00
                                          ELSE FC.monto_imp
                                     END ) AS monto_imp, ( CASE WHEN FC.anulado = 1 THEN 0.00
                                                                ELSE ( FC.otros1 + FC.otros2 + FC.otros3 )
                                                           END ) AS otros, '0.00' AS neto_dev, '0.00' AS imp_dev,
            '0.00' AS otros_dev
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
            AND ( ( @sCo_Prov_d IS NULL
                    OR P.co_prov >= @sCo_Prov_d-- se modifico el filtro jortiz sit 130214
                  )
                  AND ( @sCo_Prov_h IS NULL
                        OR P.co_prov <= @sCo_Prov_h-- se modifico el filtro jortiz sit 130214
                      )
                )
            AND ( ( @sCo_Zona_d IS NULL
                    OR P.co_z
```
