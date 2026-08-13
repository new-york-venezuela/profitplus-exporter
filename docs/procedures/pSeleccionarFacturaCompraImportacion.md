# SP: pSeleccionarFacturaCompraImportacion
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompraImportacion`](../tables/saFacturaCompraImportacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarFacturaCompraImportacion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarFacturaCompraImportacion] ( @sDoc_num CHAR(30), @sCo_tipo_doc CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saFacturaCompraImportacion
        WHERE
            doc_num = @sDoc_num AND co_tipo_doc = @sCo_tipo_doc
    END
```
