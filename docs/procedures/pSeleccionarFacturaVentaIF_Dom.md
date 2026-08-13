# SP: pSeleccionarFacturaVentaIF_Dom
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pSeleccionarFacturaVentaIF_Dom
*DESCRIPCIÓN	: Selecciona una factura de venta
*AUTOR			: SOFTECH SISTEMAS
*FECHA CREACION : 2019-04-15
*FECHA MODIFICA : 2019-04-26
*************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarFacturaVentaIF_Dom] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

		SELECT
			c.cli_des, c.rif, c.direc1, c.telefonos, v.doc_num, v.porc_desc_glob, v.porc_reca, v.monto_desc_glob, v.monto_reca, v.total_neto, n.ncf, dbo.ClienteExonerado_NCF(c.co_cli) cliente_exonerado
		FROM
			saFacturaVenta v
			INNER JOIN saCliente c ON v.co_cli = c.co_cli
			INNER JOIN saNCFInfoDocVenta n ON v.doc_num = n.nro_doc
		WHERE v.doc_num = @sDoc_Num
			  AND n.tipo_doc = 'FACT'
	END
```
