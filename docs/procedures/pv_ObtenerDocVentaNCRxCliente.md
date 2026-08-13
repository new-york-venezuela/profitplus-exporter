# SP: pv_ObtenerDocVentaNCRxCliente
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ObtenerDocVentaNCRxCliente]
*DESCRIPCIÓN	: BUSCA UNA LISTA DE NOTAS DE CREDITO QUE CORRESPONDAN AL NUMERO DE 
				  CLIENTE QUE LLEGA POR PARAMETRO, CON SALDO MAYOR A CERO Y NO ESTEN ANULADAS  
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROC [dbo].[pv_ObtenerDocVentaNCRxCliente]
(
	@co_cli CHAR(16)
)
AS
BEGIN
		SELECT  nro_doc,  doc_orig, nro_orig, total_neto AS monto_net, saldo, 0.00 AS abonado, fec_emis, saldo AS saldoOld
			FROM saDocumentoVenta 
				WHERE co_tipo_doc = 'N/CR' AND co_cli = @co_cli AND saldo > 0 AND anulado = 0
				ORDER BY fec_emis,nro_doc
END
```
