# SP: RepCompraConCostosDetallados
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <19/05/2015>
-- Description:	<Reporte de Factura de Compras con sus costos detallados>
-- LAST DATE:2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepCompraConCostosDetallados] 
    @sCo_Numero_d CHAR(30) = NULL ,
    @sCo_Numero_h CHAR(30) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @slinea_d CHAR(6) = NULL ,
    @slinea_h CHAR(6) = NULL ,
    @sSubLinea_d CHAR(6) = NULL ,
    @sSubLinea_h CHAR(6) = NULL ,
    @sCategoria_d CHAR(6) = NULL ,
    @sCategoria_h CHAR(6) = NULL ,
    @sAnulado CHAR(6) = NULL ,
    @sCampOrderBy CHAR(30) = NULL,
    @sDir CHAR(5) = NULL,
    @bHeaderRep BIT = 0

AS 
    BEGIN
        SET NOCOUNT ON ;

IF @dCo_fecha_d IS NOT NULL 
            SET @dCo_fecha_d = dbo.FechaSimple(@dCo_fecha_d)
        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = dbo.FechaSimple(@dCo_fecha_h)


        IF ( @sAnulado IS NULL ) 
            SET @sAnulado = 'TODO'


       SELECT
                    FC.doc_num, A.art_des AS descrip, FC.fec_emis, FC.fec_venc, FC.co_prov, PROV.prov_des,
                    ALM.co_alma, ALM.des_alma, FCR.total_art AS cantidad, UNI.co_uni, 
                    PCR.doc_num AS des_uni,
                    ( CASE WHEN AU.uni_principal = 1 THEN FCR.cost_unit
                   ELSE FCR.cost_unit / ROUND(( dbo.ArtUnidadBase(FCR.co_art, FCR.co_uni, 1) ), 5)
              END ) AS costo_xunidadDest, 
                      FCR.cost_unit, DCRR.distrib_num_destino AS Distrib_Num, 
                    A2.co_art, A2.art_des, DCRR.monto AS Monto, 'Plantilla de compra' AS tipo_doc, A.co_art AS Num_Doc, DCOR.reng_num AS reng_num, FCR.reng_num AS reng_numFact
       FROM
                    saDistribCosto DC
            INNER JOIN saDistribCostoRelaReng DCRR ON DC.distrib_num = DCRR.distrib_num_destino
                    INNER JOIN saDistribCostoDestinoReng DCDR ON DCDR.distrib_num = DCRR.distrib_num_destino AND DCDR.reng_num = DCRR.reng_num_destino
                    INNER JOIN saFacturaCompraReng FCR ON FCR.rowguid = DCDR.rowguid_comp
                    INNER JOIN saFacturaCompra FC ON FC.doc_num = FCR.doc_num
                    INNER JOIN saUnidad UNI ON UNI.co_uni = FCR.co_uni
                    INNER JOIN saProveedor
```
