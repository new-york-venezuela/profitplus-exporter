# SP: pValidarPorcentajeGanancia
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pValidarPorcentajeGanancia
*DESCRIPCIÓN	: Verifica si el precio de salida de un artículo cumple con el porcentaje máximo de ganancia establecido.
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pValidarPorcentajeGanancia]
	(
		@gRowGuid_Renglon UNIQUEIDENTIFIER ,
		@sTipo_Doc CHAR(4) ,
		@dPrecio DECIMAL(18, 5) ,
		@dPorcentaje_Maximo_Ganancia DECIMAL(18, 5) ,
		@bMargen_Ganancia_Costo_A_Precio CHAR(1)
    )
AS
	BEGIN
		SET NOCOUNT ON;

		DECLARE @Costos TABLE
			(
				Monto DECIMAL(18, 5)
			)

		DECLARE @Monto DECIMAL(18, 5)
		DECLARE @bFaltanCostos CHAR(1)
		DECLARE @bPorcentajeGananciaSobrepasado CHAR(1)
		DECLARE @dPorcentajeGanancia DECIMAL(18, 5)

		SET @bFaltanCostos = 0
		SET @bPorcentajeGananciaSobrepasado = 0

		IF ( @sTipo_Doc = 'FACT' )
			BEGIN
				INSERT INTO @Costos
						( Monto )
                SELECT
                    ISNULL(CHE.costo, 0) AS Monto
                FROM
                    saFacturaVentaReng AS FVR
                    INNER JOIN saCostoHistoricoSalida AS CHS ON FVR.rowguid = CHS.doc_orig
                    LEFT JOIN saCostoHistoricoEntrada AS CHE ON CHS.cod_costo_historico_entrada = CHE.cod_costo_historico_entrada
                WHERE
                    FVR.rowguid = @gRowGuid_Renglon
            END

		DECLARE Cursor_Todos CURSOR LOCAL FAST_FORWARD 
 
		FOR 
 
		SELECT Monto
 
		FROM @Costos
 
		OPEN Cursor_Todos
 
		FETCH NEXT FROM Cursor_Todos INTO @Monto
 
		WHILE @@FETCH_STATUS = 0
			BEGIN
				IF ( @Monto = 0 )
					BEGIN
						SET @bFaltanCostos = 1
						BREAK;
					END
				ELSE
					BEGIN
						SET @dPorcentajeGanancia = dbo.CalcularPorcentajeGanancia(@dPrecio, @Monto, 
						@bMargen_Ganancia_Costo_A_Precio)

						IF ( @dPorcentajeGanancia >  @dPorcentaje_Maximo_Ganancia )
							BEGIN
								SET @bPorcentajeGananciaSobrepasado = 1
								BREAK;
							END
					END
				FETCH NEXT FROM Cursor_Todos INTO @Monto
			END

		CLOSE Cursor_Todos
		DEALLOCATE Cursor_Todos

		SELECT @bFaltanCostos AS "Faltan_Costos", @bPorcentajeGananciaSobrepasado AS "Porcentaje_Ganancia_Sobrepasado"
	END
```
