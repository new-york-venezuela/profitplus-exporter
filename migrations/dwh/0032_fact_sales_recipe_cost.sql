-- Point-in-time FIFO cost for a raw material, as of a given date. Unlike
-- lib/costing/erp-layers.ts's getCostLayers (which reads the live, ever-
-- growing cantidad_usada column — always "as of right now"), this
-- reconstructs each layer's remaining quantity as of @AsOfDate from
-- saCostoHistoricoSalida's own per-event timestamps, and only considers
-- layers that existed by that date. Mirrors lib/costing/fifo.ts's
-- computeFifoCost rule-for-rule (oldest-layer-first walk, shortfall priced
-- at the most-recent-as-of-date layer and flagged Estimated, zero layers at
-- all means HasData = 0 — never a silent $0), expressed as one set-based
-- query with a running-total window function instead of a procedural loop,
-- so it can be evaluated for many (article, date) pairs at once (see
-- dwh.Load_Fact_Sales's CROSS APPLY usage) without executing row-by-row
-- like a scalar UDF would.
--
-- Deliberately day-precision: callers pass a date-only @AsOfDate (see Task 3
-- and 4's CAST(... AS date) usage) — "cost as of that calendar day," not
-- "as of that exact second." This matches how the rest of this DWH already
-- treats dates (DateKey has no time component either).
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'fn_IngredientCostAsOf' AND schema_id = SCHEMA_ID('dwh') AND type = 'IF')
    DROP FUNCTION dwh.fn_IngredientCostAsOf;
GO

CREATE FUNCTION dwh.fn_IngredientCostAsOf
(
    @ArticleCoArt char(30),
    @AsOfDate     datetime2(3),
    @QuantityNeeded decimal(18,5)
)
RETURNS TABLE
AS
RETURN
(
    WITH LayersAsOf AS (
        SELECT
            CHE.cod_costo_historico_entrada,
            CHE.fecha_emision,
            CHE.costo,
            CHE.cantidad - ISNULL((
                SELECT SUM(CHS.cantidad)
                FROM Ncake_a.dbo.saCostoHistoricoSalida CHS
                WHERE CHS.cod_costo_historico_entrada = CHE.cod_costo_historico_entrada
                  AND CHS.fecha_emision <= @AsOfDate
            ), 0) AS RemainingAsOf
        FROM Ncake_a.dbo.saCostoHistoricoEntrada CHE
        JOIN Ncake_a.dbo.saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
        WHERE A.co_art = @ArticleCoArt
          AND CHE.fecha_emision <= @AsOfDate
    ),
    Positive AS (
        SELECT *,
            SUM(RemainingAsOf) OVER (ORDER BY fecha_emision, cod_costo_historico_entrada
                                      ROWS UNBOUNDED PRECEDING) AS RunningTotal
        FROM LayersAsOf
        WHERE RemainingAsOf > 0
    ),
    Allocated AS (
        SELECT *,
            CASE
                WHEN RunningTotal - RemainingAsOf >= @QuantityNeeded THEN 0
                WHEN RunningTotal <= @QuantityNeeded THEN RemainingAsOf
                ELSE @QuantityNeeded - (RunningTotal - RemainingAsOf)
            END AS QuantityTaken
        FROM Positive
    ),
    MostRecentAsOf AS (
        SELECT TOP 1 costo
        FROM Ncake_a.dbo.saCostoHistoricoEntrada CHE
        JOIN Ncake_a.dbo.saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
        WHERE A.co_art = @ArticleCoArt AND CHE.fecha_emision <= @AsOfDate
        ORDER BY CHE.fecha_emision DESC
    ),
    Covered AS (
        SELECT ISNULL(SUM(QuantityTaken), 0) AS QuantityCovered, ISNULL(SUM(QuantityTaken * costo), 0) AS CostBsdCovered
        FROM Allocated WHERE QuantityTaken > 0
    )
    SELECT
        CASE WHEN NOT EXISTS (SELECT 1 FROM MostRecentAsOf) THEN NULL
             ELSE Covered.CostBsdCovered
                  + (@QuantityNeeded - Covered.QuantityCovered) * (SELECT costo FROM MostRecentAsOf)
        END AS CostBsd,
        CASE WHEN NOT EXISTS (SELECT 1 FROM MostRecentAsOf) THEN CAST(0 AS BIT)
             ELSE CAST(1 AS BIT) END AS HasData,
        CASE WHEN Covered.QuantityCovered < @QuantityNeeded
                  AND EXISTS (SELECT 1 FROM MostRecentAsOf) THEN CAST(1 AS BIT)
             ELSE CAST(0 AS BIT) END AS Estimated
    FROM Covered
);
GO

-- Wires stg.RecipeCostSnapshot (0031) into dwh.Load_Fact_Sales, populating
-- UnitCost/COGSAmount/GrossProfitAmount/CostSourceFlag instead of the
-- hardcoded NULL/NULL/NULL/'NO_COST_DATA' every row got since 0009. This is
-- the upstream costing process docs/DATA_WAREHOUSE_GUIDE.md and
-- dwh-migrations/README.md's "Margin/cost data — deferred" note said would
-- need to exist before these columns could be wired up — it now does
-- (recipes + live FIFO costing, lib/costing/*.ts), so this migration removes
-- that deferral.
--
-- Cost source: the LATEST stg.RecipeCostSnapshot row per product, regardless
-- of the sale's own date. This is a deliberate, honest simplification, not
-- an oversight: computeProductCost's FIFO walk has no historical/point-in-time
-- mode either (see 0031's comment) — it always answers "what does this cost
-- right now", so there is no more-accurate "cost as of the sale date" to sub
-- in instead. CostSourceFlag distinguishes what's actually knowable:
--   'RECIPE_FIFO'      — a recipe exists, every ERP ingredient had cost data, not flagged as estimated
--   'RECIPE_ESTIMATED' — a recipe exists but at least one line's cost is a FIFO fallback/estimate
--   'NO_COST_DATA'      — no recipe, or the recipe's raw-material cost itself is null ("Sin datos")
-- (Never the spec's original 'HISTORY' value — that name meant a real
-- costo_pro read from saCostoHistoricoSalida, a source confirmed dead/always
-- zero in this installation. Recipe/FIFO cost is a different, app-level
-- source, so it gets its own flag rather than overloading that name.)
CREATE OR ALTER PROCEDURE dwh.Load_Fact_Sales
AS
BEGIN
    SET NOCOUNT ON;
    -- saFacturaVentaReng (detail) has no `validador` column, unlike header/master tables
    -- elsewhere in this DWH — only an app-layer `fe_us_mo` (last-modified datetime), which is
    -- not a DB-generated monotonic rowversion. Accepted risk: if Profit Plus ever backdates or
    -- leaves fe_us_mo unset on some edit path, a change could theoretically be missed. This is
    -- the best available option given no validador/rowguid alternative exists on the detail
    -- table (ruling confirmed 2026-08-26; same pattern applies to future detail-table loads).
    DECLARE @DetailWatermark datetime2(3) = (SELECT LastValidatorDateTime FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaVentaReng');
    DECLARE @HeaderWatermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaVenta');
    DECLARE @NewDetailWatermark datetime2(3);
    DECLARE @NewHeaderWatermark binary(8);
    DECLARE @RowCount int;
    DECLARE @FactDocTypeKey int = (SELECT DocumentTypeKey FROM dim.Dim_DocumentType WHERE RTRIM(DocumentTypeCode) = 'FACT');

    ;WITH Changed AS (
        SELECT
            r.reng_num, r.doc_num, r.co_art, r.co_alma, r.total_art, r.prec_vta,
            ISNULL(r.monto_desc, 0) + ISNULL(r.monto_desc_glob, 0) AS DiscountAmount,
            ISNULL(r.monto_imp, 0) + ISNULL(r.monto_imp2, 0) + ISNULL(r.monto_imp3, 0) AS TaxAmount,
            r.reng_neto,
            f.co_cli, f.co_ven, f.co_mone, f.tasa, f.fec_emis, ISNULL(f.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saFacturaVentaReng r
        INNER JOIN Ncake_a.dbo.saFacturaVenta f ON f.doc_num = r.doc_num
        WHERE r.fe_us_mo > @DetailWatermark OR f.validador > @HeaderWatermark
    ),
    LatestSnapshot AS (
        SELECT ProductCode, RawMaterialCostUsd, RawMaterialEstimated,
               ROW_NUMBER() OVER (PARTITION BY ProductCode ORDER BY SnapshotAtUtc DESC) AS rn
        FROM stg.RecipeCostSnapshot
    )
    MERGE fact.Fact_Sales AS tgt
    USING (
        SELECT
            dk.DateKey, c.reng_num, c.doc_num,
            cust.CustomerKey, prod.ProductKey, rep.SalesRepKey, wh.WarehouseKey, cur.CurrencyKey,
            c.total_art AS QuantitySold,
            (c.total_art * c.prec_vta) AS GrossAmount,
            c.DiscountAmount, c.TaxAmount, c.reng_neto AS NetAmount,
            c.tasa AS DocumentExchangeRate, c.anulado AS IsVoided,
            rc.RawMaterialCostUsd AS UnitCost,
            CASE WHEN rc.RawMaterialCostUsd IS NOT NULL THEN rc.RawMaterialCostUsd * c.total_art END AS COGSAmount,
            CASE WHEN rc.RawMaterialCostUsd IS NOT NULL THEN c.reng_neto - (rc.RawMaterialCostUsd * c.total_art) END AS GrossProfitAmount,
            CASE
                WHEN rc.RawMaterialCostUsd IS NULL THEN 'NO_COST_DATA'
                WHEN rc.RawMaterialEstimated = 1 THEN 'RECIPE_ESTIMATED'
                ELSE 'RECIPE_FIFO'
            END AS CostSourceFlag
        FROM Changed c
        LEFT JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(c.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND cust.IsCurrent = 1
        LEFT JOIN dim.Dim_Product prod ON RTRIM(prod.ProductCode) = RTRIM(c.co_art) COLLATE SQL_Latin1_General_CP1_CI_AS AND prod.IsCurrent = 1
        LEFT JOIN dim.Dim_SalesRep rep ON RTRIM(rep.SalesRepCode) = RTRIM(c.co_ven) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Warehouse wh ON RTRIM(wh.WarehouseCode) = RTRIM(c.co_alma) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(c.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN LatestSnapshot rc ON RTRIM(rc.ProductCode) = RTRIM(c.co_art) COLLATE SQL_Latin1_General_CP1_CI_AS AND rc.rn = 1
        CROSS APPLY (SELECT CONVERT(int, FORMAT(c.fec_emis, 'yyyyMMdd')) AS DateKey) dk
        WHERE cust.CustomerKey IS NOT NULL AND prod.ProductKey IS NOT NULL
    ) AS src
        ON tgt.InvoiceNumber = src.doc_num COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.LineNumber = src.reng_num
    WHEN MATCHED THEN UPDATE SET
        tgt.DateKey = src.DateKey,
        tgt.CustomerKey = src.CustomerKey,
        tgt.ProductKey = src.ProductKey,
        tgt.SalesRepKey = src.SalesRepKey,
        tgt.WarehouseKey = src.WarehouseKey,
        tgt.CurrencyKey = src.CurrencyKey,
        tgt.QuantitySold = src.QuantitySold,
        tgt.GrossAmount = src.GrossAmount,
        tgt.DiscountAmount = src.DiscountAmount,
        tgt.TaxAmount = src.TaxAmount,
        tgt.NetAmount = src.NetAmount,
        tgt.UnitCost = src.UnitCost,
        tgt.COGSAmount = src.COGSAmount,
        tgt.GrossProfitAmount = src.GrossProfitAmount,
        tgt.CostSourceFlag = src.CostSourceFlag,
        tgt.DocumentExchangeRate = src.DocumentExchangeRate,
        tgt.IsVoided = src.IsVoided,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (
            DateKey, CustomerKey, ProductKey, SalesRepKey, WarehouseKey, CurrencyKey, DocumentTypeKey,
            InvoiceNumber, LineNumber, QuantitySold, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
            UnitCost, COGSAmount, GrossProfitAmount, CostSourceFlag, DocumentExchangeRate, IsVoided
        )
        VALUES (
            src.DateKey, src.CustomerKey, src.ProductKey, src.SalesRepKey, src.WarehouseKey, src.CurrencyKey, @FactDocTypeKey,
            src.doc_num, src.reng_num, src.QuantitySold, src.GrossAmount, src.DiscountAmount, src.TaxAmount, src.NetAmount,
            src.UnitCost, src.COGSAmount, src.GrossProfitAmount, src.CostSourceFlag, src.DocumentExchangeRate, src.IsVoided
        );

    SET @RowCount = @@ROWCOUNT;

    SELECT @NewDetailWatermark = MAX(fe_us_mo) FROM Ncake_a.dbo.saFacturaVentaReng;
    SELECT @NewHeaderWatermark = MAX(validador) FROM Ncake_a.dbo.saFacturaVenta;

    UPDATE dwh.EtlWatermark
    SET LastValidatorDateTime = ISNULL(@NewDetailWatermark, @DetailWatermark), LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saFacturaVentaReng';

    UPDATE dwh.EtlWatermark
    SET LastValidador = ISNULL(@NewHeaderWatermark, @HeaderWatermark), LastRunAtUtc = SYSUTCDATETIME()
    WHERE SourceTableName = 'saFacturaVenta';
END
GO

-- The MERGE above only re-evaluates rows whose ERP source changed since the
-- watermark (see dwh-migrations/README.md's Incremental watermark
-- strategy) — it will never revisit an already-loaded, unchanged invoice
-- line just because a recipe cost snapshot showed up later or changed. A
-- one-off backfill baked into this migration file would only ever run once,
-- at whatever moment this migration happens to be applied — almost
-- certainly before any recipe/snapshot data exists in a fresh environment,
-- which would make it a permanent no-op. So this is a callable procedure
-- instead (same idea as 0028/0029's backfills, but re-runnable), invoked by
-- scripts/dwh-recipe-cost-load.ts immediately after loading fresh snapshots
-- — every recipe-cost load run keeps Fact_Sales in sync automatically, both
-- for a brand-new recipe's past sales and for cost changes on existing
-- recipes, with no separate manual step.
--
-- Unconditional refresh (not just rows still at 'NO_COST_DATA'): a
-- product's latest snapshot cost can change between loader runs (new FIFO
-- layers, corrected recipe lines, etc.), and already-'RECIPE_FIFO'/
-- 'RECIPE_ESTIMATED' rows need to pick that up too. If a product's latest
-- snapshot ever has a NULL RawMaterialCostUsd ("Sin datos" - e.g. its only
-- recipe was deleted, or a raw material lost all cost history), rows keep
-- their last-known-good cost rather than reverting to NULL — treated as an
-- acceptable last-known-good default rather than manufacturing a new gap.
CREATE OR ALTER PROCEDURE dwh.Backfill_Fact_Sales_RecipeCost
AS
BEGIN
    SET NOCOUNT ON;
    ;WITH LatestSnapshot AS (
        SELECT ProductCode, RawMaterialCostUsd, RawMaterialEstimated,
               ROW_NUMBER() OVER (PARTITION BY ProductCode ORDER BY SnapshotAtUtc DESC) AS rn
        FROM stg.RecipeCostSnapshot
    )
    UPDATE fs SET
        fs.UnitCost = rc.RawMaterialCostUsd,
        fs.COGSAmount = rc.RawMaterialCostUsd * fs.QuantitySold,
        fs.GrossProfitAmount = fs.NetAmount - (rc.RawMaterialCostUsd * fs.QuantitySold),
        fs.CostSourceFlag = CASE WHEN rc.RawMaterialEstimated = 1 THEN 'RECIPE_ESTIMATED' ELSE 'RECIPE_FIFO' END
    FROM fact.Fact_Sales fs
    INNER JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    INNER JOIN LatestSnapshot rc ON RTRIM(rc.ProductCode) = RTRIM(p.ProductCode) AND rc.rn = 1
    WHERE rc.RawMaterialCostUsd IS NOT NULL;
END
GO
