# SP: pSeleccionarConfigNotaRecepcionCompra
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saConfigNotaRecepcionCompra`](../tables/saConfigNotaRecepcionCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigNotaRecepcionCompra
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:   SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigNotaRecepcionCompra] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConfigNotaRecepcionCompra
        WHERE
            co_config = @sCo_Config
    END
```
