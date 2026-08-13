# SP: pSeleccionarConfigTraslado
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saConfigTraslado`](../tables/saConfigTraslado.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigTraslado
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigTraslado] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigTraslado
        WHERE
            co_config = @sCo_Config
    END
```
