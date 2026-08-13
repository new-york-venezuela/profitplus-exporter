# SP: pObtenerStatusMovimientoCaja
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pObtenerStatusMovimientoCaja] ( 
@sMovNum CHAR(20) ,
@deMonto Decimal(18,6)
)
AS 
    BEGIN
        DECLARE @bExiste BIT
 
        IF EXISTS (SELECT
                        mov_num
                    FROM
                        saMovimientoCaja
                    WHERE
                        mov_num = @sMovNum
                        AND((monto_h = 0 and monto_d=@deMonto) or (monto_d= 0 and monto_h=@deMonto))
                        and anulado=0) 
            SET @bExiste = 0
        ELSE 
            SET @bExiste = 1
    
        SELECT
            @bExiste    
    END
```
