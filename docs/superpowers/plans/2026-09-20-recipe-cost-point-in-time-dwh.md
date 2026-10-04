# Point-in-Time Recipe Cost for the DWH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `dwh.Fact_Sales`'s "latest cost snapshot regardless of date" approximation with a true point-in-time FIFO cost, computed via a set-based T-SQL query against the ERP's own timestamped consumption ledger.

**Architecture:** A new inline table-valued function (`dwh.fn_IngredientCostAsOf`) reconstructs a raw material's remaining FIFO layers as of any given date using `saCostoHistoricoSalida`'s per-event timestamps, instead of trusting the live, cumulative `cantidad_usada` column. A new mirror table (`stg.RecipeLine`) makes each recipe's ingredient list available to pure T-SQL, so `dwh.Load_Fact_Sales` and `dwh.Backfill_Fact_Sales_RecipeCost` can call the function once per distinct (product, sale-date) pair instead of joining to one "current" snapshot for everything.

**Tech Stack:** SQL Server T-SQL (window functions, inline TVFs, cross-database queries against `Ncake_a`), Bun + `mssql` + `bun:test` for the TypeScript loader and tests, Drizzle/SQLite for reading recipe definitions.

**Spec:** `docs/superpowers/specs/2026-09-20-recipe-cost-point-in-time-dwh-design.md`

## Global Constraints

- Nothing in this plan has been committed to git yet (`dwh-migrations/0031`/`0032`, `scripts/dwh-recipe-cost-load.ts` are all uncommitted from earlier this session) — edit those files **in place**, do not add a third migration on top of a known-superseded version.
- `/recetas` and `lib/costing/product-cost.ts` (`computeProductCost`) are explicitly **out of scope** — do not modify them. Recipe editing stays "cost right now."
- `stg.RecipeCostSnapshot` (from `0031`) keeps its current purpose unchanged — it still backs the Analytics "latest cost" column and a future cost-over-time chart. Do not remove it or change its shape.
- `Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount` must reflect **raw-material cost only** (`erp_article` recipe lines) — manual (non-ERP) lines never contribute to these columns, matching `computeProductCost().rawMaterialCostUsd`'s existing convention everywhere else in this codebase.
- Missing data is `NULL`, never `$0` — this is the single most important invariant in the recipes/costing module (`AGENTS.md`) and it must hold end-to-end through this new SQL path too.
- After editing a migration file whose contents are already marked applied in the local `dwh.__dwh_migrations` tracking table, manually re-run the corrected SQL against the local `DWH_AlimentosNY` database (the migration runner will not re-apply an already-recorded filename) — same approach already used once this session for a similar fix.
- All local DB access uses the credentials already in `.env.local` (`DB_SERVER=localhost`, `DB_NAME=Ncake_a`, `DB_USER=sa`, `DB_PASSWORD=YourStr0ngP@ssw0rd`) — run `set -a && source .env.local 2>/dev/null; set +a` before any `bun` command that touches the database.

---

## File Structure

- **Modify** `dwh-migrations/0032_fact_sales_recipe_cost.sql` — add `dwh.fn_IngredientCostAsOf` (new batch); replace the bodies of `dwh.Load_Fact_Sales` and `dwh.Backfill_Fact_Sales_RecipeCost`.
- **Modify** `dwh-migrations/0031_stg_recipe_cost_snapshot.sql` — add `stg.RecipeLine` table.
- **Modify** `scripts/dwh-recipe-cost-load.ts` — add a step that truncates and repopulates `stg.RecipeLine`.
- **Create** `scripts/dwh/__tests__/fn-ingredient-cost-as-of.test.ts` — direct tests of the new function.
- **Modify** `scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts` — add a point-in-time distinctness test through the full pipeline; add a `stg.RecipeLine` population assertion.
- **Modify** `docs/DATA_WAREHOUSE_GUIDE.md` and `dwh-migrations/README.md` — remove now-stale "current-cost proxy" language.

---

### Task 1: `dwh.fn_IngredientCostAsOf` — the point-in-time FIFO function

