# SP: pSeleccionarRenglonesPlantillaCompraReq
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		:	pSeleccionarRenglonesPlantillaCompraReq
DESCRIPCION	:	Procedimiento para seleccionar los renglones de PlantillaCompraReq
CREADO POR	:	SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesPlantillaCompraReq]
    (
      @gRowguid_Plantilla_Compra UNIQUEIDENTIFIER
    )
AS 
    BEGIN

        SELECT
			  PCR.reng_num, PCR.rowguid as rowguid_plantilla_renglon, isnull(PCRR.estatus,0) as estatus, PCRR.fecha_requerida, PCRR.fecha_real_entrega, isnull(PCRR.satisface,0) as satisface,
			  PCRR.comentario, PCRR.co_us_in, PCRR.co_sucu_in, PCRR.fe_us_in, PCRR.co_us_mo, PCRR.co_sucu_mo, PCRR.fe_us_mo,
			  PCRR.revisado, PCRR.trasnfe, PCRR.validador, PCRR.rowguid, PCR.co_art, PCR.total_art, A.art_des, PCR.co_uni
        FROM
            saPlantillaCompraReqRenglon  PCRR
			right join saPlantillaCompraReng PCR ON PCRR.rowguid_plantilla_renglon = PCR.rowguid
			inner join saPlantillaCompra PC ON PC.doc_num = PCR.doc_num
			inner join saArticulo A ON A.co_art = PCR.co_art
        WHERE
            PC.rowguid = @gRowguid_Plantilla_Compra
	
    END
```
