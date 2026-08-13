# SP: pSeleccionarConfigCobro
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saConfigCobro`](../tables/saConfigCobro.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigCobro
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigCobro] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigCobro
        WHERE
            co_config = @sCo_Config
    END
```
