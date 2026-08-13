# SP: pObtenerMontoGastoReng
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pObtenerMontoGastoReng
*DESCRIPCIÓN	: Devuelve el monto total asociado a un renglón de Gasto, que corresponde con el neto
				  del renglón importado de la factura o plantilla de compra.
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerMontoGastoReng]
	(
		@gRowGuid_Doc_Origen UNIQUEIDENTIFIER,
		@sTipo_Doc CHAR(4)
		
    )
AS
	BEGIN
		SET NOCOUNT ON;

		IF ( @sTipo_doc = 'COMP' ) --FACTURA DE COMPRA
			BEGIN
				SELECT
					reng_neto
				FROM
					saFacturaCompraReng
				WHERE
					rowguid = @gRowGuid_Doc_Origen
			END
		ELSE IF ( @sTipo_doc = 'PCOM' ) --PLANTILLA DE COMPRA
			BEGIN
				SELECT
					reng_neto
				FROM
					saPlantillaCompraReng
				WHERE
					rowguid = @gRowGuid_Doc_Origen
			END
	END
```
