# Point-in-Time Recipe Cost for the DWH — Design

## 1. Purpose & Scope

`dwh-migrations/0031_stg_recipe_cost_snapshot.sql` and `0032_fact_sales_recipe_cost.sql` (implemented earlier today, applied to the local DWH but never committed) wired recipe-based FIFO costing into `fact.Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount`. That implementation has a known, deliberate limitation: it joins every sale to "the latest cost snapshot for that product," regardless of the sale's own date — a current-cost proxy applied retroactively, not real historical cost.

This spec replaces that join with a true point-in-time FIFO computation: for a historical sale, compute the ingredient cost **as it stood on that sale's date**, using the ERP's own timestamped consumption ledger (`saCostoHistoricoSalida`) to reconstruct what each raw-material layer's remaining quantity was on that date — not today's cumulative `cantidad_usada`.

**In scope**: `fact.Fact_Sales`'s cost columns, computed via a new date-aware T-SQL function.
**Explicitly out of scope**: the `/recetas` UI and `computeProductCost()` (`lib/costing/product-cost.ts`) — recipe editing stays "cost right now," unchanged. `stg.RecipeCostSnapshot` also stays, unchanged in purpose — it continues to serve the Analytics "latest cost per product" column and a future cost-over-time chart, neither of which need per-sale historical precision.
**Not addressed**: recipe formula versioning. A recipe's ingredient list/quantities are assumed constant over time — this computes "what today's recipe would have cost on a past date," not "what the recipe as it existed back then would have cost." No versioning exists to do better than this, and none is being added here.

## 2. Why a query, not a per-sale loop

The FIFO-as-of-a-date computation is expressible as one set-based SQL query per (article, date) pair, using a running-total window function — not a procedural per-sale loop, and not a scalar UDF (which SQL Server executes row-by-row, killing performance at any real scale). Confirmed live: `saCostoHistoricoEntrada` already has `IX_saCostoHistoricoEntrada_Articulo` and `IX_saCostoHistoricoEntrada_FechaEmision`; `saCostoHistoricoSalida` already has `IX_saCostoHistoricoSalida_Entrada`. The access pattern this design needs (filter entrada by article+date, filter salida by entrada-id+date) is already well-indexed — no new indexes required.

## 3. Data model

### 3.1 `stg.RecipeLine` (new)

A mirror of each active recipe's ingredient list, refreshed by the loader script every run (full truncate + reload — recipe data is small, no incremental merge needed). This exists so the point-in-time query can run entirely in T-SQL without reaching into the app's SQLite database per sale.

```sql
CREATE TABLE stg.RecipeLine (
    RecipeLineKey   bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ProductCode     char(30)       NOT NULL,   -- recipes.coArt
    LineType        varchar(20)    NOT NULL,   -- 'erp_article' | 'manual'
    IngredientCode  char(30)       NULL,       -- recipe_lines.coArt; NULL for manual lines
    Quantity        decimal(18,5)  NOT NULL,   -- per 1 unit of the finished good
    ManualUnitCostUsd decimal(18,5) NULL,      -- set iff LineType = 'manual'
    LoadedAtUtc     datetime2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_RecipeLine_ProductCode ON stg.RecipeLine (ProductCode);
```

Manual lines are mirrored too (for completeness/traceability) but never feed `Fact_Sales.UnitCost` — that column has always meant "raw material cost," matching `computeProductCost().rawMaterialCostUsd` exactly (erp_article lines only), the same convention already established for the recipe list's "Costo Materia Prima" column and the detail page's subtotal.

### 3.2 `dwh.fn_IngredientCostAsOf` (new, inline table-valued function)

```sql
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
        SELECT TOP 1 costo, fecha_emision
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
```

This mirrors `lib/costing/fifo.ts`'s `computeFifoCost` rule-for-rule, just parameterized by date and expressed set-based instead of as a JS loop:
- Layers are only eligible if they existed by `@AsOfDate` (`fecha_emision <= @AsOfDate`) — a layer purchased after the sale wasn't available to draw from.
- "Remaining as of that date" is reconstructed from `saCostoHistoricoSalida` events dated on or before `@AsOfDate`, not the live `cantidad_usada` column, which reflects consumption up to *today*.
- If total available-as-of-date is short of `@QuantityNeeded`, the shortfall is priced at the most-recent-as-of-that-date layer's cost and flagged `Estimated = 1` — same fallback rule as today.
- If there are **zero** layers at all as of that date (`HasData = 0`), the caller must render "Sin datos," never `$0` — the same invariant `AGENTS.md` already documents as the single most important one in this module.

### 3.3 `fact.Fact_Sales` cost columns — no schema change

Column shapes are unchanged from `0009`/`0032`. What changes is only how `Load_Fact_Sales` computes their values.

## 4. Load logic changes

### 4.1 `dwh.Load_Fact_Sales`

Replace the `LatestSnapshot` CTE (joins to the latest snapshot regardless of date) with a per-distinct-(product, date) computation:

