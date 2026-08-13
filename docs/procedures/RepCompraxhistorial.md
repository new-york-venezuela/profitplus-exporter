# SP: RepCompraxhistorial
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02/02/2015>
-- Description:	<Reporte de Factura de Compras Con Historial>
-- =============================================
CREATE PROCEDURE [dbo].[RepCompraxhistorial] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Proveedor_d CHAR(16) = NULL ,
    @cCo_Proveedor_h CHAR(16) = NULL ,
    @cCo_Zona_d CHAR(6) = NULL ,
    @cCo_Zona_h CHAR(6) = NULL ,
	@cCo_Segmento_d CHAR(6) = NULL ,
    @cCo_Segmento_h CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
	@cAnulado CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @dCo_fecha_d IS NOT NULL 
            SET @dCo_fecha_d = dbo.FechaSimple(@dCo_fecha_d)
        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = dbo.FechaSimple(@dCo_fecha_h)  
------------------------------
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------
        SELECT DISTINCT

FCE.co_prov, FCE.anulado ,PV.prov_des, PV.co_seg, 
FCE.nro_fact as nro_factFC, FCE.doc_num as doc_numFC, 
FCE.status as statusFC, FCE.fec_emis as fec_emisFC, FCE.fec_reg as fec_regFC,
NRE.doc_num as doc_numNR, NRE.status as statusNR, NRE.fec_emis as fec_emisNR, NRE.fec_reg as fec_regNR,
OCE.doc_num as doc_numOC, OCE.status as statusOC, OCE.fec_emis as fec_emisOC, OCE.fec_reg as fec_regOC,
CPE.doc_num as doc_numCP, cpe.status as statusCP, CPE.fec_emis as fec_emisCP, CPE.fec_reg as fec_regCP

FROM saFacturaCompra FCE 
inner join saFacturaCompraReng FCR ON FCE.doc_num = FCR.doc_num

/*************************************************************************************************/

Left join saNotaRecepcionCompraReng NRR ON
(FCR.tipo_doc = 'NREC' AND FCR.rowguid_doc = NRR.rowguid)
Left join saNotaRecepcionCompra NRE ON NRE.doc_num = NRR.doc_num

Left join saOrdenCompraReng OCR ON
(FCR.tipo_doc = 'OCOM' AND FCR.rowguid_doc = OCR.rowguid) OR
(NRR.tipo_doc = 'OCOM' AND NRR.rowguid_doc = OCR.rowguid)
Left join saOrdenCompra OCE ON OCE.doc_num = OCR.doc_num

Left join saCotizacionProveedorReng CPR ON
(FCR.tipo_doc = 'CPRO' AND FCR.rowguid_doc = CPR.rowguid) OR
(NRR.tipo_doc = 'CPRO' AND NRR.ro
```
