# SP: pValidarSStockAct
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarSStockAct]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN

        DECLARE @ValStockResult TABLE ( Motivo VARCHAR(256) )


        DECLARE STOCK_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                ISNULL(TABLA_CONSOLIDADA_STOCK_ACT.co_art, saStockAlmacen.co_art) AS co_art,
                ISNULL(TABLA_CONSOLIDADA_STOCK_ACT.co_alma, saStockAlmacen.co_alma) AS co_alma,
                ISNULL(TABLA_CONSOLIDADA_STOCK_ACT.total_art, 0) AS stock,
                ISNULL(saStockAlmacen.stock, 0) AS stockTeorico, CASE WHEN saStockAlmacen.stock IS NULL THEN 1
                                                                      ELSE 0
                                                                 END AS insertar
            FROM
                ( SELECT
                    co_art, co_alma, SUM(total_art) AS total_art, 'SACT' AS tipo_stock
                  FROM
                    ( SELECT
                        *
                      FROM
                        SStockActAjuste
                      UNION ALL
                      SELECT
                        *
                      FROM
                        SStockActTrasladoOri
                      UNION ALL
                      SELECT
                        *
                      FROM
                        SStockActTrasladoTemp
                      UNION ALL
                      SELECT
                        *
                      FROM
                        SStockActTrasladoTempS
                      UNION ALL
                      SELECT
                        *
                      FROM
                        SStockActTrasladoDest
                      UNION ALL
                      SELECT
                        *
                      FROM
                        SStockActCompuestoReng
                      UNION ALL
                      SELECT
                        *
                      FROM
                        SStockActCompuesto
                      UNION ALL
                      SELECT
                        *
                      FROM
                        SStockActDevolucionProveedor
                      UNION ALL
                      SELECT
                        *
                      FROM
                        SStockActDevolucionVenta
                      UNION ALL
```
