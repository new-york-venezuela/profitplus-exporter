# SP: RepDistribucionCostoxFecha
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saIncoterm`](../tables/saIncoterm.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <29-04-2015>
-- Description:	<Distribución por Fecha>
-- =============================================
CREATE PROCEDURE [dbo].[RepDistribucionCostoxFecha]
	@sNumero_d CHAR(20) = NULL,
	@sNumero_h CHAR(20) = NULL,
	@dFecha_d SMALLDATETIME = NULL,
    @dFecha_h SMALLDATETIME = NULL,
	@bProcesado CHAR(4) = NULL,
	@sSucursal CHAR(6) = NULL,
	@sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0

AS
BEGIN
	SET NOCOUNT ON;
	
	IF (@bProcesado IS NULL OR @bProcesado = 'TODO')
		SET @bProcesado = NULL
	ELSE IF (@bProcesado = 'SIT')
		SET @bProcesado = 1
	ELSE IF (@bProcesado = 'NOT')
		SET @bProcesado = 0
	
	SELECT
		DC.distrib_num, DC.descrip as distrib_des, DC.fecha, DC.procesado, ART.co_art as co_artDest, ART.art_des as art_desDest, 
		INC.co_incoterm as co_incotermDest, INC.incoterm_des as incotermDest, FCR.total_art as total_artDest,
		FCR.co_uni as co_uniDest, FCR.reng_neto as reng_netoDest, 
		(dbo.CalcularVolumenFactCompReng(FCR.rowguid) * FCR.total_art) as volumenDest,	
		(dbo.CalcularPesoFactCompReng(FCR.rowguid) * FCR.total_art) as pesoDest, 
		SUM(dbo.ArtUnidadBase(ART.co_art,FCR.co_uni,1) * ISNULL(DCR.monto,0)) as costo_distDest, SUM(ISNULL(DCR.monto,0)) as costo_xunidadDest, FC.doc_num as doc_numDest, 		
		NULL as co_artOri, NULL as art_desOri, NULL as co_incotermOri, NULL as incotermOri,
		NULL as reng_neto_Ori, NULL as monto_apOri, NULL as rowguid_comp, NULL as tipo_docOri, NULL as doc_num, DCD.reng_num, DC.anulado as anulado

	FROM
		saDistribCosto DC
		---Distribución Artículos
		INNER JOIN saDistribCostoDestinoReng DCD ON DC.distrib_num = DCD.distrib_num
		INNER JOIN saFacturaCompraReng FCR ON DCD.rowguid_comp = FCR.rowguid
		INNER JOIN saArticulo ART ON FCR.co_art = ART.co_art
		INNER JOIN saIncoterm INC ON DCD.co_incoterm = INC.co_incoterm		
		INNER JOIN saFacturaCompra FC ON FCR.doc_num = FC.doc_num
		LEFT JOIN saDistribCostoRelaReng DCR ON DC.distrib_num = DCR.distrib_num_destino AND DCR.reng_num_destino = DCD.reng_num

		---Distribución Gastos
		LEFT JOIN saDistribCostoOrigenReng DCO ON DC.distrib_num <> DC.distrib_num
		LEFT JOIN saFacturaCompraReng FCRO ON DCO.rowguid_comp = FCRO.rowguid
		LEFT JOIN saPlantillaCompraReng PCO ON  DCO.rowguid_pcom = PCO.rowguid
		LEFT JOIN saArticulo ARTFO ON FCRO.co_art = ARTFO.co_art		
		LEFT JOIN saArticulo ARTPO ON PCO.co_art
```
