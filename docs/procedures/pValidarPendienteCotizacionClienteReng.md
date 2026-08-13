# SP: pValidarPendienteCotizacionClienteReng
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarPendienteCotizacionClienteReng]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )

        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                F.doc_num, F.reng_num, F.pendiente AS pedienteOld, F.total_art - F.total_art_import AS pedienteNew,
                F.rowguid
            FROM
                ( SELECT
                    R.rowguid, R.doc_num, R.reng_num, R.total_art, R.pendiente,
                    ISNULL(I.total_art, 0) AS total_art_import
                  FROM
                    saCotizacionClienteReng R
                    LEFT JOIN ( SELECT
                                    A.rowguid_doc, SUM(A.total_art) AS total_art
                                FROM
                                    ( SELECT
                                        SUM(R.total_art) AS total_art, R.rowguid_doc
                                      FROM
                                        saFacturaVentaReng R
                                        INNER JOIN saFacturaVenta E ON E.doc_num = R.doc_num
                                      WHERE
                                        tipo_doc = 'CCLI'
                                        AND e.anulado = 0
                                      GROUP BY
                                        rowguid_doc
                                      UNION ALL
                                      SELECT
                                        SUM(R.total_art) AS total_art, R.rowguid_doc
                                      FROM
                                        saPedidoVentaReng R
                                        INNER JOIN saPedidoVenta E ON E.doc_num = R.doc_num
                                      WHERE
                                        tipo_doc = 'CCLI'
                                        AND e.anulado = 0
                                      GROUP BY
                                        rowguid_doc
                                      UNION ALL
                                      SELECT
                                        SUM(R.total_art) AS total_art, R.rowguid_doc
                                      FROM
                                        saNotaEntregaVentaReng R
                                        I
```
