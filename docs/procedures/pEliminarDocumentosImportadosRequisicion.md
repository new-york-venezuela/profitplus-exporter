# SP: pEliminarDocumentosImportadosRequisicion
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pEliminarDocumentosImportadosRequisicion]
    (
      @gRowguid_Plantilla_Compra UNIQUEIDENTIFIER
    )
AS 
    BEGIN
		
		DECLARE @Rowguid_Reng_Req UNIQUEIDENTIFIER
		DECLARE REQ_ANULAR CURSOR LOCAL FAST_FORWARD
        FOR
            (SELECT PCRREL.rowguid_reng_req
			FROM
				saPlantillaCompraReng PCRREN 
				INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
				INNER JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
				INNER JOIN saPlantillaCompraReq PCR ON doc_num = PCRREN.doc_num
			WHERE
				rowguid_plantilla_compra = @gRowguid_Plantilla_Compra 
			)
        OPEN REQ_ANULAR

        FETCH NEXT FROM REQ_ANULAR 
			INTO @Rowguid_Reng_Req

        WHILE @@FETCH_STATUS = 0 
            BEGIN
				DELETE FROM saPlantillaCompraReqRelacion 
				WHERE rowguid_reng_req = @Rowguid_Reng_Req
				FETCH NEXT FROM REQ_ANULAR 
				INTO @Rowguid_Reng_Req
			END 
        CLOSE REQ_ANULAR
        DEALLOCATE REQ_ANULAR

    END
```
