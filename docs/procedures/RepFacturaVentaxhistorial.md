# SP: RepFacturaVentaxhistorial
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03/06/2010>
-- Description:	<Reporte de Factura de Ventas por Historial>
-- =============================================
CREATE PROCEDURE [dbo].[RepFacturaVentaxhistorial] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_cliente_d CHAR(16) = NULL ,
    @cCo_cliente_h CHAR(16) = NULL ,
	@cCo_Ven_d CHAR(6) = NULL ,
    @cCo_Ven_h CHAR(6) = NULL ,
    @cCo_Transporte_d CHAR(6) = NULL ,
    @cCo_Transporte_h CHAR(6) = NULL ,
    @cCo_Zona_d CHAR(6) = NULL ,
    @cCo_Zona_h CHAR(6) = NULL ,
    @cImprSubTotal CHAR(6) = NULL ,
    @cCo_Mone CHAR(6) = NULL ,
    @cStatus CHAR(6) = NULL ,
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
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------
SELECT DISTINCT

FVE.co_cli, FVE.anulado, CL.cli_des, ARTU.co_uni, 
FVE.doc_num as doc_numFV, FVE.status as statusFV, FVE.fec_emis as fec_emisFV, FVE.fec_reg as fec_regFV,
NEE.doc_num as doc_numNE, NEE.status as statusNE, NEE.fec_emis as fec_emisNE, NEE.fec_reg as fec_regNE,
PE.doc_num as doc_numPV, PE.status as statusPV, PE.fec_emis as fec_emisPV, PE.fec_reg as fec_regPV,
CCE.doc_num as doc_numCC, CCE.status as statusCC, CCE.fec_emis as fec_emisCC, CCE.fec_reg as fec_regCC

FROM saFacturaVenta FVE
inner join saFacturaVentaReng FVR ON FVE.doc_num = FVR.doc_num

/*************************************************************************************************/

Left join saNotaEntregaVentaReng NER ON 
(FVR.tipo_doc = 'NENT' AND FVR.rowguid_doc = NER.rowguid)
Left join saNotaEntregaVenta NEE ON NEE.doc_num = NER.doc_num

Left join saPedidoVentaReng PER ON 
(FVR.tipo_doc = 'PCLI' AND FVR.rowguid_doc = PER.rowguid) OR
(NER.tipo_doc = 'PCLI' AND
```
