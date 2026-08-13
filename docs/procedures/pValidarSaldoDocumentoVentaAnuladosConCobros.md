# SP: pValidarSaldoDocumentoVentaAnuladosConCobros
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarSaldoDocumentoVentaAnuladosConCobros]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
        SELECT
            'El documento de venta ' + RTRIM(DC.Co_tipo_doc) + '-' + RTRIM(DC.nro_doc)
            + ' se encuentra anulado y tiene cobros asociados. *NC' AS motivo
        FROM
            dbo.saDocumentoVenta DC
            INNER JOIN saCobroDocReng PR ON PR.co_tipo_doc = DC.co_tipo_doc
                                            AND PR.nro_doc = DC.nro_doc
            INNER JOIN saCobro PE ON PE.cob_num = PR.cob_num
                                     AND PE.anulado = 0
        WHERE
            DC.anulado = 1
    END
```
