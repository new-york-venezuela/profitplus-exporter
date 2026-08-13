# SP: pSeleccionarConfigPago
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saConfigPago`](../tables/saConfigPago.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigPago
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigPago] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigPago
        WHERE
            co_config = @sCo_Config
    END
```
