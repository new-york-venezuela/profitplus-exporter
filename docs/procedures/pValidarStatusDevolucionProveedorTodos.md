# SP: pValidarStatusDevolucionProveedorTodos
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarStatusDevolucionProveedorTodos]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(256) )

        DECLARE STATUS_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                A.doc_num, A.status AS statusOld, CASE WHEN ( A.NO_exportado > 0
                                                              AND A.PARCIALMENTE_EXPORTADO = 0
                                                              AND A.TOTALMENTE_EXPORTADO = 0
                                                            ) THEN '0'
                                                       WHEN ( A.NO_exportado = 0
                                                              AND A.PARCIALMENTE_EXPORTADO = 0
                                                              AND A.TOTALMENTE_EXPORTADO > 0
                                                            ) THEN '2'
                                                       ELSE '1'
                                                  END AS statusNew, A.rowguid
            FROM
                ( SELECT
                    E.doc_num, E.status, E.rowguid, SUM(CASE WHEN R.total_art = R.pendiente THEN 1
                                                             ELSE 0
                                                        END) AS NO_EXPORTADO,
                    SUM(CASE WHEN R.pendiente > 0
                                  AND R.pendiente < R.total_art THEN 1
                             ELSE 0
                        END) AS PARCIALMENTE_EXPORTADO, SUM(CASE WHEN R.pendiente = 0 THEN 1
                                                                 ELSE 0
                                                            END) AS TOTALMENTE_EXPORTADO
                  FROM
                    saDevolucionProveedor E
                    INNER JOIN saDevolucionProveedorReng R ON E.doc_num = R.doc_num
                  WHERE
                    R.total_art > 0
                  GROUP BY
                    E.doc_num, E.status, E.rowguid
                ) A
            WHERE
                ( A.status = '0'
                  AND ( A.PARCIALMENTE_EXPORTADO > 0
                        OR TOTALMENTE_EXPORTADO > 0
                      )
                )
                OR ( A.status = '2'
                     AND ( A.NO_EXPORTADO
```
