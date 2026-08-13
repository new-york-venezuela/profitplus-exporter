# SP: pObtenerDocumentosCompraFiltrado
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarOrdenPago
DESCRIPCION: Selecciona todos los campos de Documento de Compra Filtrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [pObtenerDocumentosCompraFiltrado] ( @sProveedor CHAR(16) )
AS 
    BEGIN

        IF ( @sProveedor = ''
             OR @sProveedor IS NULL
           ) 
            BEGIN
                SELECT
                    dc.*,
			  -- ISNULL(DAY(GETDATE() - dc.fec_venc) -1,0)  AS diasVencimiento, 
                    ISNULL(DATEDIFF(day, fec_venc, GETDATE()), 0) AS diasVencimiento, td.tipo_mov
                FROM
                    saDocumentoCompra dc
                    INNER JOIN saTipoDocumento td ON dc.co_tipo_doc = td.co_tipo_doc
                WHERE
                    dc.anulado = 0
                    AND td.act_prog_pago = 1
                    AND ( dc.co_tipo_doc = 'ADEL'
                          OR dc.co_tipo_doc = 'FACT'
                          OR dc.co_tipo_doc = 'GIRO'
                          OR dc.co_tipo_doc = 'N/DB'
                        )
                    AND dc.saldo > 0
		
            END
        ELSE 
            BEGIN
                SELECT
                    dc.*,
		--ISNULL(DAY( GETDATE() - dc.fec_venc)-1,0)  AS diasVencimiento, 
                    ISNULL(DATEDIFF(day, fec_venc, GETDATE()), 0) AS diasVencimiento, td.tipo_mov
                FROM
                    saDocumentoCompra dc
                    INNER JOIN saTipoDocumento td ON dc.co_tipo_doc = td.co_tipo_doc
                WHERE
                    dc.anulado = 0
                    AND td.act_prog_pago = 1
                    AND ( dc.co_tipo_doc = 'ADEL'
                          OR dc.co_tipo_doc = 'FACT'
                          OR dc.co_tipo_doc = 'GIRO'
                          OR dc.co_tipo_doc = 'N/DB'
                        )
                    AND dc.saldo > 0
                    AND dc.co_prov = @sProveedor
            END
    END
```
