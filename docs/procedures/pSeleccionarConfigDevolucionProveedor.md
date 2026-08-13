# SP: pSeleccionarConfigDevolucionProveedor
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saConfigDevolucionProveedor`](../tables/saConfigDevolucionProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigDevolucionProveedor
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigDevolucionProveedor] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigDevolucionProveedor
        WHERE
            co_config = @sCo_Config
    END
```
