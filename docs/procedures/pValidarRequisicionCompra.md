# SP: pValidarRequisicionCompra
**Tipo**: Validar
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

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <29-03-2016>
-- Description:	<pValidarRequisicionCompra>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarRequisicionCompra]
	(
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
		DECLARE @valPendienteResult TABLE ( motivo VARCHAR(256))		
		DECLARE @Motivo VARCHAR(256)
		DECLARE @PistaMensaje VARCHAR(MAX)
		DECLARE @Valor INT
		DECLARE @Id1 UNIQUEIDENTIFIER		
		DECLARE @Tabla VARCHAR(32)
		DECLARE @Comentario  VARCHAR(MAX)
		DECLARE @Co_sucu_in CHAR(6)
		DECLARE @Co_sucu_mo CHAR(6)
		DECLARE @Revisado CHAR(1)
		DECLARE @Trasnfe CHAR(1)
		DECLARE @Reng_num INT
		DECLARE @Co_art CHAR(30)
		DECLARE @Art_des VARCHAR(100)
		DECLARE @Co_uni CHAR(6)
		DECLARE @Num_doc CHAR(20)		


		DECLARE @HoraCorrida DATETIME
				
		SET @HoraCorrida = GETDATE()

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAst_FORWARD
		FOR				 		
		
		/*
		1era parte
		*/
		--Valida que exista los renglones de la Factura de Compra que se importaron en la requisición 
			SELECT DISTINCT
				'La requisición nro. "' +  RTRIM(PC.doc_num) + CASE WHEN FCR.doc_num is null THEN 
				'" no posee factura de compra asociados.' ELSE '" posee un documento de compra anulado' END + ' *NC.' 
				AS motivo, 0 AS valor, NULL AS Id1, 'saFacturaCompra' AS tabla, NULL AS comentario, NULL AS co_sucu_in,
				NULL AS co_sucu_mo, NULL AS revisado, NULL AS trasnfe, 0 AS reng_num, NULL AS co_art, NULL AS art_des, NULL AS co_uni,
				NULL AS Num_doc
			FROM
				saPlantillaCompraReqRenglon PCRREN
				LEFT JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREN.rowguid AND RTRIM(PCRREL.co_tipo_doc) = 'COMP'
				LEFT JOIN saFacturaCompraReng FCR ON PCRREL.rowguid_reng_imp = FCR.rowguid
				LEFT JOIN saPlantillaCompraReng PCREN ON PCREN.rowguid = PCRREN.rowguid_plantilla_renglon
				INNER JOIN saPlantillaCompra PC ON PC.doc_num = PCREN.doc_num
				INNER JOIN saFacturaCompra FC ON FC.doc_num = FCR.doc_num
			WHERE 
				(PCRREL.rowguid_reng_imp NOT IN (SELECT rowguid FROM saFacturaCompraReng) OR FC.anulado = 1)

			UNION

			--Valida que exista los renglones de la Cotización de Proveedor que se importaron en la requisición
			SELECT DISTINCT
				'La requisición nro. "' +  RTRIM(PC.doc_num) + CASE WHEN CPR.doc_num is null THEN 
				'" no posee cotización de
```
