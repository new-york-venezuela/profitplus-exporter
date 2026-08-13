# SP: RepDevolucionProveedorxhistorial
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
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
-- Create date: <02/04/2015>
-- Description:	<Reporte de Devoluciones a Proveedores por Historial>
-- =============================================
CREATE PROCEDURE [dbo].[RepDevolucionProveedorxhistorial] 
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

-------------------------------
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------

SELECT DISTINCT

DVP.co_prov, DVP.anulado, PV.prov_des,
DVP.nro_fact as nro_facDP, DVP.doc_num as doc_numDP, DVP.nro_doc as nro_docDP,
DVP.status as statusDP, DVP.fec_emis as fec_emisDP, DVP.fec_reg as fec_regDP,
FCE.doc_num as doc_numFC, FCE.status as statusFCE, FCE.fec_emis as fec_emisFC, FCE.fec_reg as fec_regFC,
NRE.doc_num as doc_numNR, NRE.status as statusNRE, NRE.fec_emis as fec_emisNR, NRE.fec_reg as fec_regNR,
OCE.doc_num as doc_numOC, OCE.status as statusOC, OCE.fec_emis as fec_emisOC, OCE.fec_reg as fec_regOC,
CPE.doc_num as doc_numCP, CPE.status as statusCP, CPE.fec_emis as fec_emisCP, CPE.fec_reg as fec_regCP

FROM saDevolucionProveedor DVP
INNER JOIN saDevolucionProveedorReng DPR ON DPR.doc_num = DVP.doc_num

/*************************************************************************************************/

Left join saFacturaCompraReng FCR ON 
(DPR.tipo_doc = 'COMP' AND DPR.rowguid_doc = FCR.rowguid)
Left join saFacturaCompra FCE ON FCE.doc_num = FCR.doc_num

Left join saNotaRecepcionCompraReng NRR ON 
(FCR.tipo_doc = 'NREC' AND FCR.rowguid_doc = NRR.rowguid) OR
(DPR.tipo_doc = 'NREC' AND DPR.rowguid_doc = NRR.rowguid)
Left join saNotaRecepcionCompra NRE ON NRE.doc_num = NR
```
