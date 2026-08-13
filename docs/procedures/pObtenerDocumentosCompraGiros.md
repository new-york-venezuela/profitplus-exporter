# SP: pObtenerDocumentosCompraGiros
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pObtenerDocumentosCompraGiros] ( @sProveedor CHAR(16) )
AS 
    BEGIN
        SELECT
            dc.*
        FROM
            saDocumentoCompra dc
            INNER JOIN saTipoDocumento td ON dc.co_tipo_doc = td.co_tipo_doc
            INNER JOIN saProveedor pr ON pr.co_prov = @sProveedor
        WHERE
            td.usar_compras = 1
            AND dc.anulado = 0
            AND dc.saldo > 0
            AND dc.co_prov = @sProveedor
            AND dc.co_tipo_doc = 'FACT'
		
    END
```
