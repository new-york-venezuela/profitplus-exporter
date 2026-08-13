# SP: pSeleccionarConfigAjuste
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saConfigAjuste`](../tables/saConfigAjuste.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigAjuste
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigAjuste] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigAjuste
        WHERE
            co_config = @sCo_Config
    END
```
