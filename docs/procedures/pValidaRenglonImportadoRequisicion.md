# SP: pValidaRenglonImportadoRequisicion
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
CREATE PROCEDURE [dbo].[pValidaRenglonImportadoRequisicion]
    (
      @gRowguid_Plantilla_Compra UNIQUEIDENTIFIER,
	  @gRowguid_Renglon UNIQUEIDENTIFIER
    )
AS 
    BEGIN
		
		DECLARE @TablaTemp TABLE (
		doc_num char(20)
		)
		INSERT INTO @TablaTemp
		--Cotizacion
			SELECT TOP(1) PC.doc_num
			FROM saPlantillaCompraReqRelacion REL
			inner join saCotizacionProveedorReng DCR ON DCR.rowguid = REL.rowguid_reng_imp
			inner join saCotizacionProveedor DC ON DC.doc_num = DCR.doc_num 
			inner join saPlantillaCompraReqRenglon PCRR ON PCRR.rowguid = REL.rowguid_reng_req
			inner join saPlantillaCompraReng PC ON PC.rowguid = PCRR.rowguid_plantilla_renglon
			WHERE 
				DC.rowguid = @gRowguid_Plantilla_Compra AND
				DCR.rowguid = @gRowguid_Renglon
			UNION
		--Factura
			SELECT TOP(1) PC.doc_num
			FROM saPlantillaCompraReqRelacion REL
			inner join saFacturaCompraReng DCR ON DCR.rowguid = REL.rowguid_reng_imp
			inner join saFacturaCompra DC ON DC.doc_num = DCR.doc_num 
			inner join saPlantillaCompraReqRenglon PCRR ON PCRR.rowguid = REL.rowguid_reng_req
			inner join saPlantillaCompraReng PC ON PC.rowguid = PCRR.rowguid_plantilla_renglon
			WHERE 
				DC.rowguid = @gRowguid_Plantilla_Compra AND
				DCR.rowguid = @gRowguid_Renglon
			UNION
		--Nota Recepcion
			SELECT TOP(1) PC.doc_num
			FROM saPlantillaCompraReqRelacion REL
			inner join saNotaRecepcionCompraReng DCR ON DCR.rowguid = REL.rowguid_reng_imp
			inner join saNotaRecepcionCompra DC ON DC.doc_num = DCR.doc_num 
			inner join saPlantillaCompraReqRenglon PCRR ON PCRR.rowguid = REL.rowguid_reng_req
			inner join saPlantillaCompraReng PC ON PC.rowguid = PCRR.rowguid_plantilla_renglon
			WHERE 
				DC.rowguid = @gRowguid_Plantilla_Compra AND
				DCR.rowguid = @gRowguid_Renglon
			UNION
		--Orden de Compra
			SELECT TOP(1) PC.doc_num
			FROM saPlantillaCompraReqRelacion REL
			inner join saOrdenCompraReng DCR ON DCR.rowguid = REL.rowguid_reng_imp
			inner join saOrdenCompra DC ON DC.doc_num = DCR.doc_num 
			inner join saPlantillaCompraReqRenglon PCRR ON PCRR.rowguid = REL.rowguid_reng_req
			inner join saPlantillaCompraReng PC ON PC.rowguid = PCRR.rowguid_plantilla_renglon
			WHERE 
				DC.rowguid = @gRowguid_Plantilla_Compra AND
				DCR.rowguid = @gRowguid_Renglon

			if not exists(SELECT TOP(1) * FROM @TablaTemp)
				INSERT INTO @TablaTemp(doc_num) VALUES ('') 
			SELECT TOP(1) * FROM @TablaTemp

    END
```
