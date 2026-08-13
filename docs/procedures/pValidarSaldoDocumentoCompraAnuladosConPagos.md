# SP: pValidarSaldoDocumentoCompraAnuladosConPagos
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarSaldoDocumentoCompraAnuladosConPagos]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
        SELECT
            'El documento de compra ' + RTRIM(DC.Co_tipo_doc) + '-' + RTRIM(DC.nro_doc)
            + ' se encuentra anulado y tiene pagos asociados. *NC' AS motivo
        FROM
            dbo.saDocumentoCompra DC
            INNER JOIN saPagoDocReng PR ON PR.co_tipo_doc = DC.co_tipo_doc
                                           AND PR.nro_doc = DC.nro_doc
            INNER JOIN saPago PE ON PE.cob_num = PR.cob_num
                                    AND PE.anulado = 0
        WHERE
            DC.anulado = 1
    END
```
