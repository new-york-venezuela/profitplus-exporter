# SP: pObtenerDistribucionCostoRengCosto
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH CONSULTORES
-- Create date: <17-12-2014>
-- Description:	<Distribución de Costos por Renglon de Compra>
-- =============================================
CREATE PROCEDURE [dbo].[pObtenerDistribucionCostoRengCosto] @gRowguidComp UNIQUEIDENTIFIER
AS
BEGIN
	SET NOCOUNT ON;
	select DCDR.distrib_num as Distrib_Num, 
	(CASE WHEN COALESCE(UAP.uni_principal, UAF.uni_principal) = 1 THEN  DCRR.monto 
	ELSE DCRR.monto / ROUND((dbo.ArtUnidadBase(COALESCE(ARTP.co_art,ARTF.co_art), COALESCE(UAP.co_uni, UAF.co_uni), 1) ), 5) END )
	 as Monto, DCR.reng_num as Reng_Num, isnull(RengDestP.co_art, RengDest.co_art) as Co_Art, isnull(ARTP.art_des, ARTF.art_des) as Des_Art,
	CASE WHEN RengDestP.co_art IS NULL THEN 'Factura' ELSE 'Plantilla' END as Tipo_Doc,  isnull(RengDestP.doc_num, RengDest.doc_num) as Doc_Num
	from
		saDistribCosto DC
		INNER JOIN saDistribCostoRelaReng DCRR on DC.distrib_num = DCRR.distrib_num_destino
		INNER JOIN saDistribCostoDestinoReng DCDR on DCRR.distrib_num_destino = DCDR.distrib_num AND DCDR.reng_num = DCRR.reng_num_destino
		INNER JOIN saDistribCostoOrigenReng DCR on DCRR.distrib_num_destino = DCR.distrib_num AND DCR.reng_num = DCRR.reng_num_origen
		LEFT JOIN saPlantillaCompraReng RengDestP on DCR.rowguid_pcom = RengDestP.rowguid
		LEFT JOIN saFacturaCompraReng RengDest on DCR.rowguid_comp = RengDest.rowguid
		
		LEFT JOIN saArticulo ARTP ON ARTP.co_art = RengDestP.co_art
		LEFT JOIN saARTUnidad UAP ON UAP.co_art = ARTP.co_art and UAP.co_uni = RengDestP.co_uni 
		
		LEFT JOIN saArticulo ARTF ON ARTF.co_art = RengDest.co_art
		LEFT JOIN saARTUnidad UAF ON UAF.co_art = ARTF.co_art and UAF.co_uni = RengDest.co_uni
	
	WHERE DC.procesado = 1 AND DCDR.rowguid_comp = @gRowguidComp

	
	Select FCR.reng_num,FCR.doc_num,FCR.co_art,FCR.des_art,FCR.co_uni,FCR.sco_uni,FCR.co_alma,FCR.tipo_imp,FCR.tipo_imp2,
	  FCR.tipo_imp3,FCR.tipo_doc,FCR.porc_desc,FCR.num_doc,FCR.rowguid_doc,FCR.reng_neto,

	  (CASE WHEN UA.uni_principal = 1 THEN FCR.cost_unit ELSE FCR.cost_unit / ROUND((dbo.ArtUnidadBase(FCR.co_art,FCR.co_uni, 1) ), 5) END )	  
	  as cost_unit,	  
	  
	  FCR.cost_unit_om,

	   (CASE WHEN UA.uni_principal = 1 THEN FCR.total_art ELSE UA.equivalencia * FCR.total_art END) as total_art,	  
	  FCR.stotal_art,FCR.otros,FCR.porc_imp,FCR.porc_imp2,FCR.porc_imp3,FCR.monto_imp,FCR.monto_imp2,FCR.monto_imp3,
	  FCR.porc_gas,FCR.total_dev,FCR.monto_dev,FCR.lote_as
```
