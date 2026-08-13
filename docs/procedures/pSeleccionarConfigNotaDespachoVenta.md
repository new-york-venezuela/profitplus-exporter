# SP: pSeleccionarConfigNotaDespachoVenta
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saConfigNotaDespachoVenta`](../tables/saConfigNotaDespachoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigNotaDespachoVenta
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:   SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigNotaDespachoVenta] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigNotaDespachoVenta
        WHERE
            co_config = @sCo_Config
    END
```
