# SP: pSeleccionarNotaDeDebitoDF
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pSeleccionarDevolucionVenta
*DESCRIPCIÓN	: Selecciona una devolucion de venta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarNotaDeDebitoDF] ( @sDoc_Num CHAR(20) )
AS 

 BEGIN
 	SELECT 
		CL.*, FACT.nro_doc AS doc_num, NCR.nro_doc AS co_art, DVR.porc_imp,
		concat('Ajuste x Dif. Cambiario - Tasa ' , RTRIM(LTRIM(STR(dvr.porc_imp))) , '%' )  AS art_des, DV.porc_desc_glob, 
		DV.monto_desc_glob, DV.porc_reca, DV.monto_reca, DVR.prec_vta AS prec_vta, DVR.reng_neto, DVR.monto_imp AS monto_imp, 
		1 AS total_art, FV.impfis AS Serial_FacIMP, FV.impfisfac AS FacturaIMP,DV.fe_us_in AS FechaIMP , isnull(base_imponible,0) AS baseigtf , 
		ROUND(dbo.CalcularMontoPorcentaje(DVR.porc_desc, DVR.prec_vta, 1) * 100 / DVR.prec_vta, 2) AS Porc_real , dv.tipo_origen as tipo_origen , DV.anulado as anulado , FV.anulado as fact_anulado ,DV.impresa
	FROM
		saDocumentoVenta AS DV
		inner JOIN saCobroDocReng NCR ON DV.nro_doc = NCR.nro_doc and NCR.co_tipo_doc = 'N/DB'	
		INNER JOIN saCobroDocReng FACT ON FACT.rowguid = NCR.rowguid_reng_ori
		INNER JOIN saDocumentoVentaReng DVR ON DVR.nro_doc = NCR.nro_doc and DVR.co_tipo_doc = 'N/DB'
		INNER JOIN saCliente CL ON CL.co_cli = DV.co_cli
		INNER JOIN saFacturaVenta FV ON FV.doc_num = FACT.nro_doc
		LEFT JOIN  saDocumentoVentaInfoIGTF DVIG ON DV.rowguid = DVIG.rowguid
WHERE DV.co_tipo_doc = 'N/DB' AND NCR.nro_doc = @sDoc_Num 
END
```
