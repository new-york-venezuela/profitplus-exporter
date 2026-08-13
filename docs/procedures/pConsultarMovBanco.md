# SP: pConsultarMovBanco
**Tipo**: Consultar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pConsultarMovBanco] ( @sCodCuentaBan CHAR(6) )
AS 
    BEGIN

        SELECT
            mov_num
        FROM
            saMovimientoBanco
        WHERE
            cod_cta = @sCodCuentaBan

    END
```
