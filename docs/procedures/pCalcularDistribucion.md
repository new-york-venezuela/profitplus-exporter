# SP: pCalcularDistribucion
**Tipo**: Procedimiento
**Módulo**: Compras

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pCalcularDistribucion
*DESCRIPCIÓN	: Divide los gastos de una distribución entre todos los artículos de la misma, en base a un criterio
				  en específico (costo, volumen o peso).
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pCalcularDistribucion]
	@sDistrib_Num CHAR(20) ,
	@sTipo_Distrib CHAR(1)
AS
	BEGIN
		SET NOCOUNT ON;

		DECLARE @Sumatoria_Neto DECIMAL(18,5)

		DECLARE @tablaGenerica TABLE
		(
			Rowguid_Art UNIQUEIDENTIFIER ,
			Co_Art CHAR(30) ,
			Co_Uni CHAR(6) ,
			Rowguid_Gas UNIQUEIDENTIFIER ,
			Monto DECIMAL(18, 5) ,
			Monto_Total_Gas DECIMAL(18, 5) ,
			Total_Art DECIMAL(18, 5)
		)

		IF ( @sTipo_Distrib = 'C' ) --COSTO
			BEGIN
				SELECT 
					@Sumatoria_Neto = SUM(FCR.reng_neto)
				FROM
					saDistribCostoDestinoReng AS DCDR
					INNER JOIN saFacturaCompraReng AS FCR ON FCR.rowguid = DCDR.rowguid_comp
				WHERE
					DCDR.distrib_num = @sDistrib_Num

				INSERT INTO @tablaGenerica
					( Rowguid_Art, Co_Art, Co_Uni, Rowguid_Gas, Monto, Monto_Total_Gas, Total_Art )
				SELECT 
					DCDR.rowguid, FCR.co_art, FCR.co_uni, DCOR.rowguid,
					((FCR.reng_neto/@Sumatoria_Neto)*DCOR.monto_ap)/FCR.total_art, DCOR.monto_ap, FCR.total_art
				FROM 
					saDistribCostoOrigenReng AS DCOR
					INNER JOIN saDistribCostoDestinoReng AS DCDR ON DCDR.distrib_num = DCOR.distrib_num
					INNER JOIN saFacturaCompraReng AS FCR ON FCR.rowguid = DCDR.rowguid_comp
				WHERE
					DCOR.distrib_num = @sDistrib_Num
			END
		ELSE IF ( @sTipo_Distrib = 'V' ) --VOLUMEN
			BEGIN
				SELECT 
					@Sumatoria_Neto = SUM(dbo.CalcularVolumenFactCompReng(DCDR.rowguid_comp)*FCR.total_art)
				FROM
					saDistribCostoDestinoReng AS DCDR
					INNER JOIN saFacturaCompraReng AS FCR ON FCR.rowguid = DCDR.rowguid_comp
				WHERE
					DCDR.distrib_num = @sDistrib_Num

				INSERT INTO @tablaGenerica
					( Rowguid_Art, Co_Art, Co_Uni, Rowguid_Gas, Monto, Monto_Total_Gas, Total_Art )
				SELECT 
					DCDR.rowguid, FCR.co_art, FCR.co_uni, DCOR.rowguid,
					((dbo.CalcularVolumenFactCompReng(DCDR.rowguid_comp)/@Sumatoria_Neto)*DCOR.monto_ap), DCOR.monto_ap, FCR.total_art
				FROM 
					saDistribCostoOrigenReng AS DCOR
					INNER JOIN saDistribCostoDestinoReng AS DCDR ON DCDR.distrib_num = DCOR.distrib_num
					INNER JOIN saFacturaCompraReng AS FCR ON FCR.rowgui
```
