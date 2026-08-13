# SP: pSeleccionarDocumentoPorDxppPago
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pSeleccionarDocumentoPorDxppPago]
*DESCRIPCIÓN	: Seleccionar el documento que genero una nota de credito, ejemplo una Factura
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/
CREATE PROCEDURE [pSeleccionarDocumentoPorDxppPago]
    (
      @iReng_Num INT ,
      @sCob_Num CHAR(20)
    )
AS 
    BEGIN
        SELECT
            PDR1.co_tipo_doc, PDR1.nro_doc, PDR1.nro_fact
        FROM
            saPagoDocReng AS PDR
            INNER JOIN saPagoDocReng AS PDR1 ON PDR.rowguid_reng_ori = PDR1.rowguid
            INNER JOIN saPago AS PG ON PG.cob_num = PDR1.cob_num
                                       AND PG.anulado = 0
        WHERE
            PDR.Reng_Num = @iReng_Num
            AND PDR.Cob_Num = @sCob_Num 
    END
```
