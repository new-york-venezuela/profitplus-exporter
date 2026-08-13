# SP: pEliminarDocumentoVentaCFXG
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pEliminarDocumentoVentaCFXG
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarDocumentoVentaCFXG] ( @sDocOri CHAR(20) )
AS 
    BEGIN
        DELETE FROM
            saDocumentoVenta
        WHERE
            ( co_tipo_doc = 'CFXG'
              OR co_tipo_doc = 'Giro'
            )
            AND nro_orig = @sDocOri

    END
```
