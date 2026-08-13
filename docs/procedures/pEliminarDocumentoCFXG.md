# SP: pEliminarDocumentoCFXG
**Tipo**: Eliminar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pEliminarDocumentoCFXG
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarDocumentoCFXG] ( @sDocOri CHAR(20) )
AS 
    BEGIN
        DELETE FROM
            saDocumentoCompra
        WHERE
            ( co_tipo_doc = 'CFXG'
              OR co_tipo_doc = 'Giro'
            )
            AND nro_orig = @sDocOri

    END
```
