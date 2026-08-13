# SP: pObtenerDatosCorreoDocumentoElectronico
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaVenta`](../tables/saPlantillaVenta.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)
- [`saTipoProveedor`](../tables/saTipoProveedor.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:		pObtenerDocumentoElectronico
-- DESCRIPCIÓN: Obtener documentos electrónicos
-- AUTOR:		SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pObtenerDatosCorreoDocumentoElectronico]
	(	  
	  @sDoc_num CHAR(20),	  
	  @sCo_grupo_rep CHAR(6)
	)
AS
	BEGIN

	--FACTURA DE VENTA
		IF (@sCo_grupo_rep) = 'FACVE'
			SELECT
				CL.co_cli as 'Cliente:Pk_Co_Cli', CL.cli_des as 'Cliente:Cli_Des', CL.tip_cli as 'Cliente:Tipo',
				TCL.des_tipo as 'Cliente:Des_Tipo', CL.rif as 'Cliente:Rif', CL.nit as 'Cliente:Nit', CL.direc1 as 'Cliente:Direc1', 
				FV.doc_num as 'Documento de Venta:Pk_Nro_Doc', FV.n_control as 'Documento de Venta:N_Control',
				FV.status as 'Documento de Venta:Status', FV.co_cond as 'Documento de Venta:Co_Cond',
				CP.cond_des as 'Documento de Venta:Cond_Des', FV.fec_emis as 'Documento de Venta:Fec_Emis',
				FV.fec_venc as 'Documento de Venta:Fec_Venc', FV.co_ven as 'Documento de Venta:Co_Ven',
				VEN.ven_des as 'Documento de Venta:Ven_Des', FV.co_mone as 'Documento de Venta:Co_Mone',
				MON.mone_des as 'Documento de Venta:Mone_Des', FV.descrip as 'Documento de Venta:Observa', 
				FV.total_bruto as 'Documento de Venta:Total_Bruto', FV.monto_imp as 'Documento de Venta:Monto_Imp',
				FV.total_neto as 'Documento de Venta:Total_Neto', FV.saldo as 'Documento de Venta:Saldo',
				CL.email_alterno
			FROM 
				saFacturaVenta FV			
				INNER JOIN saCliente CL ON CL.co_cli = FV.co_cli
				INNER JOIN saTipoCliente TCL ON TCL.tip_cli = CL.tip_cli
				INNER JOIN saCondicionPago CP ON CP.co_cond = FV.co_cond
				INNER JOIN saVendedor VEN ON VEN.co_ven = FV.co_ven
				INNER JOIN saMoneda MON ON MON.co_mone = FV.co_mone
			WHERE
				FV.doc_num = @sDoc_num
						
	--PEDIDO DE VENTA		
		ELSE IF (@sCo_grupo_rep) = 'PEDID'
			SELECT
				CL.co_cli as 'Cliente:Pk_Co_Cli', CL.cli_des as 'Cliente:Cli_Des', CL.tip_cli as 'Cliente:Tipo', 
				TCL.des_tipo as 'Cliente:Des_Tipo', CL.rif as 'Cliente:Rif', CL.nit as 'Cliente:Nit', CL.direc1 as 'Cliente:Direc1', 
				PV.doc_num as 'Documento de Venta:Pk_Nro_Doc', PV.n_control as 'Documento de Venta:N_Control', 
				PV.status as 'Documento de Venta:Status', PV.co_cond as 'Documento de Venta:Co_Cond',
				CP.cond_des as 'Documento de Venta:Cond_Des', PV.fec_emis as 'Documento de Venta:Fec_Emis',
				PV.fec_venc as 'Documento de Venta:Fec_Venc', PV.co_ven as 'Documento de Venta:Co_Ven',
```
