# SP: pDocumentoImportadoEnRequisicion
**Tipo**: Procedimiento
**Módulo**: Compras

## Tablas Referenciadas
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

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pDocumentoImportadoEnRequisicion
DESCRIPCION:	Devuelve requisición asociada al documento
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [dbo].[pDocumentoImportadoEnRequisicion]
    @sCo_Tipo_Doc AS CHAR(6) ,
    @sDoc_Num AS CHAR(20)
AS 
    BEGIN
		DECLARE @sRequisicion CHAR(20)
		SET @sRequisicion = ''

		IF @sCo_Tipo_Doc = 'CPROV'
		BEGIN
			SET @sRequisicion = (SELECT
				TOP(1) PCRREN.doc_num
			FROM 
				saPlantillaCompraReng PCRREN 
				INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
				INNER JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
				INNER JOIN saCotizacionProveedorReng CPR ON CPR.rowguid = PCRREL.rowguid_reng_imp
				INNER JOIN saCotizacionProveedor CP ON CP.doc_num = CPR.doc_num
			WHERE 
				CP.doc_num = @sDoc_Num)
		END
        IF @sCo_Tipo_Doc = 'FACT'
		BEGIN
			SET @sRequisicion = (SELECT
				TOP(1) PCRREN.doc_num
			FROM 
				saPlantillaCompraReng PCRREN 
				INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
				INNER JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
				INNER JOIN saFacturaCompraReng CPR ON CPR.rowguid = PCRREL.rowguid_reng_imp
				INNER JOIN saFacturaCompra CP ON CP.doc_num = CPR.doc_num
			WHERE 
				CP.doc_num = @sDoc_Num)
		END
		IF @sCo_Tipo_Doc = 'NREC'
		BEGIN
			SET @sRequisicion = (SELECT
				TOP(1) PCRREN.doc_num
			FROM 
				saPlantillaCompraReng PCRREN 
				INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
				INNER JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
				INNER JOIN saNotaRecepcionCompraReng CPR ON CPR.rowguid = PCRREL.rowguid_reng_imp
				INNER JOIN saNotaRecepcionCompra CP ON CP.doc_num = CPR.doc_num
			WHERE 
				CP.doc_num = @sDoc_Num)
		END
		IF @sCo_Tipo_Doc = 'OCOMP'
		BEGIN
			SET @sRequisicion = (SELECT
				TOP(1) PCRREN.doc_num
			FROM 
				saPlantillaCompraReng PCRREN 
				INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
				INNER JOIN saPlantillaCompraR
```
