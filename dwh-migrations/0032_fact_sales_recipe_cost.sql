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

-- Wires point-in-time recipe/FIFO costing into dwh.Load_Fact_Sales, populating
-- UnitCost/COGSAmount/GrossProfitAmount/CostSourceFlag instead of the
-- hardcoded NULL/NULL/NULL/'NO_COST_DATA' every row got since 0009. This is
-- the upstream costing process docs/DATA_WAREHOUSE_GUIDE.md and
-- dwh-migrations/README.md's "Margin/cost data — deferred" note said would
-- need to exist before these columns could be wired up — it now does.
--
-- Cost source: each sale's cost is computed AS OF THE SALE'S OWN DATE, not
-- from "the latest snapshot" applied retroactively. For every (product, sale
-- date) pair with a mirrored recipe (stg.RecipeLine, 0032/Task 2), this walks
-- each ingredient line through dwh.fn_IngredientCostAsOf (0032/Task 1), which
-- reconstructs FIFO layers as they stood on that date, sums per product/date,
-- NULL-propagates if any line lacks cost data, and converts BSD to USD once
-- per date via the nearest saTasa rate on/before that date. CostSourceFlag
-- distinguishes what's actually knowable:
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
    ProductDatePairs AS (
        SELECT DISTINCT c.co_art, CAST(c.fec_emis AS date) AS AsOfDate
        FROM Changed c
        WHERE EXISTS (SELECT 1 FROM stg.RecipeLine rl WHERE RTRIM(rl.ProductCode) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(c.co_art) AND rl.LineType = 'erp_article')
    ),
    LineCosts AS (
        SELECT pdp.co_art, pdp.AsOfDate, ic.CostBsd, ic.HasData, ic.Estimated
        FROM ProductDatePairs pdp
        JOIN stg.RecipeLine rl ON RTRIM(rl.ProductCode) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(pdp.co_art) AND rl.LineType = 'erp_article'
        CROSS APPLY dwh.fn_IngredientCostAsOf(rl.IngredientCode, CAST(pdp.AsOfDate AS datetime2(3)), rl.Quantity) ic
    ),
    ProductDateCost AS (
        SELECT co_art, AsOfDate,
            CASE WHEN MIN(CASE WHEN HasData = 0 THEN 0 ELSE 1 END) = 0 THEN NULL ELSE SUM(CostBsd) END AS RawMaterialCostBsd,
            MAX(CAST(Estimated AS INT)) AS RawMaterialEstimatedInt
        FROM LineCosts
        GROUP BY co_art, AsOfDate
    ),
    ProductDateCostUsd AS (
        SELECT pdc.co_art, pdc.AsOfDate, pdc.RawMaterialEstimatedInt,
            CASE WHEN pdc.RawMaterialCostBsd IS NULL OR r.tasa_v IS NULL THEN NULL ELSE pdc.RawMaterialCostBsd / NULLIF(r.tasa_v, 0) END AS RawMaterialCostUsd
        FROM ProductDateCost pdc
        OUTER APPLY (
            SELECT TOP 1 tasa_v FROM Ncake_a.dbo.saTasa WHERE co_mone = 'USD' AND fecha <= CAST(pdc.AsOfDate AS datetime2(3)) ORDER BY fecha DESC
        ) r
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
            pdcu.RawMaterialCostUsd AS UnitCost,
            CASE WHEN pdcu.RawMaterialCostUsd IS NOT NULL THEN pdcu.RawMaterialCostUsd * c.total_art END AS COGSAmount,
            CASE WHEN pdcu.RawMaterialCostUsd IS NOT NULL THEN c.reng_neto - (pdcu.RawMaterialCostUsd * c.total_art) END AS GrossProfitAmount,
            CASE
                WHEN pdcu.RawMaterialCostUsd IS NULL THEN 'NO_COST_DATA'
                WHEN pdcu.RawMaterialEstimatedInt = 1 THEN 'RECIPE_ESTIMATED'
                ELSE 'RECIPE_FIFO'
            END AS CostSourceFlag
        FROM Changed c
        LEFT JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(c.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND cust.IsCurrent = 1
        LEFT JOIN dim.Dim_Product prod ON RTRIM(prod.ProductCode) = RTRIM(c.co_art) COLLATE SQL_Latin1_General_CP1_CI_AS AND prod.IsCurrent = 1
        LEFT JOIN dim.Dim_SalesRep rep ON RTRIM(rep.SalesRepCode) = RTRIM(c.co_ven) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Warehouse wh ON RTRIM(wh.WarehouseCode) = RTRIM(c.co_alma) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(c.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN ProductDateCostUsd pdcu ON RTRIM(pdcu.co_art) = RTRIM(c.co_art) COLLATE SQL_Latin1_General_CP1_CI_AS AND pdcu.AsOfDate = CAST(c.fec_emis AS date)
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
-- Unconditional refresh (not just rows still at 'NO_COST_DATA'): every
-- product/date pair with a stg.RecipeLine row gets its point-in-time cost
-- recomputed on every backfill run, exactly like dwh.Load_Fact_Sales does
-- for newly-loaded rows. This includes going BACK to NULL/'NO_COST_DATA' if
-- no FIFO layer existed as of that date — e.g. a recipe line was corrected
-- to reference an ingredient with no purchase history yet, or a previously
-- available layer was found to be a data-entry error and removed upstream.
-- Mirrors dwh.Load_Fact_Sales's NULL handling exactly (same CASE shapes for
-- UnitCost/COGSAmount/GrossProfitAmount/CostSourceFlag) so the same
-- Fact_Sales row can never end up in a different state depending on which
-- of the two procedures last touched it. NULL never means "leave the old
-- value in place" here — this module's central invariant is that missing
-- data is NULL, never $0 and never stale.
CREATE OR ALTER PROCEDURE dwh.Backfill_Fact_Sales_RecipeCost
AS
BEGIN
    SET NOCOUNT ON;
    ;WITH ProductDatePairs AS (
        SELECT DISTINCT p.ProductCode, d.FullDate AS AsOfDate
        FROM fact.Fact_Sales fs
        JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
        JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
        WHERE EXISTS (SELECT 1 FROM stg.RecipeLine rl WHERE RTRIM(rl.ProductCode) = RTRIM(p.ProductCode) AND rl.LineType = 'erp_article')
    ),
    LineCosts AS (
        SELECT pdp.ProductCode, pdp.AsOfDate, ic.CostBsd, ic.HasData, ic.Estimated
        FROM ProductDatePairs pdp
        JOIN stg.RecipeLine rl ON RTRIM(rl.ProductCode) = RTRIM(pdp.ProductCode) AND rl.LineType = 'erp_article'
        CROSS APPLY dwh.fn_IngredientCostAsOf(rl.IngredientCode, CAST(pdp.AsOfDate AS datetime2(3)), rl.Quantity) ic
    ),
    ProductDateCost AS (
        SELECT ProductCode, AsOfDate,
            CASE WHEN MIN(CASE WHEN HasData = 0 THEN 0 ELSE 1 END) = 0 THEN NULL ELSE SUM(CostBsd) END AS RawMaterialCostBsd,
            MAX(CAST(Estimated AS INT)) AS RawMaterialEstimatedInt
        FROM LineCosts
        GROUP BY ProductCode, AsOfDate
    ),
    ProductDateCostUsd AS (
        SELECT pdc.ProductCode, pdc.AsOfDate, pdc.RawMaterialEstimatedInt,
            CASE WHEN pdc.RawMaterialCostBsd IS NULL OR r.tasa_v IS NULL THEN NULL ELSE pdc.RawMaterialCostBsd / NULLIF(r.tasa_v, 0) END AS RawMaterialCostUsd
        FROM ProductDateCost pdc
        OUTER APPLY (
            SELECT TOP 1 tasa_v FROM Ncake_a.dbo.saTasa WHERE co_mone = 'USD' AND fecha <= CAST(pdc.AsOfDate AS datetime2(3)) ORDER BY fecha DESC
        ) r
    )
    UPDATE fs SET
        fs.UnitCost = pdcu.RawMaterialCostUsd,
        fs.COGSAmount = CASE WHEN pdcu.RawMaterialCostUsd IS NOT NULL THEN pdcu.RawMaterialCostUsd * fs.QuantitySold END,
        fs.GrossProfitAmount = CASE WHEN pdcu.RawMaterialCostUsd IS NOT NULL THEN fs.NetAmount - (pdcu.RawMaterialCostUsd * fs.QuantitySold) END,
        fs.CostSourceFlag = CASE
            WHEN pdcu.RawMaterialCostUsd IS NULL THEN 'NO_COST_DATA'
            WHEN pdcu.RawMaterialEstimatedInt = 1 THEN 'RECIPE_ESTIMATED'
            ELSE 'RECIPE_FIFO' END
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    JOIN ProductDateCostUsd pdcu ON RTRIM(pdcu.ProductCode) = RTRIM(p.ProductCode) AND pdcu.AsOfDate = d.FullDate;
END
GO
