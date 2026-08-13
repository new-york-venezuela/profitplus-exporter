# SP: pValidarStatusDevolucionProveedor
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarStatusDevolucionProveedor] ( @nroDoc AS CHAR(20) )
AS 
    BEGIN	
	
        DECLARE @chNuevoStatus CHAR(1)

        SELECT
            @chNuevoStatus = CASE WHEN ( A.NO_exportado > 0
                                         AND A.PARCIALMENTE_EXPORTADO = 0
                                         AND A.TOTALMENTE_EXPORTADO = 0
                                       ) THEN '0'
                                  WHEN ( A.NO_exportado = 0
                                         AND A.PARCIALMENTE_EXPORTADO = 0
                                         AND A.TOTALMENTE_EXPORTADO > 0
                                       ) THEN '2'
                                  ELSE '1'
                             END
        FROM
            ( SELECT
                E.doc_num, E.status, SUM(CASE WHEN R.total_art = R.pendiente THEN 1
                                              ELSE 0
                                         END) AS NO_EXPORTADO, SUM(CASE WHEN R.pendiente > 0
                                                                             AND R.pendiente < R.total_art THEN 1
                                                                        ELSE 0
                                                                   END) AS PARCIALMENTE_EXPORTADO,
                SUM(CASE WHEN R.pendiente = 0 THEN 1
                         ELSE 0
                    END) AS TOTALMENTE_EXPORTADO
	--sum(case when total_art = pendiente AND total_dev = 0 then 1 else 0 end) as NO_EXPORTADO,
	--sum(case when not(total_art <= total_art - pendiente + total_dev) and not(total_art = pendiente AND total_dev = 0)  then 1  else 0 end) as PARCIALMENTE_EXPORTADO,
	--sum(case when total_art <= total_art - pendiente + total_dev  then 1  else 0 end) as TOTALMENTE_EXPORTADO
              FROM
                saDevolucionProveedor E
                INNER JOIN saDevolucionProveedorReng R ON E.doc_num = R.doc_num
              WHERE
                @nroDoc = E.doc_num
                AND R.total_art > 0
              GROUP BY
                E.doc_num, E.status
            ) A
        WHERE
            ( A.status = '0'
              AND ( A.PARCIALMENTE_EXPORTADO > 0
                    OR TOTALMENTE_EXPORTADO > 0
                  )
            )
            OR ( A.status = '2'
                 AND ( A.NO_EXPORTADO > 0
                       OR PARCIALMENTE_EXPORTADO > 0
                     )
               )
```
