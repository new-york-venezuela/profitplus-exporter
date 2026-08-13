# SP: pSeleccionarFacturaVentaIF
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pSeleccionarFacturaVenta
*DESCRIPCIÓN	: Selecciona una factura de venta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pSeleccionarFacturaVentaIF] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN
		
        SELECT
            c.cli_des, c.rif, c.direc1, c.telefonos, v.doc_num, v.porc_desc_glob, v.porc_reca, v.monto_desc_glob, v.monto_reca ,isnull(base_imponible,0) as baseigtf , V.ven_ter as ven_ter,
			V.comentario as comentario 
        FROM
            saFacturaVenta v
            INNER JOIN saCliente c ON v.co_cli = c.co_cli
			INNER JOIN saDocumentoVenta DV ON v.doc_num = DV.nro_doc AND co_tipo_doc = 'FACT'
			LEFT JOIN saDocumentoVentaInfoIGTF DVIG ON DV.rowguid = DVIG.rowguid

        WHERE
            doc_num = @sDoc_Num

    END
```
