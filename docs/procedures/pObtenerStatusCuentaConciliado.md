# SP: pObtenerStatusCuentaConciliado
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pObtenerStatusCuentaConciliado] ( @sCodigoCuenta CHAR(6) )
AS 
    BEGIN
        DECLARE @bConciliado BIT
 
        IF EXISTS ( SELECT
                        mov_num
                    FROM
                        saMovimientoBanco
                    WHERE
                        cod_cta = @sCodigoCuenta
                        AND conciliado = 1 ) 
            SET @bConciliado = 1
        ELSE 
            SET @bConciliado = 0
    
        SELECT
            @bConciliado    
    END
```
