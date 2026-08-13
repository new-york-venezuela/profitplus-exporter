# SP: pValidarSStockLle
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarSStockLle]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN

        DECLARE @ValStockResult TABLE ( Motivo VARCHAR(256) )


        DECLARE STOCK_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                ISNULL(TABLA_CONSOLIDADA_STOCK_LLE.co_art, saStockAlmacen.co_art) AS co_art,
                ISNULL(TABLA_CONSOLIDADA_STOCK_LLE.co_alma, saStockAlmacen.co_alma) AS co_alma,
                ISNULL(TABLA_CONSOLIDADA_STOCK_LLE.total_art, 0) AS stock,
                ISNULL(saStockAlmacen.stock, 0) AS stockTeorico, CASE WHEN saStockAlmacen.stock IS NULL THEN 1
                                                                      ELSE 0
                                                                 END AS insertar
            FROM
                ( SELECT
                    co_art, co_alma, SUM(total_art) AS total_art, 'SLLE' AS tipo_stock
                  FROM
                    ( SELECT
                        *
                      FROM
                        dbo.SStockLleOrdenCompra
                    ) AS TABLA_CONSOLIDADA_STOCK_LLE_INT
                  GROUP BY
                    co_art, co_alma
                ) AS TABLA_CONSOLIDADA_STOCK_LLE
                FULL OUTER JOIN saStockAlmacen ON TABLA_CONSOLIDADA_STOCK_LLE.co_alma = saStockAlmacen.co_alma
                                                  AND TABLA_CONSOLIDADA_STOCK_LLE.co_art = saStockAlmacen.co_art
                                                  AND TABLA_CONSOLIDADA_STOCK_LLE.tipo_stock = saStockAlmacen.tipo
                                                  AND ( TABLA_CONSOLIDADA_STOCK_LLE.tipo_stock = 'SLLE'
                                                        OR saStockAlmacen.tipo = 'SLLE'
                                                      )
            WHERE
                ( TABLA_CONSOLIDADA_STOCK_LLE.tipo_stock = 'SLLE'
                  OR saStockAlmacen.tipo = 'SLLE'
                )
                AND ( TABLA_CONSOLIDADA_STOCK_LLE.total_art <> saStockAlmacen.stock
                      OR ( TABLA_CONSOLIDADA_STOCK_LLE.total_art IS NULL
                           AND saStockAlmacen.stock <> 0
                         )
                      OR ( saStockAlmacen.stock IS NULL
                           AND TABLA_CONSOLIDADA_STOCK_LLE.total_art <> 0
                         )
                    )
```
