# SP: pSeleccionarOrdenCompra
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			: pSeleccionarOrdenCompra
DESCRIPCION		: Selecciona un registro segun su primary key
CREADO POR		: SOFTECH SISTEMAS
MODIFCADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarOrdenCompra] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            fc.*, ISNULL(cp.dias_cred, 0) AS dias_cred, CAST(ISNULL(dc.pagar, 0) AS BIT) AS autorizado
        FROM
            saOrdenCompra fc
            LEFT JOIN saCondicionPago cp ON fc.co_cond = cp.co_cond
            LEFT JOIN saDocumentoCompra dc ON fc.doc_num = dc.nro_doc
        WHERE
            doc_num = @sDoc_Num

    END
```
