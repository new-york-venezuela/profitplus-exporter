# SP: pValidarRenglonModificadoConRequisicion
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarRenglonModificadoConRequisicion]
    (
      @gRowguid_Renglon UNIQUEIDENTIFIER
    )
AS 
    BEGIN
		SELECT saPlantillaCompraReng.* 
		FROM saPlantillaCompraReng 
		INNER JOIN saPlantillaCompraReqRenglon ON saPlantillaCompraReqRenglon.rowguid_plantilla_renglon = saPlantillaCompraReng.rowguid
		WHERE
		saPlantillaCompraReng.rowguid = @gRowguid_Renglon
		AND saPlantillaCompraReqRenglon.estatus = '2'

    END
```
