# SP: pObtenerNumneroComprobantePorDocumento
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pObtenerNumneroComprobantePorDocumento]
DESCRIPCION:	Obtener la retención de iva
CREADO POR:		SOFTECH SISTEMAS
FECHA:			07/10/2011
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerNumneroComprobantePorDocumento]
    (
		  @sNro_Doc CHAR(20) ,
		  @sCo_Tipo_Doc CHAR(6)
    )
AS 
		SELECT DC.co_tipo_doc, DC.nro_doc , DC.Prov_Ter as Proveedor, DC.num_comprobante FROM saDocumentoCompra DC
		WHERE DC.co_tipo_doc = 'IVAN' AND dc.anulado = 0  
		AND DC.nro_doc IN 
			(
			SELECT PR.nro_doc FROM saPagoDocReng PR
			WHERE PR.co_tipo_doc IN ('IVAN')
			AND rowguid_reng_ori IN
			(SELECT PR.rowguid FROM saPagoDocReng PR
			WHERE PR.co_tipo_doc = @sCo_Tipo_Doc AND PR.nro_doc = @sNro_Doc)
			)
		UNION
		SELECT DC.co_tipo_doc , DC.nro_doc , DC.Prov_Ter as Proveedor, DC.num_comprobante  FROM saDocumentoCompra DC
		WHERE DC.co_tipo_doc = 'IVAP' AND dc.anulado = 0
		AND DC.nro_doc IN 
			(
			SELECT PR.nro_doc FROM saPagoDocReng PR
			WHERE PR.co_tipo_doc IN ('IVAP')
			AND rowguid_reng_ori IN
			(SELECT PR.rowguid FROM saPagoDocReng PR
			WHERE PR.co_tipo_doc = @sCo_Tipo_Doc AND PR.nro_doc = @sNro_Doc)
			)
```
