# SP: RepRequisicionConRenglonesYDocumentos
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/08/2010>
-- Description:	<Reporte de Cotizaciones de Proveedores por Proveedor >
-- LAST DATE:	2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepRequisicionConRenglonesYDocumentos] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
	@cStatus CHAR(10) = NULL ,
	@sDocumentos CHAR(10) = NULL ,
	@sCo_Ubicacion CHAR(6) = NULL ,
	@sResponsable CHAR(128) = NULL ,
    @bHeaderRep     BIT = 0
AS 
    BEGIN
    
    SET NOCOUNT ON;
    
        SELECT
			  PC.doc_num, PCR.fe_us_in, PCR.estatus, PCR.co_ubicacion, UBI.des_ubicacion, PCR.autorizado, PCR.responsable, PCRREN.reng_num, 
			  PCRREQREN.estatus, PCRREQREN.satisface, PCRREN.co_art, A.art_des, PCRREN.co_uni, PCRREN.total_art,
			  PCRREQREN.fecha_requerida, PCRREQREN.fecha_real_entrega, 'Cotización' AS Documento, CP.doc_num,
			  CP.fec_emis, CPR.co_art, A2.art_des as des_art, CPR.co_uni, CPR.total_art, CPR.reng_num

        FROM
			saPlantillaCompraReng PCRREN 
			INNER JOIN saPlantillaCompra PC ON PC.doc_num = PCRREN.doc_num
			INNER JOIN saPlantillaCompraReq PCR ON PCR.rowguid_plantilla_compra = PC.rowguid
			INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
            LEFT JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
			INNER JOIN saUbicacion UBI ON UBI.co_ubicacion = PCR.co_ubicacion
			--Documento:
			LEFT JOIN saCotizacionProveedorReng CPR ON CPR.rowguid = PCRREL.rowguid_reng_imp
			LEFT JOIN saCotizacionProveedor CP ON CP.doc_num = CPR.doc_num
			LEFT JOIN saProveedor P ON P.co_prov = CP.co_prov
			INNER JOIN saArticulo A ON A.co_art = PCRREN.co_art
			LEFT JOIN saArticulo A2 ON A2.co_art = CPR.co_art
		WHERE
			PC.doc_num IN (SELECT dbo.saPlantillaCompra.doc_num
							FROM            dbo.saPlantillaCompraReng INNER JOIN
								 dbo.saPlantillaCompraReqRenglon ON dbo.saPlantillaCompraReng.rowguid = dbo.saPlantillaCompraReqRenglon.rowguid_plantilla_renglon INNER JOIN
								 dbo.saPlantillaCompra ON dbo.saPlantillaCompraReng.doc_num = dbo.saPlantillaCompra.doc_num INNER JOIN
								 dbo.saPlantillaCompraReq ON dbo.saPlantillaCompra.rowguid = dbo.saPlantillaCompraReq.rowgu
```
