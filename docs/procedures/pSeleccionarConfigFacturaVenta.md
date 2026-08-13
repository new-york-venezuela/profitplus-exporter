# SP: pSeleccionarConfigFacturaVenta
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saConfigFacturaVenta`](../tables/saConfigFacturaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigFacturaVenta
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigFacturaVenta] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigFacturaVenta
        WHERE
            co_config = @sCo_Config
    END
```
