# SP: pObtenerSaldoMontoAutorizado
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerSaldoMontoAutorizado
DESCRIPCION: Muestra la sumatoria de los documentos y sus montos autorizados y aun no cancelados
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [pObtenerSaldoMontoAutorizado]
AS 
    BEGIN


        DECLARE @total_doc AS DECIMAL(18, 2) ;
        DECLARE @total_pag AS DECIMAL(18, 2)

        SELECT
            @total_doc = ISNULL(SUM(total_neto), 0.00)
        FROM
            saDocumentoCompra
        WHERE
            aut = 1

        SELECT
            @total_pag = ISNULL(SUM(PR.mont_cob), 0.00)
        FROM
            saDocumentoCompra AS DC
            INNER JOIN saPagoDocReng AS PR ON DC.nro_doc = PR.nro_doc
                                              AND DC.aut = 1
                                              AND DC.anulado = 0
            INNER JOIN saPago AS P ON p.cob_num = PR.cob_num
                                      AND p.anulado = 0
        GROUP BY
            PR.nro_doc

        SELECT
            @total_doc = @total_doc - @total_pag
        SELECT
            @total_doc
		

    END
```
