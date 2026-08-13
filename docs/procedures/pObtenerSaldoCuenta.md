# SP: pObtenerSaldoCuenta
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saSaldoBanco`](../tables/saSaldoBanco.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pObtenerSaldoCuenta] ( @sCodigoCuenta CHAR(6) )
AS 
    BEGIN
 
        SELECT
            s.saldo, s.tipo
        FROM
            saCuentaBancaria b
            INNER JOIN saSaldoBanco s ON b.cod_cta = s.cod_cta
        WHERE
            b.cod_cta = @sCodigoCuenta 
          
    END
```
