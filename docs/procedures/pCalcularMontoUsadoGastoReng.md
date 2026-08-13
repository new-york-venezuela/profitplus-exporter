# SP: pCalcularMontoUsadoGastoReng
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pCalcularMontoUsadoGastoReng
*DESCRIPCIÓN	: Devuelve el monto que falta por distribuir asociado a un renglón de Gasto.
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pCalcularMontoUsadoGastoReng]
	(
		@gRowGuid_Doc_Origen UNIQUEIDENTIFIER
    )
AS
	BEGIN
		SET NOCOUNT ON;

		SELECT
			ISNULL(SUM(monto_ap),0)
		FROM
			saDistribCostoOrigenReng
		WHERE
			rowguid_comp = @gRowGuid_Doc_Origen OR rowguid_pcom = @gRowGuid_Doc_Origen
	END
```
