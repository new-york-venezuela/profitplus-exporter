# SP: pSeleccionarDevolucionClienteDF_Dom
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pSeleccionarDevolucionClienteDF_Dom
*DESCRIPCIÓN	: Selecciona una devolucion de venta
*AUTOR			: SOFTECH SISTEMAS
*FECHA CREACION : 2019-04-23
*FECHA MODIFICA : 2019-06-20
*************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarDevolucionClienteDF_Dom] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            v.*, c.sincredito, c.dir_ent2, c.plaz_pag, c.desc_glob, c.co_ven, c.tip_cli, c.cli_des, c.rif, c.direc1,
            c.telefonos, fv.impfis AS Serial_FacIMP, fv.impfisfac AS FacturaIMP, fv.fe_us_in AS FechaIMP, fv.doc_num AS Nfac_afec,
			n.ncf,n2.ncf ncf_afec, dbo.ClienteExonerado_NCF(c.co_cli) cliente_exonerado
        FROM
            saDevolucionCliente v
            INNER JOIN saCliente c ON v.co_cli = c.co_cli
            INNER JOIN saDevolucionClienteReng dcr ON dcr.doc_num = v.doc_num
            INNER JOIN saFacturaVenta fv ON dcr.num_doc = fv.doc_num
			INNER JOIN saNCFInfoDocVenta n ON v.nro_doc = n.nro_doc and v.co_tipo_doc = n.tipo_doc
			INNER JOIN saNCFInfoDocVenta n2 ON dcr.num_doc = n2.nro_doc and dcr.tipo_doc = n2.tipo_doc
        WHERE
            v.doc_num = @sDoc_Num

    END
```
