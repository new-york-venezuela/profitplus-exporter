# SP: pSeleccionarConfigDistCosto
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saConfigDistCosto`](../tables/saConfigDistCosto.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigDistCosto
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarConfigDistCosto] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigDistCosto
        WHERE
            co_config = @sCo_Config
    END
```
