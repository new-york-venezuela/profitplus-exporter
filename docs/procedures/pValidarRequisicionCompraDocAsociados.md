# SP: pValidarRequisicionCompraDocAsociados
**Tipo**: Validar
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
CREATE PROCEDURE [dbo].[pValidarRequisicionCompraDocAsociados]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @sRequisicion CHAR(20)
		DECLARE @sDdocumento CHAR(20)
		DECLARE @PistaMensaje AS VARCHAR(MAX)
		DECLARE @HoraCorrida DATETIME
		DECLARE @uRowguid UNIQUEIDENTIFIER

	-- Se buscan registros huerfanos en saPlantillaCompraReqRelacion 
	--o cuyos documentos asociados esten nulos
				DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
				FOR
					--Cotización
					SELECT
							PCRREN.doc_num as requisicion, CPR.doc_num AS documento
					FROM
						saPlantillaCompraReng PCRREN 
						INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
						INNER JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
						--Documento:
						LEFT JOIN saCotizacionProveedorReng CPR ON CPR.rowguid = PCRREL.rowguid_reng_imp
						INNER JOIN saCotizacionProveedor CP ON CP.doc_num = CPR.doc_num
					WHERE
						PCRREL.rowguid_reng_imp IS NOT NULL AND PCRREL.rowguid_reng_imp NOT IN (Select rowguid From saCotizacionProveedorReng)
						--CP.anulado = 1 --or CPR.rowguid is null
		
					UNION
					--Factura de compra
					SELECT
							PCRREN.doc_num as requisicion, CPR.doc_num AS documento
					FROM
						saPlantillaCompraReng PCRREN 
						INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
						INNER JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
						--Documento:
						LEFT JOIN saFacturaCompraReng CPR ON CPR.rowguid = PCRREL.rowguid_reng_imp
						LEFT JOIN saFacturaCompra CP ON CP.doc_num = CPR.doc_num
					WHERE
						PCRREL.rowguid_reng_imp IS NOT NULL AND PCRREL.rowguid_reng_imp NOT IN (Select rowguid From saFacturaCompraReng)
						--CP.anulado = 1 --or CPR.rowguid is null

					UNION
					--Nota de recepcion
					SELECT
							PCRREN.doc_num as requisicion, CPR.doc_num AS documento
					FROM
						saPlantillaCompraReng PCRREN 
						INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
						INNER JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
						--Documento:
						LEFT
```
