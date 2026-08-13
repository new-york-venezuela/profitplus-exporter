# SP: pSeleccionarConfigCotizacionProveedor
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saConfigCotizacionProveedor`](../tables/saConfigCotizacionProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigCotizacionProveedor
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigCotizacionProveedor] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigCotizacionProveedor
        WHERE
            co_config = @sCo_Config
    END
```