1. Build the set of distinct `(ProductCode, DateKey)` pairs present in the current `Changed` batch that have at least one `stg.RecipeLine` row.
2. For each pair, `CROSS APPLY dwh.fn_IngredientCostAsOf(...)` once per `erp_article` recipe line for that product, summing `CostBsd` (NULL-propagating: if any line's `HasData = 0`, the product's cost for that date is NULL) and OR-ing `Estimated`.
3. Convert the summed BSD total to USD **once per date** (not per line) using the existing closest-rate-on-or-before-date pattern against `Ncake_a.dbo.saTasa` — matching `computeProductCost()`'s single top-level rate lookup, not a per-line conversion.
4. Join `Changed` to this computed set on `(co_art, DateKey)` to populate `UnitCost`/`COGSAmount`/`GrossProfitAmount`/`CostSourceFlag` in both the `WHEN MATCHED` and `WHEN NOT MATCHED` branches (`CostSourceFlag` values unchanged: `'RECIPE_FIFO'`, `'RECIPE_ESTIMATED'`, `'NO_COST_DATA'`).

### 4.2 `dwh.Backfill_Fact_Sales_RecipeCost`

Same trigger (called by the loader after refreshing `stg.RecipeLine`/`stg.RecipeCostSnapshot`), different body: for every product with at least one `stg.RecipeLine` row, compute point-in-time cost for **every distinct `DateKey` already in `Fact_Sales` for that product** (not just "apply the latest snapshot everywhere"). This is what lets a brand-new recipe correctly cost that product's entire pre-existing sales history, each sale getting its own date's cost rather than one blanket number.

**Implementation note on dates**: `fn_IngredientCostAsOf` takes a real `datetime2(3)`, but `Fact_Sales` only stores the integer `DateKey` (`yyyyMMdd`), not the original datetime — join to `dim.Dim_Date.FullDate` (confirmed present) to recover a real date for the function call. `Load_Fact_Sales` itself doesn't have this problem: `Changed.fec_emis` is already a real datetime, so use that directly there rather than round-tripping through `DateKey`.

### 4.3 Loader script (`scripts/dwh-recipe-cost-load.ts`)

Add a step that truncates and repopulates `stg.RecipeLine` from the same active-recipes read already being done for `stg.RecipeCostSnapshot` — one extra parameterized insert per recipe line, no new ERP queries needed (it's just the recipe definition, not a cost computation).

## 5. What gets rolled back

Nothing has been committed to git yet, so "rollback" here means editing the not-yet-committed local files directly rather than layering a third migration on top of a known-wrong intermediate state:

- `dwh-migrations/0031_stg_recipe_cost_snapshot.sql` — keep `stg.RecipeCostSnapshot` as-is (still needed, see §1); add `stg.RecipeLine` to this same file.
- `dwh-migrations/0032_fact_sales_recipe_cost.sql` — replace the `LatestSnapshot`-based `Load_Fact_Sales` body and `Backfill_Fact_Sales_RecipeCost` body with the point-in-time versions; add `dwh.fn_IngredientCostAsOf`.
- Local DWH database: since these migrations are already marked applied in `dwh.__dwh_migrations`, manually re-run the corrected SQL against the local DB after editing the files (same approach already used once this session for the backfill-procedure fix), rather than relying on the migration runner to detect the change.
- `docs/DATA_WAREHOUSE_GUIDE.md` / `dwh-migrations/README.md` — update the "current-cost proxy" limitation language now that it's resolved for `Fact_Sales`; keep the "coverage is partial" limitation (products without a recipe still get `NO_COST_DATA`) and the "no recipe versioning" limitation (§1) in its place.

## 6. Testing strategy

- Unit-style SQL tests for `dwh.fn_IngredientCostAsOf` directly: a quantity fully covered by one layer, a quantity spanning two layers, a shortfall triggering the estimated fallback, and zero layers as of the date (`HasData = 0`).
- Extend `scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts`: assert that two sales of the same product on different real historical dates (with different real FIFO layer states as of those dates — the local backup's Aceite de Girasol purchase history from earlier this session, at three different real prices, gives a ready-made fixture) get **different** `UnitCost` values matching each date's independently-verified point-in-time cost, not the same current-cost value.
- Keep the existing idempotency check (re-running load + backfill doesn't change row counts or values).
- Re-verify against the real local data used earlier (the four demo recipes) that today's cost still matches what the interactive `/recetas` pages show for a sale dated today, as a sanity cross-check between the two independent code paths (TS "now" vs. SQL "as of now").

## 7. Known limitations (carried forward or new)

- **No recipe versioning** (§1) — already stated above, the one genuinely new limitation this design introduces.
- **Coverage is still partial** — only products with a recipe (and now, additionally, with `stg.RecipeLine` rows) get real cost; unchanged from the current implementation.
- **ERP consumption history is only as complete as what's actually been recorded** — raw-material depletion via adjustments only became a real workflow recently (this session's earlier work); dates before that will legitimately show `HasData = 0` for many raw materials, which is correct behavior (honest "Sin datos"), not a bug to work around.
- **Performance is a real question at production scale**, not yet empirically verified beyond the local backup's data volume — §6's testing plan exercises correctness, not load-scale performance; if this becomes slow against real production volume, the indexes already exist (§2) but query plan behavior should be re-checked before relying on this for a large historical backfill.
