# SP: pSumarCostoDeDistribuciones
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)

## Código (excerpt)
```sql
/*******************************************************************************************************
*NOMBRE			: pSumarCostoDeDistribuciones
*DESCRIPCIÓN	: Suma al costo del renglón de factura de compra, los montos calculados en las distribuciones
				  asociadas.
*AUTOR			: Softech Sistemas
*******************************************************************************************************/
CREATE PROCEDURE [dbo].[pSumarCostoDeDistribuciones]
	@RowGuid_Doc_Orig UNIQUEIDENTIFIER
AS
	BEGIN
		SET NOCOUNT ON;

		DECLARE @Monto DECIMAL(18,5)

		SET @Monto =
		(
			SELECT 
				SUM(DCRR.monto)
			FROM
				saDistribCostoRelaReng AS DCRR
				INNER JOIN saDistribCosto AS DC ON DC.distrib_num = DCRR.distrib_num_destino
				INNER JOIN saDistribCostoDestinoReng AS DCDR ON DCDR.distrib_num = DCRR.distrib_num_destino
				AND DCDR.reng_num = DCRR.reng_num_destino
			WHERE
				DCDR.rowguid_comp = @RowGuid_Doc_Orig AND
				DC.Procesado = '1'
		)

		IF (@Monto IS NOT NULL)
			BEGIN
				UPDATE
					saCostoHistoricoEntrada
				SET
					costo = costo + @Monto
				WHERE
					doc_orig = @RowGuid_Doc_Orig AND tipo_doc = 'COMP'
			END

	END
```
