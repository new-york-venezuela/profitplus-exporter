# SP: pProcesarDesprocesarDistribucion
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)

## Código (excerpt)
```sql
/*******************************************************************************************************
*NOMBRE			: pProcesarDesprocesarDistribucion
*DESCRIPCIÓN	: Modifica el costo de los renglones de facturas de compra asociados a la
				  distribución, en función de los montos calculados.
*AUTOR			: Softech Sistemas
*******************************************************************************************************/
CREATE PROCEDURE [dbo].[pProcesarDesprocesarDistribucion]
	@sDistrib_Num CHAR(20),
	@sProcesar CHAR(1)
AS
	BEGIN
		SET NOCOUNT ON;

		DECLARE @tablaGenerica TABLE
		(
			Rowguid_Art UNIQUEIDENTIFIER ,
			Monto DECIMAL(18, 5)
		)

		INSERT INTO @tablaGenerica
					( Rowguid_Art, Monto )
				SELECT 
					DCDR.rowguid_comp, SUM(DCRR.monto)
				FROM 
					saDistribCostoRelaReng AS DCRR
					INNER JOIN saDistribCostoDestinoReng AS DCDR ON DCDR.distrib_num = DCRR.distrib_num_destino
					AND DCDR.reng_num = DCRR.reng_num_destino
				WHERE
					DCRR.distrib_num_destino = @sDistrib_Num
				GROUP BY
					DCDR.rowguid_comp

		DECLARE Destino_Cursor CURSOR FORWARD_ONLY FOR
            SELECT
                Rowguid_Art, Monto
            FROM
                @tablaGenerica

		DECLARE @Rowguid_Art_Actual UNIQUEIDENTIFIER
		DECLARE @Monto_Actual DECIMAL(18,5)

		OPEN Destino_Cursor
        FETCH NEXT FROM Destino_Cursor INTO @Rowguid_Art_Actual, @Monto_Actual

        WHILE @@FETCH_STATUS = 0
            BEGIN
				UPDATE
					saCostoHistoricoEntrada
				SET
					costo =
					CASE
						WHEN @sProcesar = '1' THEN costo + @Monto_Actual
						ELSE costo - @Monto_Actual
					END
				WHERE
					doc_orig = @Rowguid_Art_Actual AND tipo_doc = 'COMP'

				FETCH NEXT FROM Destino_Cursor INTO @Rowguid_Art_Actual, @Monto_Actual
            END

        CLOSE Destino_Cursor
        DEALLOCATE Destino_Cursor
	END
```
