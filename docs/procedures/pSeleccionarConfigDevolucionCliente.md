# SP: pSeleccionarConfigDevolucionCliente
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saConfigDevolucionCliente`](../tables/saConfigDevolucionCliente.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigDevolucionCliente
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigDevolucionCliente] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigDevolucionCliente
        WHERE
            co_config = @sCo_Config
    END
```
