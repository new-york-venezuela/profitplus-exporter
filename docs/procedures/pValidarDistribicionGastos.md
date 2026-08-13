# SP: pValidarDistribicionGastos
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saIncoterm`](../tables/saIncoterm.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <28-11-2016>
-- Description:	<pValidarDistribicionGastos>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarDistribicionGastos]
	(
		@bCorregir BIT = 0, --INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
		DECLARE @valPendienteResult TABLE ( Motivo VARCHAR(256))		
		DECLARE @Motivo VARCHAR(256)		
		DECLARE @Valor INT
		DECLARE @PistaMensaje VARCHAR(MAX)
		DECLARE @HoraCorrida DATETIME
		
		DECLARE @NroDecimalesCosto INT
			SELECT
                    @NroDecimalesCosto = i_dec_costo
             FROM 
                    par_emp

		DECLARE  @tabla2 TABLE (distrib_num char(20), nacional BIT)

		INSERT INTO @tabla2
			SELECT 
				DCDR.distrib_num, PROV.nacional				 
			FROM
				saDistribCostoDestinoReng DCDR
				INNER JOIN saFacturaCompraReng FCR ON DCDR.rowguid_comp = FCR.rowguid
				INNER JOIN saFacturaCompra FC ON FC.doc_num = FCR.doc_num
				INNER JOIN saProveedor PROV ON PROV.co_prov = FC.co_prov
			GROUP BY
				DCDR.distrib_num, PROV.nacional

		SET @HoraCorrida = GETDATE()		

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
		FOR			
			
		--Valida que el artículo no sea de tipo servicio en la sección Artículo
			SELECT  DISTINCT				 
				 'La distribución de gasto nro "' + RTRIM(DCDR.distrib_num) + 
				 '" posee el artículo "' + RTRIM(ART.co_art) + '" de tipo servicio en la sección Artículo. *NC.' as motivo
			FROM
				saDistribCostoDestinoReng DCDR
				INNER JOIN saFacturaCompraReng FCR ON DCDR.rowguid_comp = FCR.rowguid
				INNER JOIN saArticulo ART ON FCR.co_art = ART.co_art
			WHERE
				ART.co_art IS NOT NULL AND
				ART.tipo='S'

		UNION
		
		--Valida que el orden de los Incoterm de artículo mayor a los Incoterm de gastos
			SELECT  DISTINCT
				 'La distribución de gasto nro "' + RTRIM(DCDR.distrib_num) + 
				 '" posee el orden de los Incoterm de artículo mayor a los Incoterm de gastos. *NC.' as motivo
			FROM
				saDistribCostoDestinoReng DCDR
				INNER JOIN saDistribCostoRelaReng DCRR ON DCRR.distrib_num_destino = DCDR.distrib_num AND DCRR.reng_num_destino = DCDR.reng_num
				INNER JOIN saDistribCostoOrigenReng DCOR ON DCOR.distrib_num = DCRR.distrib_num_origen AND DCOR.reng_num = DCRR.reng_num_origen				
				INNER JOIN saFacturaCompraReng FCR ON FCR.rowguid = DCDR.rowguid_comp
				INNER JOIN saFacturaCompr
```
