# SP: pSeleccionarConfigProveedor
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saConfigProveedor`](../tables/saConfigProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigProveedor
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS.
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigProveedor] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigProveedor
        WHERE
            co_config = @sCo_Config
    END
```
