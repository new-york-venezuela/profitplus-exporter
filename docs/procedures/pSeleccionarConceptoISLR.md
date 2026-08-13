# SP: pSeleccionarConceptoISLR
**Tipo**: Seleccionar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saConISLR`](../tables/saConISLR.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pSeleccionarConceptoISLR] ( @sCo_Islr CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saConISLR
        WHERE
            co_islr = @sCo_Islr
    END
```
