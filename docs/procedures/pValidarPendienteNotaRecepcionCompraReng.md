# SP: pValidarPendienteNotaRecepcionCompraReng
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarPendienteNotaRecepcionCompraReng]
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
                    saNotaRecepcionCompraReng R
                    LEFT JOIN ( SELECT
                                    A.rowguid_doc, SUM(A.total_art) AS total_art
                                FROM
                                    ( SELECT
                                        SUM(R.total_art) AS total_art, R.rowguid_doc
                                      FROM
                                        saFacturaCompraReng R
                                        INNER JOIN saFacturaCompra E ON E.doc_num = R.doc_num
                                      WHERE
                                        tipo_doc = 'NREC'
                                        AND e.anulado = 0
                                      GROUP BY
                                        rowguid_doc
                                      UNION ALL
					-- Las devoluciones afectan pendiente
                                      SELECT
                                        SUM(R.total_art) AS total_art, R.rowguid_doc
                                      FROM
                                        saDevolucionProveedorReng R
                                        INNER JOIN saDevolucionProveedor E ON E.doc_num = R.doc_num
                                      WHERE
                                        tipo_doc = 'NREC'
                                        AND e.anulado = 0
                                      GROUP BY
                                        rowguid_doc
                                    ) A
                                GROUP BY
                                    A.rowguid_doc
                              ) I ON I.rowguid_doc = R.rowguid
                ) F
            WHERE
                F.pendiente
```
