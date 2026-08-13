# SP: pSeleccionarNotaRecepcionCompra
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			: pSeleccionarNotaRecepcionCompra
DESCRIPCION		: Selecciona un registro de la tabla saNotaRecepcionCompra segun su primary key
CREADO POR		: SOFTECH SISTEMAS
MODIFCADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarNotaRecepcionCompra] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            fc.*, ISNULL(cp.dias_cred, 0) AS dias_cred, ISNULL(dc.aut, 0) AS aut
        FROM
            saNotaRecepcionCompra fc
            LEFT JOIN saCondicionPago cp ON fc.co_cond = cp.co_cond
            LEFT JOIN saDocumentoCompra dc ON fc.doc_num = dc.nro_doc
        WHERE
            doc_num = @sDoc_Num

    END
```
