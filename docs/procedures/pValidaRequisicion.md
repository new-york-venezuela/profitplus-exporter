# SP: pValidaRequisicion
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidaRequisicion]
    (
      @gRowguid_Plantilla_Compra UNIQUEIDENTIFIER
    )
AS 
    BEGIN

		SELECT PCR.estatus 
		FROM saPlantillaCompraReq PCR 
		inner join saPlantillaCompra PC ON PC.rowguid = PCR.rowguid_plantilla_compra
		WHERE 
			PCR.rowguid_plantilla_compra = @gRowguid_Plantilla_Compra

    END
```
