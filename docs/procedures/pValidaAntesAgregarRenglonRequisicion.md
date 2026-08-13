# SP: pValidaAntesAgregarRenglonRequisicion
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidaAntesAgregarRenglonRequisicion]
    (
      @gRowguid_Plantilla_Compra UNIQUEIDENTIFIER
    )
AS 
    BEGIN
		DECLARE @bExiste BIT
		SET @bExiste = 0
        IF exists(
			SELECT PCR.estatus
			FROM saPlantillaCompraReq PCR 
			inner join saPlantillaCompra PC ON PC.rowguid = PCR.rowguid_plantilla_compra
			WHERE 
				PCR.rowguid_plantilla_compra = @gRowguid_Plantilla_Compra AND
				PCR.estatus <> '0'
		)
		BEGIN SET @bExiste = 1 END

		SELECT @bExiste

    END
```
