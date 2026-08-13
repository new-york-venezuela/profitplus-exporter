# SP: pSeleccionarRenglonesDistribCosto
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saArtImportacion`](../tables/saArtImportacion.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraImportacion`](../tables/saFacturaCompraImportacion.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pSeleccionarRenglonesDistribCosto
DESCRIPCION:	SELECCIONA LOS RENGLONES ASOCIADOS A UNA DISTRIBUCION DE COSTO DADA
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesDistribCosto] 
(
	@sDistrib_Num CHAR(20) 
)
AS 
    BEGIN
	
	--PRIMERA LISTA DE RENGLONES ASOCIADOS A LA DISTRIBUCION DE COSTO

        SELECT
            DCA.*, FCR.reng_neto - FCR.monto_desc_glob as reng_neto, (FCR.reng_neto - FCR.monto_desc_glob) / FCR.total_art as cost_uni, FCR.*, FC.*, ISNULL(ART.art_des, FCR.des_art) AS Art_Des, Coalesce(DCA.co_incoterm, AIMP.co_incoterm, FIMP.co_incoterm) AS Co_incoterm
        FROM
						saDistribCostoDestinoReng			AS		DCA
            INNER JOIN	saDistribCosto						AS		DC		ON	DC.Distrib_Num = DCA.Distrib_Num 
			--INNER JOIN	saDistribCostoRelaReng				AS		DCRela	ON	DCRela.reng_num_destino = DCA.reng_num AND DCRela.distrib_num_destino = DCA.distrib_num
			INNER JOIN	saFacturaCompraReng					AS		FCR		ON	FCR.rowguid = DCA.rowguid_comp
			INNER JOIN	saFacturaCompra						AS		FC		ON	FC.doc_num = FCR.doc_num
			INNER JOIN	saArticulo							AS		ART		ON	ART.co_art = FCR.co_art
			LEFT JOIN saArtImportacion                      AS      AIMP    ON  ART.co_art = AIMP.co_art
			LEFT JOIN saFacturaCompraImportacion            AS      FIMP    ON  FIMP.doc_num = FC.doc_num AND FIMP.co_tipo_doc = 'FACT'
        WHERE
			DCA.Distrib_Num = @sDistrib_Num
        ORDER BY
            DCA.reng_num
	
	--SEGUNDA LISTA DE RENGLONES ASOCIADOS  A LA DISTRIBUCION DE COSTO
	
     SELECT
            DCG.*, ISNULL(FC.doc_num, PC.doc_num) AS doc_num, ISNULL(FC.tasa, PC.tasa) AS tasa, ISNULL(FC.co_mone, PC.co_mone) AS co_mone,
			 (select top 1 (case when  tipo_distrib = 'C' then 'Costo' when  tipo_distrib = 'P' then 'Peso'  when  tipo_distrib = 'V' then 'Volumen' else 'Otro' end)  from saDistribCostoRelaReng where distrib_num_origen = DC.Distrib_Num AND reng_num_origen = DCG.reng_num  group by tipo_distrib) as Tipo_Dist,
			CASE WHEN FC.doc_num IS NULL THEN 'PCOM' ELSE 'COMP' END AS Tipo_Doc, ISNULL(FCR.co_art, PCR.co_art) AS Co_Art ,
			 ISNULL(FCR.des_art, ISNULL(PCR.des_art, ART.art_des)) AS Art_Des, 
			Coalesce(DCG.co_incoterm, AIMP.co_incoterm, FIMP.co_incoterm) AS Co_incoterm
        FROM
```
