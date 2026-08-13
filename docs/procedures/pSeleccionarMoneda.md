# SP: pSeleccionarMoneda
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saMoneda`](../tables/saMoneda.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarMoneda
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarMoneda] ( @sCo_Mone CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saMoneda
        WHERE
            co_mone = @sCo_Mone
    END
```
