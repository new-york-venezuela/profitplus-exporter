# SP: pCostoEliminarEntrada
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pCostoEliminarEntrada]
    @RowGuid_Doc_Orig UNIQUEIDENTIFIER ,
    @strTipo_doc CHAR(4)
AS 
    BEGIN
        IF ( @strTipo_doc = 'TRAS' ) 
            DELETE FROM
                saCostoHistoricoEntrada
            WHERE
                doc_orig = @RowGuid_Doc_Orig
                AND tipo_doc IN ( 'TRAS', 'TRAT' )
        ELSE 
            DELETE FROM
                saCostoHistoricoEntrada
            WHERE
                doc_orig = @RowGuid_Doc_Orig
                AND tipo_doc = @strTipo_doc
    END
```
