# SP: pSeleccionarConfigPlantillaCompra
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saConfigPlantillaCompra`](../tables/saConfigPlantillaCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigPlantillaVenta
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigPlantillaCompra] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigPlantillaCompra
        WHERE
            co_config = @sCo_Config
    END
```
