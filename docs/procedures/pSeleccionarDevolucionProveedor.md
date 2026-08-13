# SP: pSeleccionarDevolucionProveedor
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			: pSeleccionarDevolucionProveedor
DESCRIPCION		: Selecciona un registro de la tabla saDevolucionProveedor segun su primary key
CREADO POR		: SOFTECH SISTEMAS
FECHA ACTUALIZACIÓN: 2019-04-29
MODIFCADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarDevolucionProveedor] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            fc.*, ISNULL(cp.dias_cred, 0) AS dias_cred, CAST(ISNULL(dc.pagar, 0) AS BIT) AS autorizado,
            [dbo].[ObtenerNControlNCR](fc.co_tipo_doc, fc.nro_doc) AS n_control_ncr,
            [dbo].[ObtenerNPago]('DEVO', @sDoc_Num) AS n_pago,
			NCF.ncf as NumeroControlFiscal, NCF.co_anulacion as co_anulacion, NCF.co_serie AS co_serie, 
			ST.des_tipo_serie AS des_tipo_serie, NCF.tipo_doc_Ori AS tipo_doc_ori, NCF.nro_doc_Ori AS nro_doc_Ori,
			NCF.co_gasto AS co_gasto
        FROM
            saDevolucionProveedor fc
            LEFT JOIN saCondicionPago cp ON fc.co_cond = cp.co_cond
            --LEFT JOIN saDocumentoCompra dc ON fc.doc_num = dc.nro_doc
			LEFT JOIN saDocumentoCompra dc ON dc.doc_orig = 'DEVO' AND dc.nro_orig = fc.doc_num
			--LEFT JOIN saNCFInfoDocVenta NCF ON NCF.nro_doc = dc.nro_doc AND NCF.tipo_doc = dc.co_tipo_doc
			LEFT JOIN saNCFInfoDocCompra NCF ON NCF.nro_doc = dc.nro_doc AND NCF.tipo_doc = dc.co_tipo_doc
			LEFT JOIN saSerie SE ON NCF.co_serie = SE.co_serie
			LEFT JOIN saSerieTipo ST ON SE.co_tipo_serie = ST.co_tipo_serie
        WHERE
            doc_num = @sDoc_Num

    END
```
