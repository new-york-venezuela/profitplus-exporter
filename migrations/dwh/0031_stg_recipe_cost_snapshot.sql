-- Staging table for product cost data computed OUTSIDE this SQL Server
-- instance: the exporter app's own SQLite database (`recipes`/`recipe_lines`,
-- lib/db/schema.ts) plus a live FIFO walk over Ncake_a.dbo.saCostoHistoricoEntrada
-- (lib/costing/*.ts, computeProductCost). Every other dim/fact loader in this
-- DWH is a pure T-SQL stored procedure reading Ncake_a.dbo.* directly (see
-- dwh-migrations/README.md) — that pattern doesn't work here because SQL
-- Server cannot query a SQLite file the way it queries Ncake_a via a
-- cross-database reference, and the FIFO cost walk itself runs in
-- TypeScript, not T-SQL. So this is the first DWH data source loaded by a
-- TypeScript orchestrator (scripts/dwh-recipe-cost-load.ts) instead of a
-- Load_* stored procedure: it opens the SQLite DB, the ERP pool, and this
-- DWH pool, computes cost per active recipe, and inserts rows here directly
-- from Node.
--
-- This is a NEW, unrelated use of the name "stg" — an earlier, since-deleted
-- Phase 1 design also had a `stg` schema for raw ERP landing tables (see
-- docs/DATA_WAREHOUSE_GUIDE.md's obsolete-schema note); that one is gone and
-- this is not a revival of it.
--
-- Append-only history, never updated in place: every loader run inserts one
-- new row per active recipe with the cost computed "as of now". This exists
-- because computeProductCost has no notion of historical cost either — FIFO
-- layers are walked from whatever currently has remaining stock, with no
-- date filter (only the BSD->USD rate lookup is date-aware). So there is no
-- way to compute "what this recipe would have cost on 2026-07-10" — only
-- "what it costs right now". Keeping a timestamped history here at least
-- lets a future analysis see how a recipe's cost has moved over time, even
-- though dwh.Load_Fact_Sales (0032) can only ever join sales to the LATEST
-- snapshot as a current-cost proxy, not a true point-in-time cost.
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'stg')
BEGIN
    EXEC('CREATE SCHEMA stg');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RecipeCostSnapshot' AND schema_id = SCHEMA_ID('stg'))
BEGIN
    CREATE TABLE stg.RecipeCostSnapshot (
        RecipeCostSnapshotKey  bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ProductCode            char(30)       NOT NULL,  -- app recipes.coArt == Ncake_a saArticulo.co_art
        RecipeId               int            NOT NULL,  -- app-side recipes.id, for traceability back to the source recipe
        TotalCostUsd           decimal(18,5)  NULL,       -- computeProductCost().totalUsd — all lines, incl. manual/non-ERP ingredients
        RawMaterialCostUsd     decimal(18,5)  NULL,       -- computeProductCost().rawMaterialCostUsd — erp_article lines only; NULL means "Sin datos", not $0
        Incomplete             bit            NOT NULL,
        RawMaterialEstimated   bit            NOT NULL,
        AsOfRateDateUtc        datetime2(3)   NULL,       -- saTasa rate date actually used for BSD->USD conversion
        SnapshotAtUtc          datetime2(3)   NOT NULL,   -- when this snapshot was computed; all rows from one loader run share one value
        LoadedAtUtc            datetime2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_RecipeCostSnapshot_Product_SnapshotAt ON stg.RecipeCostSnapshot (ProductCode, SnapshotAtUtc DESC);
END
GO

-- Mirrors each active recipe's ingredient list so the point-in-time cost
-- query (dwh.fn_IngredientCostAsOf, dwh-migrations/0032) can run entirely in
-- T-SQL without querying the app's SQLite database per sale. Full
-- truncate + reload every loader run — recipe data is small, no incremental
-- merge needed. Manual lines are mirrored too (for traceability) but never
-- feed Fact_Sales.UnitCost/COGSAmount — that has always meant raw-material
-- cost only, matching computeProductCost().rawMaterialCostUsd.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RecipeLine' AND schema_id = SCHEMA_ID('stg'))
BEGIN
    CREATE TABLE stg.RecipeLine (
        RecipeLineKey     bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ProductCode       char(30)       NOT NULL,
        LineType          varchar(20)    NOT NULL,
        IngredientCode    char(30)       NULL,
        Quantity          decimal(18,5)  NOT NULL,
        ManualUnitCostUsd decimal(18,5)  NULL,
        LoadedAtUtc       datetime2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_RecipeLine_ProductCode ON stg.RecipeLine (ProductCode);
END
GO
