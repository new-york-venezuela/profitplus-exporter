# SP: pObtenerDocumentoElectronico
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoElectronico`](../tables/saDocumentoElectronico.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaVenta`](../tables/saPlantillaVenta.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:		pObtenerDocumentoElectronico
-- DESCRIPCIÓN: Obtener documentos electrónicos
-- AUTOR:		SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pObtenerDocumentoElectronico]
	(	  
	  @sCo_doc_elec CHAR(20),	  
	  @sTipo_documento CHAR(10)
	)
AS
	BEGIN

	--FACTURA DE VENTA
		IF (SELECT co_grupo_rep FROM saDocumentoElectronico WHERE co_doc_elec = @sCo_doc_elec AND tipo_documento = @sTipo_documento) = 'FACVE'
			SELECT
				FV.*, CL.cli_des, DE.co_doc_elec
			FROM 
			saFacturaVenta FV
			INNER JOIN saDocumentoElectronico DE ON DE.co_doc_elec = @sCo_doc_elec AND DE.tipo_documento = @sTipo_documento
			INNER JOIN saCliente CL ON CL.co_cli = FV.co_cli
			WHERE
			((DE.doc_num_desde IS NULL OR FV.doc_num >= DE.doc_num_desde)
						AND (DE.doc_num_hasta IS NULL OR FV.doc_num <= DE.doc_num_hasta)) AND
			((DE.fec_emis_desde IS NULL OR dbo.FechaSimple(FV.fec_emis) >= dbo.FechaSimple(DE.fec_emis_desde))
						AND (DE.fec_emis_hasta IS NULL OR dbo.FechaSimple(FV.fec_emis) <= dbo.FechaSimple(DE.fec_emis_hasta))) AND
			((DE.fec_venc_desde IS NULL OR dbo.FechaSimple(FV.fec_venc) >= dbo.FechaSimple(DE.fec_venc_desde))
						AND (DE.fec_venc_hasta IS NULL OR dbo.FechaSimple(FV.fec_venc) <= dbo.FechaSimple(DE.fec_venc_hasta))) AND
			((DE.co_cli_desde IS NULL OR FV.co_cli >= DE.co_cli_desde)
						AND (DE.co_cli_hasta IS NULL OR FV.co_cli <= DE.co_cli_hasta)) AND
			(DE.status = 'T' OR DE.status = FV.status)
						
	--PEDIDO DE VENTA
		ELSE IF (SELECT co_grupo_rep FROM saDocumentoElectronico WHERE co_doc_elec = @sCo_doc_elec AND tipo_documento = @sTipo_documento) = 'PEDID'
			SELECT
				PV.*, CL.cli_des, DE.co_doc_elec
			FROM 
			saPedidoVenta PV
			INNER JOIN saDocumentoElectronico DE ON DE.co_doc_elec = @sCo_doc_elec AND DE.tipo_documento = @sTipo_documento
			INNER JOIN saCliente CL ON CL.co_cli = PV.co_cli
			WHERE
			((DE.doc_num_desde IS NULL OR PV.doc_num >= DE.doc_num_desde)
						AND (DE.doc_num_hasta IS NULL OR PV.doc_num <= DE.doc_num_hasta)) AND
			((DE.fec_emis_desde IS NULL OR dbo.FechaSimple(PV.fec_emis) >= dbo.FechaSimple(DE.fec_emis_desde))
						AND (DE.fec_emis_hasta IS NULL OR dbo.FechaSimple(PV.fec_emis) <= dbo.FechaSimple(DE.fec_emis_hasta))) AND
			((DE.fec_venc_desde IS NULL OR dbo.FechaSimple(PV.fec_venc) >= dbo.FechaSimple(DE.fec_venc_desde))
						AND (DE.fec_venc_hasta IS NULL OR dbo.FechaSimple(PV.fec_ven
```
