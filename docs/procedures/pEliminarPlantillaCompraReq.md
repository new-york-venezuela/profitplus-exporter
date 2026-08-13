# SP: pEliminarPlantillaCompraReq
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			:	pEliminarPlantillaCompraReq 
*DESCRIPCIÓN	:	Elimina una Requisición de compra segun su primary key
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS E.
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarPlantillaCompraReq]
    (
      @gRowguid_Plantilla_Compra UNIQUEIDENTIFIER ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @tsvalidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
		
		DECLARE @sDoc_NumOri CHAR(20) --Documento de origen, para la pista
		SET @sDoc_NumOri = (SELECT doc_num 
							FROM saPlantillaCompra PC inner join saPlantillaCompraReq PCR ON PC.rowguid = PCR.rowguid_plantilla_compra 
							WHERE PCR.rowguid_plantilla_compra = @gRowguid_Plantilla_Compra)

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
		--Elimino registros de saPlantillaCompraReqRelacion
		DECLARE @Rowguid_Rel_Req UNIQUEIDENTIFIER
		DECLARE REQ_RELACION CURSOR LOCAL FAST_FORWARD
        FOR
            (SELECT PCRREQREN.rowguid
			FROM
				saPlantillaCompraReng PCRREN 
				INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
				INNER JOIN saPlantillaCompraReqRelacion PCRREL ON PCRREL.rowguid_reng_req = PCRREQREN.rowguid
				INNER JOIN saPlantillaCompraReq PCR ON doc_num = PCRREN.doc_num
			WHERE
				rowguid_plantilla_compra = @gRowguid_Plantilla_Compra 
			)
        OPEN REQ_RELACION

        FETCH NEXT FROM REQ_RELACION 
			INTO @Rowguid_Rel_Req

        WHILE @@FETCH_STATUS = 0 
            BEGIN
				DELETE FROM saPlantillaCompraReqRelacion 
				WHERE rowguid_reng_req = @Rowguid_Rel_Req
				FETCH NEXT FROM REQ_RELACION 
				INTO @Rowguid_Rel_Req
			END 
        CLOSE REQ_RELACION
        DEALLOCATE REQ_RELACION

		--Elimino registros de saPlantillaCompraReqRenglon
		DECLARE @Rowguid_Reng_Req UNIQUEIDENTIFIER
		DECLARE REQ_RENGLONES CURSOR LOCAL FAST_FORWARD
        FOR
            (SELECT PCR.rowguid
			FROM
				saPlantillaCompraReng PCR 
				INNER JOIN saPlantillaCompra PC ON PC.doc_num = PCR.doc_num
			WHERE
				PC.rowguid = @gRowguid_Plantilla_Compra 
			)
        OPEN REQ_RENGLONES

        FETCH NEXT FROM REQ_RENGLONES 
			INTO @Rowguid_Ren
```
