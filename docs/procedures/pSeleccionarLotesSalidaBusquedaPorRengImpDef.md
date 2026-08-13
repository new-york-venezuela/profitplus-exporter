# SP: pSeleccionarLotesSalidaBusquedaPorRengImpDef
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saLoteEntrada`](../tables/saLoteEntrada.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pSeleccionarLotesSalidaBusquedaPorRengImpDef
*DESCRIPCIÓN	: Selecciona los lotes de salida asociados a un renglón importado de un proceso de venta
				  y devuelve tuplas conformadas por el nro de lote del lote de salida, las fechas de inicio
				  y vencimiento del lote de entrada asociado, el precio del lote de salida y la cantidad 
				  que debe ser tomada del mismo.
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarLotesSalidaBusquedaPorRengImpDef]
	(
		@gRowguid_Reng_Imp UNIQUEIDENTIFIER ,
		@sCo_Art CHAR(30) ,
		@dTotal_Art DECIMAL(18, 5) ,
		@sCo_Uni CHAR(6)
    )
AS
	BEGIN
		SET NOCOUNT ON;

		DECLARE @TipoCosto CHAR(1)
 
		SELECT 
			@TipoCosto = i_costo_inventario 
		FROM 
			par_emp

		-- COSTO PROMEDIO CALCULA PEPS (TIPO COSTO '2')
		IF @TipoCosto <> '2' AND @TipoCosto <> '3'
			SET @TipoCosto = '2'

		SET @dTotal_Art = dbo.ArtUnidadBase(@sCo_Art, @sCo_Uni, @dTotal_Art)

		DECLARE @NuevoLotesSalidaSinFechaInicio TABLE
			(
				Nombre_Lote CHAR(20) ,
				Nro_Lote INT ,
				Fecha_Expiracion SMALLDATETIME ,
				Cantidad DECIMAL(18, 5)
			)

		DECLARE @NuevoLotesSalida TABLE
		(
			Nombre_Lote CHAR(20) ,
			Nro_Lote INT ,
			Fecha_Inicio SMALLDATETIME ,
			Fecha_Expiracion SMALLDATETIME ,
			Cantidad DECIMAL(18, 5)
		)

		INSERT INTO @NuevoLotesSalidaSinFechaInicio
			( Nombre_Lote, Nro_Lote, Fecha_Expiracion, Cantidad )
		SELECT
			LS.numero_lote AS Nombre_Lote, MIN(LS.reng_num) AS Nro_lote,
			MIN(LE.fecha_expiracion) AS Fecha_Expiracion, SUM(LS.cantidad) AS Cantidad
		FROM
			saLoteSalida AS LS
			INNER JOIN saLoteEntrada AS LE on LE.rowguid = LS.Rowguid_Lote
		WHERE
			LS.rowguid_reng = @gRowguid_Reng_Imp
		GROUP BY LS.numero_lote

		INSERT INTO @NuevoLotesSalida
			( Nombre_Lote, Nro_Lote, Fecha_Inicio, Fecha_Expiracion, Cantidad )
		SELECT
			LSSF.Nombre_Lote AS Nombre_Lote, LSSF.Nro_Lote AS Nro_lote, MIN(LE.fecha_inicio) AS Fecha_Inicio,
			LSSF.Fecha_Expiracion AS Fecha_Expiracion, LSSF.Cantidad AS Cantidad
		FROM
			saLoteSalida AS LS
			INNER JOIN saLoteEntrada AS LE on LE.rowguid = LS.Rowguid_Lote
			INNER JOIN @NuevoLotesSalidaSinFechaInicio AS LSSF ON LSSF.Nombre_Lote = LS.numero_lote
			AND LSSF.Fecha_Expiracion = LE.fecha_expiracion
		WHERE
			LS.rowguid_reng = @gRowguid_Reng_Imp
		GROUP BY
```