**Files:**
- Modify: `dwh-migrations/0032_fact_sales_recipe_cost.sql` (prepend a new first batch, before the existing `Load_Fact_Sales` batch)
- Create: `scripts/dwh/__tests__/fn-ingredient-cost-as-of.test.ts`

**Interfaces:**
- Produces: `dwh.fn_IngredientCostAsOf(@ArticleCoArt char(30), @AsOfDate datetime2(3), @QuantityNeeded decimal(18,5))` — an inline table-valued function returning a single row `(CostBsd decimal(18,5) NULL, HasData bit, Estimated bit)`. Tasks 3 and 4 call this via `CROSS APPLY`.

- [ ] **Step 1: Write the function**

Open `dwh-migrations/0032_fact_sales_recipe_cost.sql`. Insert this as a brand-new first batch, **before** the existing `CREATE OR ALTER PROCEDURE dwh.Load_Fact_Sales` batch (keep everything currently in the file — this is a pure addition at the top):

```sql
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
```

- [ ] **Step 2: Apply the migration locally**

```bash
set -a && source .env.local 2>/dev/null; set +a
bun run migrate:dwh
```

Expected: `✓ Migraciones aplicadas:` does **not** list `0032_fact_sales_recipe_cost.sql` (it's already recorded as applied from earlier this session) — so also run the new batch directly against the local DB to pick up the function:

```bash
set -a && source .env.local 2>/dev/null; set +a
sqlcmd -S localhost,1433 -U sa -P 'YourStr0ngP@ssw0rd' -d DWH_AlimentosNY -C -i dwh-migrations/0032_fact_sales_recipe_cost.sql
```

Expected: no errors. (This re-runs the whole file, including the not-yet-changed `Load_Fact_Sales`/`Backfill` batches from earlier this session — harmless, `CREATE OR ALTER` is idempotent.)

- [ ] **Step 3: Write the test file**

Create `scripts/dwh/__tests__/fn-ingredient-cost-as-of.test.ts`:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

process.env.DW_NAME = `DWH_AlimentosNY_Test_fn_ingredient_cost_${Date.now()}`;

function dwhTestConfig(database: string): sql.config {
  return {
    server: process.env.DW_SERVER ?? process.env.DB_SERVER!,
    port: parseInt(process.env.DW_PORT ?? process.env.DB_PORT ?? '1433'),
    database,
    user: process.env.DW_USER ?? process.env.DB_USER!,
    password: process.env.DW_PASSWORD ?? process.env.DB_PASSWORD!,
    options: {
      encrypt: (process.env.DW_ENCRYPT ?? process.env.DB_ENCRYPT) === 'true',
      trustServerCertificate: (process.env.DW_TRUST_SERVER_CERT ?? process.env.DB_TRUST_SERVER_CERT) !== 'false',
    },
  };
}

function erpTestConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

async function callFn(dwhPool: sql.ConnectionPool, coArt: string, asOf: Date, qty: number) {
  const result = await dwhPool.request()
    .input('art', sql.Char(30), coArt)
    .input('asOf', sql.DateTime2(3), asOf)
    .input('qty', sql.Decimal(18, 5), qty)
    .query(`SELECT * FROM dwh.fn_IngredientCostAsOf(@art, @asOf, @qty)`);
  return result.recordset[0] as { CostBsd: number | null; HasData: boolean; Estimated: boolean };
}

describe('dwh.fn_IngredientCostAsOf', () => {
  let dwhPool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    dwhPool = await new sql.ConnectionPool(dwhTestConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(erpTestConfig()).connect();
  }, 60_000);

  afterAll(async () => {
    await dwhPool.close();
    await erpPool.close();
    const masterPool = await new sql.ConnectionPool(dwhTestConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('returns HasData = false and a null cost for a date before the article had any purchase history', async () => {
    const anyArticle = await erpPool.request().query(`
      SELECT TOP 1 A.co_art FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
    `);
    const coArt = (anyArticle.recordset[0].co_art as string).trim();

    const row = await callFn(dwhPool, coArt, new Date('2000-01-01'), 1);
    expect(row.HasData).toBe(false);
    expect(row.CostBsd).toBeNull();
  });

  test('as-of "now" matches a hand-computed FIFO walk over the live cantidad_usada column', async () => {
    const article = await erpPool.request().query(`
      SELECT TOP 1 A.co_art
      FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
      WHERE (CHE.cantidad - CHE.cantidad_usada) > 0
      GROUP BY A.co_art
      HAVING COUNT(*) >= 1
    `);
    if (article.recordset.length === 0) throw new Error('No article with remaining stock found for this test');
    const coArt = (article.recordset[0].co_art as string).trim();

    const layersResult = await erpPool.request()
      .input('art', sql.Char(30), coArt)
      .query(`
        SELECT CHE.costo, CHE.cantidad - CHE.cantidad_usada AS Remaining
        FROM saCostoHistoricoEntrada CHE
        JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
        WHERE A.co_art = @art AND (CHE.cantidad - CHE.cantidad_usada) > 0
        ORDER BY CHE.fecha_emision ASC
      `);
    const layers = layersResult.recordset as { costo: number; Remaining: number }[];
    const totalRemaining = layers.reduce((s, l) => s + Number(l.Remaining), 0);
    const quantity = totalRemaining / 2;

    let remainingNeeded = quantity;
    let expectedCostBsd = 0;
    for (const layer of layers) {
      if (remainingNeeded <= 0) break;
      const take = Math.min(Number(layer.Remaining), remainingNeeded);
      expectedCostBsd += take * Number(layer.costo);
      remainingNeeded -= take;
    }

    const row = await callFn(dwhPool, coArt, new Date(), quantity);
    expect(Number(row.CostBsd)).toBeCloseTo(expectedCostBsd, 2);
    expect(row.Estimated).toBe(false);
  });

  test('an earlier as-of date excludes later purchase layers, producing a different cost than "now"', async () => {
    const candidate = await erpPool.request().query(`
      SELECT TOP 1 A.co_art
      FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
      WHERE CHE.tipo_doc = 'COMP'
      GROUP BY A.co_art
      HAVING COUNT(DISTINCT CHE.fecha_emision) >= 2 AND COUNT(DISTINCT CHE.costo) >= 2
    `);
    if (candidate.recordset.length === 0) {
      throw new Error('No article with multiple differently-priced purchase layers found for this test');
    }
    const coArt = (candidate.recordset[0].co_art as string).trim();

    const layersResult = await erpPool.request()
      .input('art', sql.Char(30), coArt)
      .query(`
        SELECT CHE.fecha_emision, CHE.cantidad
        FROM saCostoHistoricoEntrada CHE
        JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
        WHERE A.co_art = @art
        ORDER BY CHE.fecha_emision ASC
      `);
    const layers = layersResult.recordset as { fecha_emision: string; cantidad: number }[];
    const earliestDate = new Date(layers[0]!.fecha_emision);
    const dayAfterEarliest = new Date(earliestDate.getTime() + 24 * 60 * 60 * 1000);
    const quantity = Number(layers[0]!.cantidad);

    const asOfEarly = await callFn(dwhPool, coArt, dayAfterEarliest, quantity);
    const asOfNow = await callFn(dwhPool, coArt, new Date(), quantity);

    expect(Number(asOfEarly.CostBsd)).not.toBeCloseTo(Number(asOfNow.CostBsd), 2);
  });
});
```

- [ ] **Step 4: Run the tests**

```bash
set -a && source .env.local 2>/dev/null; set +a
bun test scripts/dwh/__tests__/fn-ingredient-cost-as-of.test.ts
```

Expected: 3 pass, 0 fail. If the third test throws "No article with multiple differently-priced purchase layers found," pick a different filter (e.g. drop the `tipo_doc = 'COMP'` restriction) — the local backup has plenty of raw materials with multi-date, inflation-driven price history (verified earlier this session for Aceite de Girasol, Harina, Azúcar, AVENA), so some article will satisfy this; don't hardcode a specific `co_art`.

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0032_fact_sales_recipe_cost.sql scripts/dwh/__tests__/fn-ingredient-cost-as-of.test.ts
git commit -m "feat: add point-in-time FIFO cost function for the DWH"
```

---

### Task 2: `stg.RecipeLine` — mirror recipe ingredient lists into the DWH

**Files:**
- Modify: `dwh-migrations/0031_stg_recipe_cost_snapshot.sql`
- Modify: `scripts/dwh-recipe-cost-load.ts`
- Modify: `scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `stg.RecipeLine` table `(RecipeLineKey bigint PK, ProductCode char(30), LineType varchar(20), IngredientCode char(30) NULL, Quantity decimal(18,5), ManualUnitCostUsd decimal(18,5) NULL, LoadedAtUtc datetime2(3))`. Tasks 3 and 4 read `ProductCode`, `LineType`, `IngredientCode`, `Quantity` from it.

- [ ] **Step 1: Add the table to the migration file**

Append to the end of `dwh-migrations/0031_stg_recipe_cost_snapshot.sql`:

```sql
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
```

- [ ] **Step 2: Apply the schema change locally**

```bash
set -a && source .env.local 2>/dev/null; set +a
sqlcmd -S localhost,1433 -U sa -P 'YourStr0ngP@ssw0rd' -d DWH_AlimentosNY -C -Q "
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
"
```

Expected: no errors.

- [ ] **Step 3: Read the current loader script**

Open `scripts/dwh-recipe-cost-load.ts` and find the `for (const recipe of activeRecipes)` loop inside `loadRecipeCostSnapshots`. You'll add a truncate before the loop and one insert per recipe line inside it.

- [ ] **Step 4: Add the truncate + repopulate logic**

In `scripts/dwh-recipe-cost-load.ts`, immediately after the line `const activeRecipes = sqliteDb.select().from(recipes).where(eq(recipes.active, true)).all();`, add:

```typescript
  await dwhPool.request().query(`TRUNCATE TABLE stg.RecipeLine`);
```

Then, inside the `for (const recipe of activeRecipes)` loop, immediately after the existing `const lines = sqliteDb.select()...all();` line (the same `lines` variable already used to build `input` for `computeProductCost`), add:

```typescript
    for (const line of lines) {
      await dwhPool.request()
        .input('productCode', sql.Char(30), recipe.coArt)
        .input('lineType', sql.VarChar(20), line.lineType)
        .input('ingredientCode', sql.Char(30), line.coArt)
        .input('quantity', sql.Decimal(18, 5), line.quantity)
        .input('manualUnitCostUsd', sql.Decimal(18, 5), line.manualUnitCostUsd)
        .query(`
          INSERT INTO stg.RecipeLine (ProductCode, LineType, IngredientCode, Quantity, ManualUnitCostUsd)
          VALUES (@productCode, @lineType, @ingredientCode, @quantity, @manualUnitCostUsd)
        `);
    }
```

- [ ] **Step 5: Write a test for the repopulation**

Open `scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts`. Add this test inside the existing `describe('Recipe cost -> Fact_Sales pipeline', ...)` block, after the existing `'loadRecipeCostSnapshots writes one row to stg.RecipeCostSnapshot...'` test:

```typescript
  test('loadRecipeCostSnapshots also mirrors the recipe\'s lines into stg.RecipeLine', async () => {
    await loadRecipeCostSnapshots({ sqliteDb: getDb(), erpPool, dwhPool });

    const rows = await dwhPool.request()
      .input('code', sql.Char(30), TEST_PRODUCT_CO_ART)
      .query(`SELECT LineType, IngredientCode, Quantity FROM stg.RecipeLine WHERE ProductCode = @code`);
    expect(rows.recordset).toHaveLength(1);
    expect(rows.recordset[0].LineType).toBe('erp_article');
    expect((rows.recordset[0].IngredientCode as string).trim()).toBe(TEST_INGREDIENT_CO_ART);
    expect(Number(rows.recordset[0].Quantity)).toBeCloseTo(0.1, 5);
  });
```

- [ ] **Step 6: Run the tests**

```bash
set -a && source .env.local 2>/dev/null; set +a
bun test scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts
```

Expected: all tests in the file pass (the existing ones plus the new one — 4 total).

- [ ] **Step 7: Commit**

```bash
git add dwh-migrations/0031_stg_recipe_cost_snapshot.sql scripts/dwh-recipe-cost-load.ts scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts
git commit -m "feat: mirror recipe ingredient lines into the DWH"
```

---

### Task 3: Point-in-time cost in `dwh.Load_Fact_Sales`

**Files:**
- Modify: `dwh-migrations/0032_fact_sales_recipe_cost.sql`
- Modify: `scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts`

**Interfaces:**
- Consumes: `dwh.fn_IngredientCostAsOf` (Task 1), `stg.RecipeLine` (Task 2).
- Produces: `dwh.Load_Fact_Sales` populates `UnitCost`/`COGSAmount`/`GrossProfitAmount`/`CostSourceFlag` using each sale's own date, not "the latest snapshot."

- [ ] **Step 1: Replace the procedure body**

In `dwh-migrations/0032_fact_sales_recipe_cost.sql`, find the `CREATE OR ALTER PROCEDURE dwh.Load_Fact_Sales` batch (the second batch in the file, after Task 1's new function batch). Replace the entire batch with:

```sql
CREATE OR ALTER PROCEDURE dwh.Load_Fact_Sales
AS
BEGIN
    SET NOCOUNT ON;
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
        WHERE EXISTS (SELECT 1 FROM stg.RecipeLine rl WHERE RTRIM(rl.ProductCode) = RTRIM(c.co_art) AND rl.LineType = 'erp_article')
    ),
    LineCosts AS (
        SELECT pdp.co_art, pdp.AsOfDate, ic.CostBsd, ic.HasData, ic.Estimated
        FROM ProductDatePairs pdp
        JOIN stg.RecipeLine rl ON RTRIM(rl.ProductCode) = RTRIM(pdp.co_art) AND rl.LineType = 'erp_article'
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
            CASE WHEN pdc.RawMaterialCostBsd IS NULL THEN NULL ELSE pdc.RawMaterialCostBsd / r.tasa_v END AS RawMaterialCostUsd
        FROM ProductDateCost pdc
        CROSS APPLY (
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
```

- [ ] **Step 2: Apply it locally**

```bash
set -a && source .env.local 2>/dev/null; set +a
sqlcmd -S localhost,1433 -U sa -P 'YourStr0ngP@ssw0rd' -d DWH_AlimentosNY -C -i dwh-migrations/0032_fact_sales_recipe_cost.sql
```

Expected: no errors.

- [ ] **Step 3: Write the point-in-time distinctness test**

Add this test to `scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts`, inside the existing `describe` block, after the existing `'Load_Fact_Sales + the automatic backfill populate cost columns...'` test:

```typescript
  test('two sales of the same product on different real historical dates get different point-in-time costs', async () => {
    // The fixture ingredient (Harina Panadera, real inflation-driven price
    // history verified earlier this session) has purchase layers at
    // multiple different prices across multiple dates — use that directly
    // rather than asserting against the fixture recipe's product, since we
    // need two *sale* dates on the same product with different underlying
    // ingredient cost. Reuse whatever product/date pairs already exist for
    // the fixture ingredient's real ERP purchase history to build two
    // distinct recipes on two different (fabricated) product codes pointing
    // at the same ingredient, each asked "as of" a different real date.
    const layers = await erpPool.request()
      .input('art', sql.Char(30), TEST_INGREDIENT_CO_ART)
      .query(`
        SELECT CHE.fecha_emision, CHE.costo
        FROM saCostoHistoricoEntrada CHE
        JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
        WHERE A.co_art = @art
        ORDER BY CHE.fecha_emision ASC
      `);
    const rows = layers.recordset as { fecha_emision: string; costo: number }[];
    if (rows.length < 2 || new Set(rows.map(r => Number(r.costo))).size < 2) {
      throw new Error(`${TEST_INGREDIENT_CO_ART} needs at least 2 differently-priced layers for this test`);
    }
    const earlyDate = new Date(new Date(rows[0]!.fecha_emision).getTime() + 24 * 60 * 60 * 1000);
    const lateDate = new Date(new Date(rows[rows.length - 1]!.fecha_emision).getTime() + 24 * 60 * 60 * 1000);

    const earlyCost = await dwhPool.request()
      .input('art', sql.Char(30), TEST_INGREDIENT_CO_ART)
      .input('asOf', sql.DateTime2(3), earlyDate)
      .input('qty', sql.Decimal(18, 5), 0.1)
      .query(`SELECT * FROM dwh.fn_IngredientCostAsOf(@art, @asOf, @qty)`);
    const lateCost = await dwhPool.request()
      .input('art', sql.Char(30), TEST_INGREDIENT_CO_ART)
      .input('asOf', sql.DateTime2(3), lateDate)
      .input('qty', sql.Decimal(18, 5), 0.1)
      .query(`SELECT * FROM dwh.fn_IngredientCostAsOf(@art, @asOf, @qty)`);

    expect(Number(earlyCost.recordset[0].CostBsd)).not.toBeCloseTo(Number(lateCost.recordset[0].CostBsd), 4);

    // End-to-end: the fixture recipe/product's Fact_Sales rows must reflect
    // per-date cost, not one blanket value, once real sales exist across
    // more than one distinct date for it.
    await loadRecipeCostSnapshots({ sqliteDb: getDb(), erpPool, dwhPool });
    await dwhPool.request().execute('dwh.Load_Fact_Sales');
    const distinctCosts = await dwhPool.request()
      .input('code', sql.Char(30), TEST_PRODUCT_CO_ART)
      .query(`
        SELECT DISTINCT fs.UnitCost
        FROM fact.Fact_Sales fs
        JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
        WHERE p.ProductCode = @code AND fs.UnitCost IS NOT NULL
      `);
    // Not asserting >1 here (the fixture's real sale dates might all fall in
    // a single-cost window) — this just documents/exercises the pipeline
    // end-to-end; the function-level assertion above is the real proof.
    expect(distinctCosts.recordset.length).toBeGreaterThanOrEqual(1);
  });
```

- [ ] **Step 4: Run the tests**

```bash
set -a && source .env.local 2>/dev/null; set +a
bun test scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts scripts/dwh/__tests__/fact-sales.test.ts
```

Expected: all pass. `fact-sales.test.ts`'s existing `'cost columns are NULL and CostSourceFlag is NO_COST_DATA...'` test must still pass unchanged (its throwaway DB never populates `stg.RecipeLine`, so `ProductDatePairs` is always empty for it, same as before).

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0032_fact_sales_recipe_cost.sql scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts
git commit -m "feat: compute Fact_Sales cost point-in-time instead of from the latest snapshot"
```

---

### Task 4: Point-in-time cost in `dwh.Backfill_Fact_Sales_RecipeCost`

**Files:**
- Modify: `dwh-migrations/0032_fact_sales_recipe_cost.sql`
- Modify: `scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts`

**Interfaces:**
- Consumes: `dwh.fn_IngredientCostAsOf` (Task 1), `stg.RecipeLine` (Task 2), `dim.Dim_Date.FullDate` (existing column, confirmed present).
- Produces: `dwh.Backfill_Fact_Sales_RecipeCost` recomputes point-in-time cost for every distinct date already in `Fact_Sales` per product, not "apply the latest snapshot everywhere."

- [ ] **Step 1: Replace the procedure body**

In `dwh-migrations/0032_fact_sales_recipe_cost.sql`, find the `CREATE OR ALTER PROCEDURE dwh.Backfill_Fact_Sales_RecipeCost` batch (the third and final batch in the file). Replace the entire batch with:

```sql
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
            CASE WHEN pdc.RawMaterialCostBsd IS NULL THEN NULL ELSE pdc.RawMaterialCostBsd / r.tasa_v END AS RawMaterialCostUsd
        FROM ProductDateCost pdc
        CROSS APPLY (
            SELECT TOP 1 tasa_v FROM Ncake_a.dbo.saTasa WHERE co_mone = 'USD' AND fecha <= CAST(pdc.AsOfDate AS datetime2(3)) ORDER BY fecha DESC
        ) r
    )
    UPDATE fs SET
        fs.UnitCost = pdcu.RawMaterialCostUsd,
        fs.COGSAmount = pdcu.RawMaterialCostUsd * fs.QuantitySold,
        fs.GrossProfitAmount = fs.NetAmount - (pdcu.RawMaterialCostUsd * fs.QuantitySold),
        fs.CostSourceFlag = CASE WHEN pdcu.RawMaterialEstimatedInt = 1 THEN 'RECIPE_ESTIMATED' ELSE 'RECIPE_FIFO' END
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    JOIN ProductDateCostUsd pdcu ON RTRIM(pdcu.ProductCode) = RTRIM(p.ProductCode) AND pdcu.AsOfDate = d.FullDate
    WHERE pdcu.RawMaterialCostUsd IS NOT NULL;
END
GO
```

- [ ] **Step 2: Apply it locally**

```bash
set -a && source .env.local 2>/dev/null; set +a
sqlcmd -S localhost,1433 -U sa -P 'YourStr0ngP@ssw0rd' -d DWH_AlimentosNY -C -i dwh-migrations/0032_fact_sales_recipe_cost.sql
```

Expected: no errors.

- [ ] **Step 3: Verify end-to-end against real local data**

```bash
set -a && source .env.local 2>/dev/null; set +a
bun run dwh:incremental-load
```

Expected: `Incremental Load ran successfully`. Then confirm per-date variation exists somewhere in the real data (not just the test fixture):

```bash
sqlcmd -S localhost,1433 -U sa -P 'YourStr0ngP@ssw0rd' -d DWH_AlimentosNY -C -Q "
SET NOCOUNT ON;
SELECT p.ProductCode, COUNT(DISTINCT fs.UnitCost) AS DistinctUnitCosts, COUNT(*) AS Rows
FROM fact.Fact_Sales fs
JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
WHERE fs.CostSourceFlag IN ('RECIPE_FIFO','RECIPE_ESTIMATED')
GROUP BY p.ProductCode
ORDER BY DistinctUnitCosts DESC;
"
```

Expected: at least one product shows `DistinctUnitCosts > 1` — proof the pipeline is genuinely computing different costs for different sale dates, not one blanket number per product (this was the entire point of the refactor — compare against the "always 1 distinct cost per product" behavior the old "latest snapshot" join would have produced).

- [ ] **Step 4: Run the full DWH test suite**

```bash
set -a && source .env.local 2>/dev/null; set +a
bun test scripts/dwh/__tests__/
```

Expected: same pass/fail counts as the pre-existing baseline from earlier this session (59 pass, 2 fail — both pre-existing failures in `sql-agent-jobs.test.ts`, unrelated to this work) — plus the new tests from Tasks 1-4 passing on top of that baseline.

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0032_fact_sales_recipe_cost.sql
git commit -m "feat: backfill Fact_Sales cost point-in-time instead of from the latest snapshot"
```

---

### Task 5: Update documentation

**Files:**
- Modify: `docs/DATA_WAREHOUSE_GUIDE.md`
- Modify: `dwh-migrations/README.md`

**Interfaces:**
- Consumes: nothing (docs-only task).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Update `docs/DATA_WAREHOUSE_GUIDE.md`**

Find the `Fact_Sales` column-detail table row for `UnitCost` (search for `stg.RecipeCostSnapshot.RawMaterialCostUsd`). Replace that row and the two rows below it with:

```markdown
| `UnitCost` | decimal(18,5) | `dwh.fn_IngredientCostAsOf` (point-in-time FIFO, as of the sale's own date) | `NULL` for any product with no recipe/no `stg.RecipeLine` rows, or whose raw-material cost is itself "Sin datos" as of that date |
| `COGSAmount` | decimal(18,2) | `UnitCost × QuantitySold` | `NULL` when `UnitCost` is `NULL` |
| `GrossProfitAmount` | decimal(18,2) | `NetAmount - COGSAmount` | `NULL` when `COGSAmount` is `NULL` |
```

Find the `**Cost Data Gap — partially resolved (2026-09-20)** ⚠️` section (search for that heading). Replace the paragraph starting with `**Two real limitations to know about, not bugs**:` through the end of that numbered list with:

```markdown
**One real limitation to know about, not a bug**: only products with an active recipe (and now, `stg.RecipeLine` rows) get real cost data — everything else stays `'NO_COST_DATA'`. Point-in-time accuracy is no longer a limitation: `dwh.fn_IngredientCostAsOf` (`dwh-migrations/0032`) reconstructs each ingredient's remaining FIFO layers as of the sale's own date from `saCostoHistoricoSalida`'s timestamped consumption ledger, rather than applying today's cost retroactively. This does still assume a recipe's ingredient list/quantities were constant over time — no recipe versioning exists, so it computes "what today's recipe formula would have cost on that historical date," not "what the recipe as it was actually defined back then would have cost."
```

- [ ] **Step 2: Update `dwh-migrations/README.md`**

Find the `## Margin/cost data — recipe-based, partial coverage (resolved 2026-09-20)` section. Replace the paragraph that begins with `**Coverage is partial by nature, not a bug**:` with:

```markdown
**Coverage is partial by nature, not a bug**: only products with an active recipe get real cost data (`CostSourceFlag` is `'RECIPE_FIFO'`/`'RECIPE_ESTIMATED'`); everything else stays `'NO_COST_DATA'`, same as before. Cost is now genuinely point-in-time, not a current-cost proxy: `dwh.fn_IngredientCostAsOf` reconstructs each raw material's remaining FIFO layers as of the sale's own date (from `saCostoHistoricoSalida`'s per-event timestamps), so two sales of the same product on different dates correctly get different costs when the ingredient's price changed in between. `stg.RecipeLine` mirrors each recipe's ingredient list into the DWH so this can run as one set-based T-SQL query per (product, date) pair instead of a per-sale round trip. The one remaining simplification: no recipe versioning exists, so this is "what today's recipe would have cost on that date," not "what the recipe as it was defined back then would have cost."
```

- [ ] **Step 3: Commit**

```bash
git add docs/DATA_WAREHOUSE_GUIDE.md dwh-migrations/README.md
git commit -m "docs: update DWH cost docs for point-in-time recipe costing"
```

---

## Self-Review Notes

**Spec coverage**: §3.1 (`stg.RecipeLine`) → Task 2. §3.2 (`fn_IngredientCostAsOf`) → Task 1. §4.1 (`Load_Fact_Sales`) → Task 3. §4.2 (`Backfill_Fact_Sales_RecipeCost`, including the `Dim_Date.FullDate` note) → Task 4. §5 (roll back in place, not layer new migrations) → followed throughout (all edits are in-place to `0031`/`0032`, with manual local re-sync steps). §6 (testing strategy) → Tasks 1, 2, 3, 4 each include the corresponding test. §7 (limitations) → Task 5 docs update.

**Placeholder scan**: no TBD/TODO; every step has real, complete code (SQL bodies and TypeScript test files in full, not sketches).

**Type consistency**: `dwh.fn_IngredientCostAsOf`'s three-column return shape (`CostBsd`, `HasData`, `Estimated`) is defined once in Task 1 and consumed identically (same column names, same `CROSS APPLY ... ic` aliasing) in Task 3 and Task 4. `stg.RecipeLine`'s column names (`ProductCode`, `LineType`, `IngredientCode`, `Quantity`) from Task 2 are used identically in Task 3's and Task 4's `JOIN stg.RecipeLine rl ON ...` clauses. `TEST_PRODUCT_CO_ART`/`TEST_INGREDIENT_CO_ART` (Task 3's test) are the constants already defined at the top of `scripts/dwh/__tests__/fact-sales-recipe-cost.test.ts` from earlier this session — not redefined.
