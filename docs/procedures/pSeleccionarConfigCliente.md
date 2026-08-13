# SP: pSeleccionarConfigCliente
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saConfigCliente`](../tables/saConfigCliente.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigCliente
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigCliente] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigCliente
        WHERE
            co_config = @sCo_Config
    END
```
