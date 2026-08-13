# SP: pValidaRenglonRequisicion
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidaRenglonRequisicion]
    (
      @gRowguid_Plantilla_Compra UNIQUEIDENTIFIER,
	  @iRenglon int
    )
AS 
    BEGIN
		DECLARE @bExiste BIT
		SET @bExiste = 0
        IF exists( --Reviso que la requisición tenga estatus 0 --> No procesado
			SELECT PCR.estatus
			FROM saPlantillaCompraReq PCR 
			inner join saPlantillaCompra PC ON PC.rowguid = PCR.rowguid_plantilla_compra
			WHERE 
				PCR.rowguid_plantilla_compra = @gRowguid_Plantilla_Compra AND
				PCR.estatus = '0'
		)
		BEGIN SET @bExiste = 1 END
		
		 IF exists( --Reviso que el renglón no tenga documentos importados asociados
			SELECT PCR.estatus
			FROM saPlantillaCompraReq PCR 
			inner join saPlantillaCompra PC ON PC.rowguid = PCR.rowguid_plantilla_compra
			inner join saPlantillaCompraReng PCRENG ON PC.doc_num = PCRENG.doc_num
			inner join saPlantillaCompraReqRenglon PCRRENG ON PCRRENG.rowguid_plantilla_renglon = PCRENG.rowguid
			inner join saPlantillaCompraReqRelacion REL ON REL.rowguid_reng_req = PCRRENG.rowguid
			WHERE 
				PCR.rowguid_plantilla_compra = @gRowguid_Plantilla_Compra AND
				PCRENG.reng_num = @iRenglon
		)
		BEGIN SET @bExiste = 1 END

		SELECT @bExiste

    END
```
