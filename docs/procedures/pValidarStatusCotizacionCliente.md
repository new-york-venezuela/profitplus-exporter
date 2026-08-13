# SP: pValidarStatusCotizacionCliente
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarStatusCotizacionCliente] ( @nroDoc AS CHAR(20) )
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
              FROM
                saCotizacionCliente E
                INNER JOIN saCotizacionClienteReng R ON E.doc_num = R.doc_num
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
            OR ( A.status = '1'
                 AND ( ( A.PARCIALMENTE_EXPORTADO = 0
                         AND TOTALMENTE_EXPORTADO = 0
                       )
                       OR ( A.NO_EXPORTADO = 0
                            AND PARCIALMENTE_EXPORTADO = 0
                          )
                     )
               )

        IF ( @chNuevoStatus IS NOT
```
