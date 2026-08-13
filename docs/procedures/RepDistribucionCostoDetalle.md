# SP: RepDistribucionCostoDetalle
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
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
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-05-2015>
-- Description:	<Distribución Costo Detalle>
-- =============================================
CREATE PROCEDURE [dbo].[RepDistribucionCostoDetalle]
	@sNumero_d CHAR(20) = NULL,
	@sNumero_h CHAR(20) = NULL,
	@dFecha_d SMALLDATETIME = NULL,
    @dFecha_h SMALLDATETIME = NULL,
	@bProcesado CHAR(4) = NULL,
	@sco_art_d CHAR(30) = NULL,
	@sco_art_h CHAR(30) = NULL,
	@sco_gas_d CHAR(30) = NULL,
	@sco_gas_h CHAR(30) = NULL,
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
            DCRR.distrib_num_destino AS Distrib_Num, FCR.reng_num AS Reng_Num_Destino_fact,
			FCR.doc_num AS Num_Fact, FCR.co_art AS Co_Art_Destino, A.art_des AS Des_Art_Destino,
			DCRR.reng_num_origen AS Reng_Num_Origen_fact, 'PCOM'AS Tipo_Doc, PCR.doc_num AS Num_Doc,
			PCR.co_art AS Co_Art_Origen, A2.art_des AS Des_Art_Origen, DCRR.tipo_distrib AS Tipo_Distrib,
			DCRR.monto AS Monto, DCRR.reng_num_destino, DCRR.reng_num_origen, DCRR.rowguid, ISNULL(DCRR.monto,0) as costo_xunidadDest,
			DC.fecha, DC.anulado, DC.descrip, DC.procesado
        FROM
			saDistribCosto DC
            INNER JOIN saDistribCostoRelaReng DCRR ON DC.distrib_num = DCRR.distrib_num_destino
			INNER JOIN saDistribCostoDestinoReng DCDR ON DCDR.distrib_num = DCRR.distrib_num_destino AND
			DCDR.reng_num = DCRR.reng_num_destino
			INNER JOIN saFacturaCompraReng FCR ON FCR.rowguid = DCDR.rowguid_comp
			INNER JOIN saArticulo A ON A.co_art = FCR.co_art
			INNER JOIN saDistribCostoOrigenReng DCOR ON DCOR.distrib_num = DCRR.distrib_num_origen AND
			DCOR.reng_num = DCRR.reng_num_origen
			INNER JOIN saPlantillaCompraReng PCR ON PCR.rowguid = DCOR.rowguid_pcom
			INNER JOIN saArticulo A2 ON A2.co_art = PCR.co_art
	WHERE
		((@sNumero_d IS NULL OR DC.distrib_num >= @sNumero_d) AND ( @sNumero_h IS NULL OR DC.distrib_num <= @sNumero_h))
		AND ((@dFecha_d IS NULL OR dbo.FechaSimple(DC.fecha) >= @dFecha_d)	AND	(@dFecha_h IS NULL OR dbo.FechaSimple(DC.fecha) <= @dFecha_h))	
		AND (@bProcesado IS NULL OR @bProcesado = DC.procesado)		
		AND (@sSucursal IS NULL OR @sSucursal = DCDR.co_sucu_in)
```
