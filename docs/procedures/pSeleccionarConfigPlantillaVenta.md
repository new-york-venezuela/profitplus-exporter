# SP: pSeleccionarConfigPlantillaVenta
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saConfigPlantillaVenta`](../tables/saConfigPlantillaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigPlantillaVenta
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigPlantillaVenta] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigPlantillaVenta
        WHERE
            co_config = @sCo_Config
    END
```
