# SP: RepRotacionInventario
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <30-04-10>
-- Description:	<Reporte de Rotación de Inventario>
-- =============================================
CREATE PROCEDURE  [dbo].[RepRotacionInventario]
	-- Add the parameters for the stored procedure here
	@sCo_Art_d CHAR(30) = NULL,
	@sCo_Art_h CHAR(30) = NULL,
	@dFecha_d  smalldatetime = null,	
    @dFecha_h  smalldatetime = null,
	@sCo_Almacen_d char(6) = NULL,
	@sCo_Almacen_h char(6) = NULL,
	@sCo_Linea_d char(6) = NULL,
	@sCo_Linea_h char(6) = NULL,
	@sCo_Categoria_d char(6) = NULL,
	@sCo_Categoria_h char(6) = NULL,
	@sDetallar_Almacen CHAR(4) = NULL,
	@sCo_Sucursal char(6) = NULL,
	@sCampOrderBy varchar(16) = NULL,
	@sDir varchar(6) = NULL,
	@bHeaderRep bit = 0
AS
BEGIN
	SET NOCOUNT ON;

		IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = DATEADD(ss, -1, DATEADD(day, 1, @dFecha_h))
	
        SET @dFecha_d = dbo.fechasimple(@dFecha_d)
        SET @dFecha_h = dbo.fechasimple(@dFecha_h)


	DECLARE @MyTableVar TABLE(
    Co_Art CHAR(30),
	Co_Alma CHAR(6),
	Ventas DECIMAL(18, 2),
	Devoluciones DECIMAL(18, 2));
	
	DECLARE @TablaInv TABLE(
	Co_Art CHAR(30),
	Co_Alma CHAR(6),
	InvInicial DECIMAL(18, 2),
	InvFinal DECIMAL(18, 2)
	); 

	/************VALOR POR DEFECTO*************/
	IF @sDetallar_Almacen IS NULL
		SET @sDetallar_Almacen = 'SI  '
	/******************************************/


	/*************************INICIO VENTAS Y DEVOLUCIONES*************************/

	INSERT INTO @MyTableVar
	
	SELECT
	
		ISNULL(A.co_art, B.co_art),
		ISNULL(A.co_alma, B.co_alma), ISNULL(A.total, 0) AS Ventas, ISNULL(B.total,0) AS Devoluciones

	FROM

		(
			SELECT FVR.co_art, SUM(dbo.ArtUnidadBase(FVR.co_art, FVR.co_uni, FVR.total_art)) AS total, FVR.co_alma
			FROM saFacturaVentaReng FVR
			INNER JOIN saFacturaVenta FV ON FV.doc_num = FVR.doc_num
			WHERE
			( 
				(@sCo_Art_d IS NULL
				OR @sCo_Art_d <= FVR.co_art
				)
			AND 
				(@sCo_Art_h IS NULL
				OR FVR.co_art <= @sCo_Art_h
				)
			)
			AND
			(
				@dFecha_d IS NULL
				OR (dbo.FechaSimple(FV.fec_emis) >= @dFecha_d)
			)
			AND 
			( 
				@dFecha_h IS NULL
				OR (dbo.FechaSimple(FV.fec_emis) <= @dFecha_h )
			)
			AND
			(
				(@sCo_Almacen_d IS NULL
				OR @sCo_Almacen_d <= FVR.co_alma
				)
			AND
				(@sCo_Almacen_h IS NULL
				OR FVR.co_alma <= @sCo_Almacen_h
				)
			)
			AND
				FV.anulado = 0
```
