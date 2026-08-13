# SP: pConsultarStockArticulo
**Tipo**: Consultar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pConsultarStockArticulo]
    (
      @co_art CHAR(30) ,
      @co_alma CHAR(6) ,
      @tipo CHAR(3)
    )
AS 
    BEGIN
			
        SELECT
            co_art, stock
        FROM
            saStockAlmacen
        WHERE
            co_art = @co_art
            AND co_alma = @co_alma
            AND tipo = @tipo
        ORDER BY
            1, 2
    END
```
