# SP: pSeleccionarPlantillaCompraReqRelacion
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			: pSeleccionarCompraReq
DESCRIPCION		: Selecciona un registro de la tabla pSeleccionarPlantillaCompraReqRelacion segun su primary key
CREADO POR		: SOFTECH SISTEMAS
MODIFCADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarPlantillaCompraReqRelacion] ( @gRowguid_Reng_Req uniqueidentifier )
AS 
    BEGIN

        SELECT
            PCRENG.reng_num, A.co_art, A.art_des, PCRENG.co_uni, PCRREQREN.estatus,
			PCRENG.total_art, 
			PCRREQREN.fecha_requerida, PCRREQREN.fecha_real_entrega, PCRREQREN.rowguid AS rowguid_reng_req, PCRREQREN.rowguid, PCRREQREN.validador
		FROM
			saPlantillaCompra PC
			INNER JOIN saPlantillaCompraReq PCR ON PCR.rowguid_plantilla_compra = PC.rowguid
			INNER JOIN saPlantillaCompraReng PCRENG ON PCRENG.doc_num = PC.doc_num
			INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRENG.rowguid
			INNER JOIN saArticulo A ON a.co_art = PCRENG.co_art
        WHERE
            PCRREQREN.rowguid = @gRowguid_Reng_Req
    END
```
