# SP: pSeleccionarConfigNotaEntregaVenta
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saConfigNotaEntregaVenta`](../tables/saConfigNotaEntregaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigNotaEntregaVenta
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:   SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigNotaEntregaVenta] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigNotaEntregaVenta
        WHERE
            co_config = @sCo_Config
    END
```
