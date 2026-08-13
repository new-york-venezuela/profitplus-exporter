# SP: pSeleccionarContabilizacion
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pSeleccionarContabilizacion] ( @sInte_Num CHAR(20) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saIntegr
        WHERE
            inte_num = @sInte_Num
    END
```
