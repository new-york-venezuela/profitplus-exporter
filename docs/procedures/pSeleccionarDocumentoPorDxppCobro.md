# SP: pSeleccionarDocumentoPorDxppCobro
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pSeleccionarDocumentoPorDxppCobro]
*DESCRIPCIÓN	: Seleccionar el documento que genero una nota de credito, ejemplo una Factura
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/
CREATE PROCEDURE [pSeleccionarDocumentoPorDxppCobro]
    (
      @iReng_Num INT ,
      @sCob_Num CHAR(20)
    )
AS 
    BEGIN
        SELECT
            CDR1.co_tipo_doc, CDR1.nro_doc
        FROM
            saCobroDocReng AS CDR
            INNER JOIN saCobroDocReng AS CDR1 ON CDR.rowguid_reng_ori = CDR1.rowguid
            INNER JOIN saCobro AS CB ON CB.cob_num = CDR1.cob_num
                                        AND CB.anulado = 0
        WHERE
            CDR.Reng_Num = @iReng_Num
            AND CDR.Cob_Num = @sCob_Num 
    END
```
