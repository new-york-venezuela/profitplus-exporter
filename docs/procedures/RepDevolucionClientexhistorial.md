# SP: RepDevolucionClientexhistorial
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03/06/2010>
-- Description:	<Reporte Devoluciones de Factura de Ventas por Historial>
-- =============================================
CREATE PROCEDURE [dbo].[RepDevolucionClientexhistorial] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
	@cCo_cliente_d CHAR(16) = NULL ,
    @cCo_cliente_h CHAR(16) = NULL ,
	@cCo_ven_d CHAR(6) = NULL ,
    @cCo_ven_h CHAR(6) = NULL ,
	@cCo_Transporte_d CHAR(6) = NULL ,
	@cCo_Transporte_h CHAR(6) = NULL ,
	@cCo_Zona_d CHAR(6) = NULL ,
    @cCo_Zona_h CHAR(6) = NULL ,
	@cCo_Mone CHAR(6) = NULL ,
    @cAnulado CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)
-- Insert statements for procedure here
-------------------------------
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------
SELECT DISTINCT

DVC.co_cli, DVC.anulado, CL.cli_des,
DVC.nro_doc AS nro_docDC, DVC.doc_num as doc_numDC, 
DVC.status as statusDC, DVC.fec_emis as fec_emisDC, DVC.fec_reg as fec_regDC,
NDV.doc_num as doc_numND, NDV.status as statusND, NDV.fec_emis as fec_emisND, NDV.fec_reg as fec_regND,
FVE.doc_num as doc_numFV, FVE.status as statusFV, FVE.fec_emis as fec_emisFV, FVE.fec_reg as fec_regFV,
NEE.doc_num as doc_numNE, NEE.status as statusNE, NEE.fec_emis as fec_emisNE, NEE.fec_reg as fec_regNE,
PE.doc_num as doc_numPV, PE.status as statusPV, PE.fec_emis as fec_emisPV, PE.fec_reg as fec_regPV,
CCE.doc_num as doc_numCC, CCE.status as statusCC, CCE.fec_emis as fec_emisCC,CCE.fec_reg as fec_regCC

FROM saDevolucionCliente DVC
Inner join saDevolucionClienteReng DVR ON DVC.doc_num = DVR.doc_num

/*************************************************************************************************/

Left join saNotaDespachoVentaReng NDR ON 
(DVR.tipo_doc = 'NDES' AND DVR.rowguid_doc = NDR.rowguid)
Left join saNotaDespachoVenta NDV ON NDV.doc_num = NDR.doc_num

Left join saFacturaVenta
```
