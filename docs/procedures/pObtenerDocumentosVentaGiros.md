# SP: pObtenerDocumentosVentaGiros
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pObtenerDocumentosVentaGiros] ( @sCliente CHAR(16) )
AS 
    BEGIN
        SELECT
            DV.*
        FROM
            saDocumentoVenta DV
            INNER JOIN saTipoDocumento td ON DV.co_tipo_doc = td.co_tipo_doc
            INNER JOIN saCliente C ON C.co_cli = @sCliente
        WHERE
            td.usar_ventas = 1
            AND DV.anulado = 0
            AND DV.saldo > 0
            AND DV.co_cli = @sCliente
            AND DV.co_tipo_doc = 'FACT'
		
    END
```
