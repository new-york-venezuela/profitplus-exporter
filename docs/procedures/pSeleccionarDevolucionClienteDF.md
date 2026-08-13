# SP: pSeleccionarDevolucionClienteDF
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pSeleccionarDevolucionVenta
*DESCRIPCIÓN	: Selecciona una devolucion de venta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarDevolucionClienteDF] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            v.*, c.sincredito, c.dir_ent2, c.plaz_pag, c.desc_glob, c.co_ven, c.tip_cli, c.cli_des, c.rif, c.direc1,v.monto_desc_glob ,v.monto_reca, 
            c.telefonos, DVF.impfis AS Serial_FacIMP, DVF.impfisfac AS FacturaIMP, fv.fe_us_in AS FechaIMP , isnull(base_imponible,0) AS baseigtf
        FROM
            saDevolucionCliente v
            INNER JOIN saCliente c ON v.co_cli = c.co_cli
            INNER JOIN saDevolucionClienteReng dcr ON dcr.doc_num = v.doc_num
            INNER JOIN saFacturaVenta fv ON dcr.num_doc = fv.doc_num
			LEFT JOIN saDocumentoVenta DV ON v.nro_doc = DV.nro_doc AND DV.co_tipo_doc = 'N/CR'
			LEFT JOIN  saDocumentoVentaInfoIGTF DVIG ON DV.rowguid = DVIG.rowguid
			LEFT JOIN saDocumentoVenta DVF ON fv.doc_num = DVF.nro_doc and DVF.co_tipo_doc ='FACT'
        WHERE
            v.doc_num = @sDoc_Num

    END
```
