# SP: pValidarPorcentajeGananciaLoteSalida
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pValidarPorcentajeGananciaLoteSalida
*DESCRIPCIÓN	: Verifica si el precio de un artículo cumple con el porcentaje máximo de ganancia 
				  establecido, tomando como costo el del lote de entrada al que pertenece. 			
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pValidarPorcentajeGananciaLoteSalida]
	(
		@gRowGuid_Lote_Entrada UNIQUEIDENTIFIER ,
		@dPrecio DECIMAL(18, 5) ,
		@dPorcentaje_Maximo_Ganancia DECIMAL(18, 5) ,
		@bMargen_Ganancia_Costo_A_Precio CHAR(1)
    )
AS
	BEGIN
		SET NOCOUNT ON;

		DECLARE @Doc_Entrada TABLE
			(
				RowGuid UNIQUEIDENTIFIER ,
				Tipo CHAR(4)
			)

		DECLARE @RowGuid_Doc UNIQUEIDENTIFIER
		DECLARE @Tipo_Doc CHAR(4)
		
		INSERT INTO @Doc_Entrada
				( RowGuid, Tipo )
        SELECT
            rowguid_reng AS RowGuid, tipo_doc AS Tipo
        FROM
            saLoteEntrada
        WHERE
            rowguid = @gRowGuid_Lote_Entrada
            

		SET @RowGuid_Doc = (SELECT RowGuid FROM @Doc_Entrada)
		SET @Tipo_Doc = (SELECT Tipo FROM @Doc_Entrada)

		EXEC [dbo].[pValidarPorcentajeGananciaLoteEntrada] @gRowGuid_Doc = @RowGuid_Doc, @sTipo_doc = @Tipo_Doc,
		@dPrecio = @dPrecio, @dPorcentaje_Maximo_Ganancia = @dPorcentaje_Maximo_Ganancia,
		@bMargen_Ganancia_Costo_A_Precio = @bMargen_Ganancia_Costo_A_Precio
	END
```
