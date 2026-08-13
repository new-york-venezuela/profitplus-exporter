# SP: pSeleccionarConfigCotizacionCliente
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saConfigCotizacionCliente`](../tables/saConfigCotizacionCliente.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigCotizacionCliente
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigCotizacionCliente] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigCotizacionCliente
        WHERE
            co_config = @sCo_Config
    END
```
