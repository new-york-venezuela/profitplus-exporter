# SP: pSeleccionarPlantillaCompraReq
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			: pSeleccionarCompraReq
DESCRIPCION		: Selecciona un registro de la tabla saPlantillaCompraReq segun su primary key
CREADO POR		: SOFTECH SISTEMAS
MODIFCADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarPlantillaCompraReq] ( @gRowguid_Plantilla_Compra uniqueidentifier )
AS 
    BEGIN

        SELECT
            PC.rowguid as rowguid_plantilla_compra, PCR.co_ubicacion, PCR.autorizado, PCR.descripcion, PCR.fecha,
			PCR.responsable, PCR.email, PCR.estatus, PCR.telefono, PCR.direccion, PCR.co_us_in, PCR.co_sucu_in, 
			PCR.fe_us_in, PCR.co_us_mo, PCR.co_sucu_mo, PCR.fe_us_mo, PCR.revisado, PCR.trasnfe, PCR.validador, PCR.rowguid
		FROM
            saPlantillaCompraReq PCR
            RIGHT JOIN saPlantillaCompra PC ON PCR.rowguid_plantilla_compra = PC.rowguid
        WHERE
            PC.rowguid = @gRowguid_Plantilla_Compra
    END
```
