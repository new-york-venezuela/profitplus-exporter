# SP: pValidarSStockDes
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarSStockDes]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN

        DECLARE @ValStockResult TABLE ( Motivo VARCHAR(256) )

        DECLARE @bManejaDespacho BIT
        SELECT
            @bManejaDespacho = ISNULL([v_concepto_despacho], 0)
        FROM
            par_emp

        DECLARE STOCK_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                ISNULL(TABLA_CONSOLIDADA_STOCK_DES.co_art, saStockAlmacen.co_art) AS co_art,
                ISNULL(TABLA_CONSOLIDADA_STOCK_DES.co_alma, saStockAlmacen.co_alma) AS co_alma,
                ISNULL(TABLA_CONSOLIDADA_STOCK_DES.total_art, 0) AS stock,
                ISNULL(saStockAlmacen.stock, 0) AS stockTeorico, CASE WHEN saStockAlmacen.stock IS NULL THEN 1
                                                                      ELSE 0
                                                                 END AS insertar
            FROM
                ( SELECT
                    co_art, co_alma, SUM(total_art) AS total_art, 'SDES' AS tipo_stock
                  FROM
                    ( SELECT
                        *
                      FROM
                        [SStockDesFacturaVenta]
                      WHERE
                        @bManejaDespacho = 1
                    ) AS TABLA_CONSOLIDADA_STOCK_DES_INT
                  GROUP BY
                    co_art, co_alma
                ) AS TABLA_CONSOLIDADA_STOCK_DES
                FULL OUTER JOIN saStockAlmacen ON TABLA_CONSOLIDADA_STOCK_DES.co_alma = saStockAlmacen.co_alma
                                                  AND TABLA_CONSOLIDADA_STOCK_DES.co_art = saStockAlmacen.co_art
                                                  AND TABLA_CONSOLIDADA_STOCK_DES.tipo_stock = saStockAlmacen.tipo
                                                  AND ( TABLA_CONSOLIDADA_STOCK_DES.tipo_stock = 'SDES'
                                                        OR saStockAlmacen.tipo = 'SDES'
                                                      )
            WHERE
                ( TABLA_CONSOLIDADA_STOCK_DES.tipo_stock = 'SDES'
                  OR saStockAlmacen.tipo = 'SDES'
                )
                AND ( TABLA_CONSOLIDADA_STOCK_DES.total_art <> saStockAlmacen.stock
                      OR ( TABLA_CONSOLIDADA_STOCK_DES.total_art IS NULL
                           AND saStockAlma
```
