# SP: pSeleccionarRenglonesDistribCostoRela
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		:	pSeleccionarRenglonesDistribCostoRela
DESCRIPCION	:	Procedimiento para seleccionar todas las relaciones destino/origen asociadas a una distribución
CREADO POR	:	SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesDistribCostoRela]
    (
      @sDistrib_Num CHAR(20)
    )
AS 
    BEGIN
        SELECT
            DCRR.distrib_num_destino AS Distrib_Num, FCR.reng_num AS Reng_Num_Destino_fact,
			FCR.doc_num AS Num_Fact, FCR.co_art AS Co_Art_Destino, A.art_des AS Des_Art_Destino,
			DCRR.reng_num_origen AS Reng_Num_Origen_fact, 'PCOM'AS Tipo_Doc, PCR.doc_num AS Num_Doc,
			PCR.co_art AS Co_Art_Origen, A2.art_des AS Des_Art_Origen, DCRR.tipo_distrib AS Tipo_Distrib,
			DCRR.monto AS Monto, DCRR.reng_num_destino, DCRR.reng_num_origen, DCRR.rowguid 
        FROM
            saDistribCostoRelaReng DCRR
			INNER JOIN saDistribCostoDestinoReng DCDR ON DCDR.distrib_num = DCRR.distrib_num_destino AND
			DCDR.reng_num = DCRR.reng_num_destino
			INNER JOIN saFacturaCompraReng FCR ON FCR.rowguid = DCDR.rowguid_comp
			INNER JOIN saArticulo A ON A.co_art = FCR.co_art
			INNER JOIN saDistribCostoOrigenReng DCOR ON DCOR.distrib_num = DCRR.distrib_num_origen AND
			DCOR.reng_num = DCRR.reng_num_origen
			INNER JOIN saPlantillaCompraReng PCR ON PCR.rowguid = DCOR.rowguid_pcom
			INNER JOIN saArticulo A2 ON A2.co_art = PCR.co_art
        WHERE
            DCRR.distrib_num_destino = @sDistrib_Num AND
			DCOR.rowguid_comp IS NULL
		UNION
		SELECT
            DCRR.distrib_num_destino AS Distrib_Num, FCR.reng_num AS Reng_Num_Destino_fact,
			FCR.doc_num AS Num_Fact, FCR.co_art AS Co_Art_Destino, A.art_des AS Des_Art_Destino,
			FCR2.reng_num AS Reng_Num_Origen_fact, 'COMP' AS Tipo_Doc, FCR2.doc_num AS Num_Doc,
			FCR2.co_art AS Co_Art_Origen, A2.art_des AS Des_Art_Origen, DCRR.tipo_distrib AS Tipo_Distrib,
			DCRR.monto AS Monto, DCRR.reng_num_destino, DCRR.reng_num_origen, DCRR.rowguid
        FROM
            saDistribCostoRelaReng DCRR
			INNER JOIN saDistribCostoDestinoReng DCDR ON DCDR.distrib_num = DCRR.distrib_num_destino AND
			DCDR.reng_num = DCRR.reng_num_destino
			INNER JOIN saFacturaCompraReng FCR ON FCR.rowguid = DCDR.rowguid_comp
			INNER JOIN saArticulo A ON A.co_art = FCR.co_art
```
