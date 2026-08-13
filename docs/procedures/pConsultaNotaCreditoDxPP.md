# SP: pConsultaNotaCreditoDxPP
**Tipo**: Procedimiento
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <09/03/2015>
-- Description:	<Formato de Nota de Credito Por DxPP>
CREATE PROCEDURE [dbo].[pConsultaNotaCreditoDxPP] ( @sDoc_Num CHAR(20) )
AS 
 BEGIN
 	SELECT 
		CL.*, NULL AS doc_num, NCR.nro_doc AS co_art, DVR.porc_imp,
		
		CASE WHEN DV.tipo_origen = 2 THEN 'Dif. cambiario ' 
		ELSE 'Desct pronto pago ' END  AS art_des
		, DV.porc_desc_glob, 
		DV.monto_desc_glob, DV.porc_reca, DV.monto_reca, DVR.reng_neto AS prec_vta, DV.total_neto, 0 AS porc_real, 
		1 AS total_art, FV.impfis AS Serial_FacIMP, FV.impfisfac AS FacturaIMP,DV.fe_us_in AS FechaIMP , 0.00 as baseigtf  , DV.anulado , DV.impresa , DV.doc_orig
	FROM
		saDocumentoVenta AS DV
		INNER JOIN saCobroDocReng NCR ON DV.nro_doc = NCR.nro_doc		
		INNER JOIN saCobroDocReng FACT ON FACT.rowguid = NCR.rowguid_reng_ori
		INNER JOIN saDocumentoVentaReng DVR ON DVR.nro_doc = NCR.nro_doc
		INNER JOIN saCliente CL ON CL.co_cli = DV.co_cli
		INNER JOIN saFacturaVenta FV ON FV.doc_num = FACT.nro_doc
	WHERE DV.co_tipo_doc = 'N/CR' AND NCR.nro_doc = @sDoc_Num

 END
```
