# SP: pSeleccionarRenglonesPlantillaCompraReqRelacion
**Tipo**: Seleccionar
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
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		:	pSeleccionarRenglonesPlantillaCompraReqRelacion
DESCRIPCION	:	Procedimiento para seleccionar los renglones de PlantillaCompraReqRelacion
CREADO POR	:	SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesPlantillaCompraReqRelacion]
    (
      @gRowguid_Reng_Req UNIQUEIDENTIFIER
    )
AS 
    BEGIN
		--Cotización
        SELECT
			  'Cotización' AS documento, CPR.doc_num, CP.fec_reg AS fecha_doc, CP.status AS estatus, p.prov_des, 
			  A.co_art, A.art_des, CPR.co_uni, PCRREL.comentario, PCRREL.rowguid_reng_req, PCRREL.rowguid_reng_imp,
			  PCRREL.entregado, PCRREL.fecha_real_entrega, PCRREL.total_art
        FROM
			saPlantillaCompraReng PCRREN 
			INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
            INNER JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
			--Documento:
			INNER JOIN saCotizacionProveedorReng CPR ON CPR.rowguid = PCRREL.rowguid_reng_imp
			INNER JOIN saCotizacionProveedor CP ON CP.doc_num = CPR.doc_num
			INNER JOIN saProveedor P ON P.co_prov = CP.co_prov
			INNER JOIN saArticulo A ON A.co_art = CPR.co_art
        WHERE
            PCRREL.rowguid_reng_req = @gRowguid_Reng_Req
		
		UNION
		--Factura de compra
		SELECT
			  'Factura' AS documento, CPR.doc_num, CP.fec_reg AS fecha_doc, CP.status AS estatus, p.prov_des, 
			  A.co_art, A.art_des, CPR.co_uni, PCRREL.comentario, PCRREL.rowguid_reng_req, PCRREL.rowguid_reng_imp,
			  PCRREL.entregado, PCRREL.fecha_real_entrega, PCRREL.total_art
        FROM
			saPlantillaCompraReng PCRREN 
			INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
            INNER JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
			--Documento:
			INNER JOIN saFacturaCompraReng CPR ON CPR.rowguid = PCRREL.rowguid_reng_imp
			INNER JOIN saFacturaCompra CP ON CP.doc_num = CPR.doc_num
			INNER JOIN saProveedor P ON P.co_prov = CP.co_prov
			INNER JOIN saArticulo A ON A.co_art = CPR.co_art
        WHERE
            PCRREL.rowguid_reng_req = @gRowguid_Reng_Req

		UNION
		--Nota de recepcion
		SELECT
			  'Nota de recepcion' AS documento, CPR.
```
