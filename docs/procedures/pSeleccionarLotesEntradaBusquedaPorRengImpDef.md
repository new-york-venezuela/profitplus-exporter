# SP: pSeleccionarLotesEntradaBusquedaPorRengImpDef
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pSeleccionarLotesEntradaBusquedaPorRengImpDef
*DESCRIPCIÓN	: Selecciona los lotes de entrada asociados a un renglón importado de un proceso de compra
				  y devuelve tuplas conformadas por el nro de lote del lote de entrada, las fechas de inicio
				  y vencimiento del lote de entrada, y la cantidad que debe ser tomada del mismo.
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarLotesEntradaBusquedaPorRengImpDef]
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

        DECLARE @t TABLE
			(
				Id UNIQUEIDENTIFIER ,
				Nombre_Lote CHAR(20) ,
				Stock_Actual DECIMAL(18, 5) , 
				Cantidad_A_Tomar DECIMAL(18, 5)
			)
		
		DECLARE @LotesEntrada TABLE
			(
				Id UNIQUEIDENTIFIER ,
				Nombre_Lote CHAR(20) ,
				Stock_Actual DECIMAL(18, 5) ,
				Nro_Lote INT
			)

		INSERT INTO @LotesEntrada
				( Id,  Nombre_Lote, Stock_Actual, Nro_Lote )
            SELECT
                LE.rowguid AS Id, LE.numero_lote AS Nombre_Lote, LE.stock_actual AS Stock_Actual, LE.reng_num AS Nro_lote
            FROM
                saLoteEntrada AS LE
            WHERE
				LE.rowguid_reng = @gRowguid_Reng_Imp
				AND LE.stock_actual > 0

		DECLARE Lotes_Cursor CURSOR FORWARD_ONLY FOR
            SELECT
                Id,
				Nombre_Lote,
                Stock_Actual
            FROM
                @LotesEntrada
            ORDER BY --UEPS
				CASE @TipoCosto
					WHEN 3 THEN Nro_Lote
                END DESC,
				CASE @TipoCosto  --PEPS
					WHEN 2 THEN Nro_Lote 
                END ASC


		DECLARE @Calculado							DECIMAL(18, 5)	
        DECLARE @RowGuid_Actual						UNIQUEIDENTIFIER
        DECLARE @Total_Art_Actual					DECIMAL(18, 5)
		DECLARE @Nombre_Lote_Actual					CHAR(20)
        DECLARE @Total_Art_PorAsignar				DECIMAL(18, 5)

        SET @Total_Art_PorAsignar = @dTotal_Art

        OPEN Lotes_Cursor
        FETCH NEXT FROM Lotes_Cursor
```
