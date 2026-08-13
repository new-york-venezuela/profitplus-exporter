# SP: RepTotalVentasComprasXSegmento
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSegmento`](../tables/saSegmento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Reporte de total de movimientos de ventas y compras>
-- =============================================
CREATE PROCEDURE [RepTotalVentasComprasXSegmento]
	-- Add the parameters for the stored procedure here
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sCo_Cod_d SMALLDATETIME = NULL ,
    @sCo_Cod_h SMALLDATETIME = NULL ,
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
            *
        FROM
            ( SELECT
                'Total de Ventas' AS tipo, '1' AS ORDEN, SUM(FV.total_neto) AS total_neto, S.co_seg, s.seg_des
              FROM
                sasegmento AS s
                INNER JOIN sacliente c ON s.co_seg = c.co_seg
                INNER JOIN saDocumentoVenta AS FV ON c.co_cli = FV.co_cli
                                                     AND FV.co_tipo_doc = 'FACT'
                                                     AND FV.anulado = 0
              WHERE
                ( ( @dCo_fecha_d IS NULL
                    OR dbo.FechaSimple(FV.fec_emis) >= @dCo_fecha_d
                  )
                  AND ( @dCo_fecha_h IS NULL
                        OR dbo.FechaSimple(FV.fec_emis) <= @dCo_fecha_h
                      )
                )
                AND ( ( @sCo_Seg_d IS NULL
                        OR S.co_seg >= @sCo_Seg_d
                      )
                      AND ( @sCo_Seg_h IS NULL
                            OR S.co_seg <= @sCo_Seg_h
                          )
                    )
              GROUP BY
                S.co_seg, s.seg_des
              UNION ALL
              SELECT
                'Total de Compras' AS tipo, '2' AS ORDEN, SUM(FV.total_neto) AS total_neto, S.co_seg, s.seg_des
              FROM
                sasegmento AS s
                INNER JOIN saproveedor c ON s.co_seg = c.co_seg
                INNER JOIN saDocumentoCompra AS FV ON c.co_prov = FV.co_prov
                                                      AND FV.co_
```
