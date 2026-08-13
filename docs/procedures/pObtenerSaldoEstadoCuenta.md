# SP: pObtenerSaldoEstadoCuenta
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saConciliacionAutoReng`](../tables/saConciliacionAutoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pObtenerSaldoEstadoCuenta] ( @sCod_Cta CHAR(6) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saConciliacionAutoReng
        WHERE
            cod_cta = @sCod_Cta


    END
```
