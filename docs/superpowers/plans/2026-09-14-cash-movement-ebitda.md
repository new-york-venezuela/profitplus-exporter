# Cash-Movement EBITDA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Finanzas tab's structurally-broken EBITDA calc (always `-GastosOperativos`, because `Fact_Sales.GrossProfitAmount` is always NULL) with a real cash-basis EBITDA computed from bank/cash movements (`Ingresos Operativos − Gastos Operativos`), as a section fully decoupled from the existing sales waterfall.

**Architecture:** Rename `fact.Fact_Expenses` → `fact.Fact_CashMovements` in place (same MERGE-based watermark-incremental ETL, widened to also load `ConceptType = 'Ingreso'` rows, still excluding `'Traspaso'`). Classify all 31 `Ingreso` concept codes in `dim.ExpenseConceptSeed` — only `I-01 Ventas` counts as operating income. The Finanzas API route gets a new `cashFlowEbitda` query/response block; the tab gets a new card reading it. Every reference to the old table/proc name is updated in the same change (route, query-builder comment, the incremental-load script, the DWH guide), and a final grep confirms nothing was missed.

**Tech Stack:** SQL Server (T-SQL migrations under `dwh-migrations/`), Next.js API routes (`app/api/dwh/finanzas/route.ts`), React (`app/(app)/analitica/tabs/tab-finanzas.tsx`), Bun test (`bun:test`) for ETL/unit tests, Playwright for E2E (`e2e/analitica.spec.ts`).

**Spec:** `docs/superpowers/specs/2026-09-14-cash-movement-ebitda-design.md`

## Global Constraints

- Never edit an existing numbered migration file — every change is a new file (`dwh-migrations/README.md`).
- Every migration must be idempotent (`IF NOT EXISTS` / `CREATE OR ALTER`), and multi-batch DDL separated by a line containing only `GO`.
- `saMovimientoBanco`/`saMovimientoCaja`/`saCuentaIngEgr` join keys are fixed-width `char` columns — always `LTRIM(RTRIM(...))` both sides of a join or comparison, with `COLLATE SQL_Latin1_General_CP1_CI_AS` when comparing across the `Ncake_a`/`DWH_AlimentosNY` cross-database boundary.
- `Ingreso`-side `Amount` values are negative under `monto_d - monto_h` (verified live 2026-09-14: I-01 nets to -65,957,202) — any query summing them for a positive "income" figure must negate.
- Operating income for EBITDA = `I-01` only (`Category = 'VentasOperativas'`); every other `Ingreso` code is `IsExcludedFromEbitda = 1`.
- Sales waterfall (`Bruto`→`Utilidad Bruta`) in `FinanzasResponse.waterfall` and `Fact_Sales`'s cost columns are untouched — this plan does not modify them.
- Every `Fact_Expenses`/`Load_Fact_Expenses` reference across the codebase is renamed in this plan — no half-migrated state (spec §6). Historical `docs/superpowers/plans/`/`specs/` files are point-in-time records and are never edited.
- Do not touch the already-staged deletions of `dwh-migrations/0013`/`0015`/`0016`/`0019`/`0022` or the DWH README's "Enabling the SQL Agent jobs" section — out of scope, the user has already made that call (SQL Agent unavailable under SQLEXPRESS in production).

---

## Task 1: `Fact_CashMovements` migration — rename + widen + income classification

**Files:**
- Create: `dwh-migrations/0023_fact_cash_movements.sql`
- Test: `scripts/dwh/__tests__/fact-cash-movements.test.ts`

**Interfaces:**
- Produces: `fact.Fact_CashMovements` table (same columns as old `Fact_Expenses`: `ExpenseKey`, `DateKey`, `ExpenseConceptKey`, `Amount`, `SourceTable`, `SourceMovNum`, `IsVoided`, `LoadedAtUtc`), `dwh.Load_Fact_CashMovements` procedure (no parameters, same as `Load_Fact_Expenses` was), and updated `dim.Dim_ExpenseConcept`/`dim.ExpenseConceptSeed` rows for all `Ingreso` codes. Task 2 (API route) queries `fact.Fact_CashMovements` joined to `dim.Dim_ExpenseConcept` filtering `ConceptType = 'Ingreso' AND IsExcludedFromEbitda = 0` for income, same as it already does for `Gasto`.

- [ ] **Step 1: Write the migration file**

Create `dwh-migrations/0023_fact_cash_movements.sql`:

```sql
-- Renames fact.Fact_Expenses -> fact.Fact_CashMovements and widens
-- Load_Fact_Expenses (recreated as Load_Fact_CashMovements) to also load
-- ConceptType = 'Ingreso' rows (previously excluded entirely to avoid
-- double-counting against Fact_Sales revenue -- Fact_Sales's revenue is not
-- usable for margin/EBITDA purposes since GrossProfitAmount is always NULL,
-- see docs/superpowers/specs/2026-09-14-cash-movement-ebitda-design.md).
-- Traspaso rows remain excluded (internal transfers, not real income or
-- expense).
--
-- Sign convention (verified live 2026-09-14): Amount = monto_d - monto_h.
-- Gasto rows net positive-as-expense (unchanged). Ingreso rows net negative
-- (I-01 Ventas: -65,957,202 over the verification window) since income
-- entries are credit-heavy. This migration does NOT flip the sign at load
-- time -- Fact_CashMovements.Amount keeps one consistent meaning ("debit
-- minus credit") for every row regardless of concept type. Consumers
-- (Finanzas API route) negate Ingreso-side sums themselves.
-- 0018_fact_expenses.sql declared the primary key inline
-- (`ExpenseKey bigint IDENTITY(1,1) NOT NULL PRIMARY KEY`), so SQL Server
-- assigned it an auto-generated name (e.g. PK__Fact_Exp__<hash>), not a
-- predictable literal like 'PK_Fact_Expenses' — it must be looked up via
-- sys.key_constraints rather than hard-coded. The unique constraint and both
-- foreign keys WERE explicitly named in 0018, so those rename directly.
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Expenses' AND schema_id = SCHEMA_ID('fact'))
   AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_CashMovements' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    DECLARE @PkName sysname = (
        SELECT kc.name
        FROM sys.key_constraints kc
        WHERE kc.parent_object_id = OBJECT_ID('fact.Fact_Expenses') AND kc.type = 'PK'
    );
    DECLARE @RenameSql nvarchar(max);

    EXEC sp_rename 'fact.Fact_Expenses', 'Fact_CashMovements';

    IF @PkName IS NOT NULL
    BEGIN
        SET @RenameSql = N'EXEC sp_rename N''fact.' + @PkName + N''', N''PK_Fact_CashMovements'', N''OBJECT''';
        EXEC sp_executesql @RenameSql;
    END

    EXEC sp_rename 'fact.UQ_Fact_Expenses_Source', 'UQ_Fact_CashMovements_Source', 'OBJECT';
    EXEC sp_rename 'fact.FK_Fact_Expenses_Dim_Date', 'FK_Fact_CashMovements_Dim_Date', 'OBJECT';
    EXEC sp_rename 'fact.FK_Fact_Expenses_Dim_ExpenseConcept', 'FK_Fact_CashMovements_Dim_ExpenseConcept', 'OBJECT';
    -- Index rename requires 'table.index' (not 'schema.index') as the first argument.
    EXEC sp_rename 'fact.Fact_CashMovements.IX_Fact_Expenses_DateKey', 'IX_Fact_CashMovements_DateKey', 'INDEX';
    EXEC sp_rename 'fact.Fact_CashMovements.IX_Fact_Expenses_ExpenseConceptKey', 'IX_Fact_CashMovements_ExpenseConceptKey', 'INDEX';
END
GO

-- Fresh-install path: if Fact_Expenses never existed on this DB (a brand new
-- DWH, e.g. a test database), create Fact_CashMovements directly instead of
-- renaming.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_CashMovements' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_CashMovements (
        ExpenseKey        bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Fact_CashMovements PRIMARY KEY,
        DateKey           int             NOT NULL,
        ExpenseConceptKey int             NOT NULL,
        Amount            decimal(18,2)   NOT NULL,
        SourceTable       varchar(20)     NOT NULL,
        SourceMovNum      char(20)        NOT NULL,
        IsVoided          bit             NOT NULL,
        LoadedAtUtc       datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_CashMovements_Source UNIQUE (SourceTable, SourceMovNum),
        CONSTRAINT FK_Fact_CashMovements_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_CashMovements_Dim_ExpenseConcept FOREIGN KEY (ExpenseConceptKey) REFERENCES dim.Dim_ExpenseConcept(ExpenseConceptKey)
    );
    CREATE INDEX IX_Fact_CashMovements_DateKey ON fact.Fact_CashMovements (DateKey);
    CREATE INDEX IX_Fact_CashMovements_ExpenseConceptKey ON fact.Fact_CashMovements (ExpenseConceptKey);
END
GO

-- Income classification: all 31 'I-' concept codes, verified live 2026-09-14
-- against Ncake_a.dbo.saCuentaIngEgr / saMovimientoBanco. I-01 Ventas is the
-- only one classified as operating revenue (dominates by volume, ~66M vs
-- low hundreds of thousands combined for everything else) -- see spec
-- section 3.2 for the full per-code rationale table. I-08 is already
-- ConceptType = 'Traspaso' in the existing 0017 seed and is untouched here.
--
-- MERGE against dim.ExpenseConceptSeed rather than a second INSERT block:
-- 0017's seed INSERT only ever wrote 'Ingreso' rows with Category = NULL
-- (see 0017_dim_expense_concept.sql's Ingresos/Impuestos-adjacent I- rows).
-- This MERGE updates those existing rows' Category in place instead of
-- inserting duplicates, and is itself idempotent (safe to re-run).
MERGE dim.ExpenseConceptSeed AS tgt
USING (VALUES
    ('I-01', 'VentasOperativas'),
    ('I-02', 'Otros'), ('I-03', 'Otros'), ('I-04', 'Otros'), ('I-05', 'Otros'),
    ('I-06', 'Otros'), ('I-07', 'Otros'), ('I-09', 'Otros'), ('I-10', 'Otros'),
    ('I-11', 'Otros'), ('I-12', 'Otros'), ('I-13', 'Otros'), ('I-14', 'Otros'),
    ('I-15', 'Otros'), ('I-16', 'Otros'), ('I-17', 'Otros'), ('I-18', 'Otros'),
    ('I-19', 'Otros'), ('I-20', 'Otros'), ('I-21', 'Otros'), ('I-22', 'Otros'),
    ('I-23', 'Otros'), ('I-24', 'Otros'), ('I-25', 'Otros'), ('I-26', 'Otros'),
    ('I-27', 'Otros'), ('I-28', 'Otros'), ('I-29', 'Otros'), ('I-30', 'Otros'),
    ('I-31', 'Otros'), ('I-32', 'Otros')
) AS src (ConceptCode, Category)
    ON tgt.ConceptCode = src.ConceptCode
WHEN MATCHED THEN UPDATE SET tgt.Category = src.Category;
GO

-- Widen Load_Dim_ExpenseConcept's IsExcludedFromEbitda derivation: the
-- original CASE only ever looked at Gasto-side categories (Intereses,
-- Impuestos). Every non-VentasOperativas Ingreso row must also be excluded
-- from EBITDA (loans, asset sales, interest income, receivables, FX, tax
-- pass-through -- see spec section 3.2), so this ORs in a second condition
-- rather than hand-flagging 30 individual seed rows.
CREATE OR ALTER PROCEDURE dwh.Load_Dim_ExpenseConcept
AS
BEGIN
    SET NOCOUNT ON;

    IF (SELECT COUNT(*) FROM dim.ExpenseConceptSeed) < 200
    BEGIN
        RAISERROR('Load_Dim_ExpenseConcept: dim.ExpenseConceptSeed has fewer than 200 rows (expected ~246). Aborting to avoid silently reclassifying all expense concepts to Otros/Gasto. Re-run the 0017_dim_expense_concept.sql seed INSERT to repopulate before retrying.', 16, 1);
        RETURN;
    END

    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCuentaIngEgr');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    MERGE dim.Dim_ExpenseConcept AS tgt
    USING (
        SELECT
            LTRIM(RTRIM(src.co_cta_ingr_egr)) AS ConceptCode,
            RTRIM(src.descrip) AS ConceptName,
            ISNULL(seed.ConceptType, 'Gasto') AS ConceptType,
            ISNULL(seed.Category, 'Otros') AS Category,
            CASE
                WHEN seed.Category IN ('Intereses', 'Impuestos') THEN 1
                WHEN seed.ConceptType = 'Ingreso' AND ISNULL(seed.Category, 'Otros') <> 'VentasOperativas' THEN 1
                ELSE 0
            END AS IsExcludedFromEbitda
        FROM Ncake_a.dbo.saCuentaIngEgr src
        LEFT JOIN dim.ExpenseConceptSeed seed ON LTRIM(RTRIM(seed.ConceptCode)) = LTRIM(RTRIM(src.co_cta_ingr_egr)) COLLATE SQL_Latin1_General_CP1_CI_AS
    ) AS src
        ON LTRIM(RTRIM(tgt.ConceptCode)) = LTRIM(RTRIM(src.ConceptCode)) COLLATE SQL_Latin1_General_CP1_CI_AS
    WHEN MATCHED THEN UPDATE SET
        tgt.ConceptName = src.ConceptName,
        tgt.ConceptType = src.ConceptType,
        tgt.Category = src.Category,
        tgt.IsExcludedFromEbitda = src.IsExcludedFromEbitda,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (ConceptCode, ConceptName, ConceptType, Category, IsExcludedFromEbitda)
        VALUES (src.ConceptCode, src.ConceptName, src.ConceptType, src.Category, src.IsExcludedFromEbitda);

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saCuentaIngEgr;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCuentaIngEgr';
END
GO

-- Load_Fact_CashMovements: same MERGE body as the old Load_Fact_Expenses,
-- widened to ConceptType IN ('Gasto', 'Ingreso') and targeting the renamed
-- table. Old Load_Fact_Expenses is dropped -- nothing else references it
-- after Task 3/4/5 of this plan update every call site.
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'Load_Fact_Expenses' AND schema_id = SCHEMA_ID('dwh'))
    DROP PROCEDURE dwh.Load_Fact_Expenses;
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_CashMovements
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @BancoWatermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saMovimientoBanco');
    DECLARE @CajaWatermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saMovimientoCaja');
    DECLARE @NewBancoWatermark binary(8);
    DECLARE @NewCajaWatermark binary(8);
    DECLARE @RowCount int;

    ;WITH Changed AS (
        SELECT
            'Banco' AS SourceTable, LTRIM(RTRIM(m.mov_num)) AS mov_num, m.fecha, m.co_cta_ingr_egr,
            (ISNULL(m.monto_d, 0) - ISNULL(m.monto_h, 0)) AS Amount, ISNULL(m.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saMovimientoBanco m
        WHERE m.validador > @BancoWatermark
        UNION ALL
        SELECT
            'Caja' AS SourceTable, LTRIM(RTRIM(m.mov_num)) AS mov_num, m.fecha, m.co_cta_ingr_egr,
            (ISNULL(m.monto_d, 0) - ISNULL(m.monto_h, 0)) AS Amount, ISNULL(m.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saMovimientoCaja m
        WHERE m.validador > @CajaWatermark
    )
    MERGE fact.Fact_CashMovements AS tgt
    USING (
        SELECT
            dk.DateKey, c.SourceTable, c.mov_num, ec.ExpenseConceptKey, c.Amount, c.anulado
        FROM Changed c
        JOIN dim.Dim_ExpenseConcept ec ON LTRIM(RTRIM(ec.ConceptCode)) = LTRIM(RTRIM(c.co_cta_ingr_egr)) COLLATE SQL_Latin1_General_CP1_CI_AS
        CROSS APPLY (SELECT CONVERT(int, FORMAT(c.fecha, 'yyyyMMdd')) AS DateKey) dk
        WHERE ec.ConceptType IN ('Gasto', 'Ingreso')
    ) AS src
        ON LTRIM(RTRIM(tgt.SourceTable)) = LTRIM(RTRIM(src.SourceTable)) AND LTRIM(RTRIM(tgt.SourceMovNum)) = LTRIM(RTRIM(src.mov_num)) COLLATE SQL_Latin1_General_CP1_CI_AS
    WHEN MATCHED THEN UPDATE SET
        tgt.DateKey = src.DateKey,
        tgt.ExpenseConceptKey = src.ExpenseConceptKey,
        tgt.Amount = src.Amount,
        tgt.IsVoided = src.anulado,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (DateKey, ExpenseConceptKey, Amount, SourceTable, SourceMovNum, IsVoided)
        VALUES (src.DateKey, src.ExpenseConceptKey, src.Amount, src.SourceTable, src.mov_num, src.anulado);

    SET @RowCount = @@ROWCOUNT;

    SELECT @NewBancoWatermark = ISNULL(MAX(validador), @BancoWatermark) FROM Ncake_a.dbo.saMovimientoBanco;
    SELECT @NewCajaWatermark = ISNULL(MAX(validador), @CajaWatermark) FROM Ncake_a.dbo.saMovimientoCaja;

    UPDATE dwh.EtlWatermark SET LastValidador = @NewBancoWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount WHERE SourceTableName = 'saMovimientoBanco';
    UPDATE dwh.EtlWatermark SET LastValidador = @NewCajaWatermark, LastRunAtUtc = SYSUTCDATETIME() WHERE SourceTableName = 'saMovimientoCaja';
END
GO
```

- [ ] **Step 2: Run the migration locally against the real local dev DWH to verify the rename path applies cleanly**

This step matters specifically because the local dev DWH already has `fact.Fact_Expenses` (from migrations 0017/0018 having run previously, same DB the original bug report was reproduced against) — this is what actually exercises the `sp_rename` path in Step 1, including the dynamic-SQL primary-key lookup. The fresh-install branch (`CREATE TABLE fact.Fact_CashMovements` directly) only runs on a brand-new DB and would silently skip testing the rename logic entirely — running this against a scratch/from-empty DB would NOT catch a broken rename.

Run: `bun run migrate:dwh`
Expected: no errors; `0023_fact_cash_movements.sql` recorded in `dwh.__dwh_migrations`. Then verify the rename actually took effect:

```sql
SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('fact') AND name IN ('Fact_Expenses', 'Fact_CashMovements');
-- Expected: one row, 'Fact_CashMovements'. If 'Fact_Expenses' still appears, the rename didn't run.
SELECT name FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('fact.Fact_CashMovements');
-- Expected: one row named 'PK_Fact_CashMovements'.
```

- [ ] **Step 3: Write the failing test**

Create `scripts/dwh/__tests__/fact-cash-movements.test.ts`:

```typescript
// scripts/dwh/__tests__/fact-cash-movements.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

function testConfig(database: string): sql.config {
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

describe('Fact_CashMovements', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_ExpenseConcept');
  });

  afterAll(async () => {
    await pool.close();
    await erpPool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('I-01 Ventas is classified as operating income (IsExcludedFromEbitda = 0, Category = VentasOperativas)', async () => {
    const result = await pool.request().query(`
      SELECT Category, IsExcludedFromEbitda FROM dim.Dim_ExpenseConcept WHERE ConceptCode = 'I-01'
    `);
    expect(result.recordset[0].Category).toBe('VentasOperativas');
    expect(result.recordset[0].IsExcludedFromEbitda).toBe(false);
  });

  test('every other Ingreso concept is excluded from EBITDA', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dim.Dim_ExpenseConcept
      WHERE ConceptType = 'Ingreso' AND ConceptCode <> 'I-01' AND IsExcludedFromEbitda = 0
    `);
    expect(result.recordset[0].total).toBe(0);
  });

  test('Traspaso concepts (e.g. I-08) remain ConceptType = Traspaso, not reclassified as Ingreso', async () => {
    const result = await pool.request().query(`
      SELECT ConceptType FROM dim.Dim_ExpenseConcept WHERE ConceptCode = 'I-08'
    `);
    expect(result.recordset[0].ConceptType).toBe('Traspaso');
  });

  test('loads both Gasto and Ingreso rows from saMovimientoBanco/saMovimientoCaja, excluding Traspaso', async () => {
    await pool.request().execute('dwh.Load_Fact_CashMovements');

    const erpCount = await erpPool.request().query(`
      SELECT COUNT(*) AS total
      FROM (
        SELECT co_cta_ingr_egr FROM saMovimientoBanco
        UNION ALL
        SELECT co_cta_ingr_egr FROM saMovimientoCaja
      ) m
      INNER JOIN saCuentaIngEgr c ON LTRIM(RTRIM(c.co_cta_ingr_egr)) = LTRIM(RTRIM(m.co_cta_ingr_egr))
    `);
    // saCuentaIngEgr has no ConceptType column itself (that's a DWH-side
    // classification derived in Dim_ExpenseConcept), so this ERP-side count
    // is every movement joining to a known concept at all -- Fact_CashMovements
    // should be a subset of it (Traspaso-classified concepts excluded).
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_CashMovements`);
    expect(Number(dwhCount.recordset[0].total)).toBeGreaterThan(0);
    expect(Number(dwhCount.recordset[0].total)).toBeLessThanOrEqual(Number(erpCount.recordset[0].total));
  });

  test('an Ingreso row (I-01) has a negative Amount, matching the debit-minus-credit sign convention', async () => {
    await pool.request().execute('dwh.Load_Fact_CashMovements');

    const result = await pool.request().query(`
      SELECT TOP 1 fe.Amount
      FROM fact.Fact_CashMovements fe
      JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
      WHERE ec.ConceptCode = 'I-01' AND fe.IsVoided = 0
      ORDER BY fe.Amount ASC
    `);
    if (result.recordset.length === 0) return; // no I-01 movements in this dataset -- skip
    expect(Number(result.recordset[0].Amount)).toBeLessThan(0);
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Fact_CashMovements');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_CashMovements`);

    await pool.request().execute('dwh.Load_Fact_CashMovements');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_CashMovements`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails before the migration exists**

Run: `bun test scripts/dwh/__tests__/fact-cash-movements.test.ts`
Expected: FAIL (table/procedure `Fact_CashMovements`/`Load_Fact_CashMovements` don't exist yet, since Step 1's file wasn't created until this same task — if Steps 1-2 already ran, this step instead confirms the test passes; run it before Step 1 in strict TDD order if starting fresh, otherwise proceed to Step 5).

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test scripts/dwh/__tests__/fact-cash-movements.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 6: Commit**

```bash
git add dwh-migrations/0023_fact_cash_movements.sql scripts/dwh/__tests__/fact-cash-movements.test.ts
git commit -m "feat: rename Fact_Expenses to Fact_CashMovements, load Ingreso rows"
```

---

## Task 2: Update `dwh-incremental-load.ts` to call the renamed procedure

**Files:**
- Modify: `scripts/dwh-incremental-load.ts:30`

**Interfaces:**
- Consumes: `dwh.Load_Fact_CashMovements` (Task 1).

- [ ] **Step 1: Update the EXEC call**

In `scripts/dwh-incremental-load.ts`, change:

```typescript
EXEC dwh.Load_Fact_Expenses;
```

to:

```typescript
EXEC dwh.Load_Fact_CashMovements;
```

- [ ] **Step 2: Verify the script still runs end-to-end against the local dev DWH**

Run: `bun run scripts/dwh-incremental-load.ts`
Expected: `Incremental Load ran successfully` printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/dwh-incremental-load.ts
git commit -m "chore: call renamed Load_Fact_CashMovements from incremental load script"
```

---

## Task 3: Finanzas API route — `cashFlowEbitda` block

**Files:**
- Modify: `app/api/dwh/finanzas/route.ts`
- Modify: `app/(app)/analitica/types.ts:182-202`
- Modify: `app/api/dwh/lib/query-builder.ts` (comment only)
- Test: `app/api/dwh/finanzas/__tests__/route.test.ts` (new file — no existing test for this route)

**Interfaces:**
- Consumes: `fact.Fact_CashMovements` / `dim.Dim_ExpenseConcept` (Task 1).
- Produces: `FinanzasResponse.cashFlowEbitda: CashFlowEbitda` (`{ ingresosOperativos, gastosOperativos, ebitda, intereses, impuestos, utilidadNeta }`, all `number`). Task 4 (tab component) reads this field. `FinanzasResponse.waterfall` no longer contains the `Gastos Operativos`/`EBITDA (aprox.)`/`Intereses`/`Impuestos`/`Utilidad Neta` steps. `FinanzasResponse` no longer has top-level `ebitda`/`intereses`/`impuestos`/`utilidadNeta` fields.

- [ ] **Step 1: Update `FinanzasResponse` types**

In `app/(app)/analitica/types.ts`, replace lines 194-202:

```typescript
export interface FinanzasResponse {
  waterfall: FinanzasWaterfallStep[];
  ebitda: number;
  intereses: number;
  impuestos: number;
  utilidadNeta: number;
  expenseBreakdown: ExpenseCategoryRow[];
  usdRate: number | null;
}
```

with:

```typescript
export interface CashFlowEbitda {
  ingresosOperativos: number;
  gastosOperativos: number;
  ebitda: number;
  intereses: number;
  impuestos: number;
  utilidadNeta: number;
}

export interface FinanzasResponse {
  waterfall: FinanzasWaterfallStep[];
  cashFlowEbitda: CashFlowEbitda;
  expenseBreakdown: ExpenseCategoryRow[];
  usdRate: number | null;
}
```

- [ ] **Step 2: Write the failing test**

Create `app/api/dwh/finanzas/__tests__/route.test.ts` (same thin auth-gate pattern as `ventas/__tests__/route.test.ts` — full data-shape verification happens in E2E, Task 5):

```typescript
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/finanzas', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/finanzas?dateRange=12m');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test app/api/dwh/finanzas/__tests__/route.test.ts`
Expected: FAIL — either a TypeScript error from the still-old route file, or (if it compiles) fails because `route.ts` hasn't been updated to match the new types yet. If it happens to already pass at this point (route.ts still compiles fine against old types before Step 4), that's expected too — the real verification for this task is the type-check in Step 5 and the E2E test in Task 5.

- [ ] **Step 4: Update `app/api/dwh/finanzas/route.ts`**

Replace the whole file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause } from '@/app/api/dwh/lib/query-builder';
import type { FinanzasResponse, FinanzasWaterfallStep, ExpenseCategoryRow } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.
//
// COGSAmount/GrossProfitAmount are nullable on fact.Fact_Sales (populated only
// once a cost source is available — see dwh-migrations/0009_fact_sales.sql,
// CostSourceFlag = 'NO_COST_DATA' otherwise), so they're ISNULL-wrapped before
// summing to avoid a NULL total wiping out the whole aggregate. This means
// utilidadBruta below is always 0 today — EBITDA is deliberately NOT derived
// from it (see cashFlowEbitdaQuery / docs/superpowers/specs/
// 2026-09-14-cash-movement-ebitda-design.md), only the sales waterfall still
// uses it, for revenue/discount-rate visibility.

function waterfallTotalsQuery(dateWhere: string): string {
  return `
    SELECT
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      SUM(fs.NetAmount) AS NetAmount,
      SUM(ISNULL(fs.COGSAmount, 0)) AS COGSAmount,
      SUM(ISNULL(fs.GrossProfitAmount, 0)) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    WHERE fs.IsVoided = 0 ${dateWhere}
  `;
}

// Operating expenses from fact.Fact_CashMovements, grouped by category — feeds
// both the "Gastos Operativos" breakdown table and the EBITDA calc. Filters
// on the IsExcludedFromEbitda bit column (set by dwh.Load_Dim_ExpenseConcept
// — see 0017_dim_expense_concept.sql / 0023_fact_cash_movements.sql) rather
// than a Category NOT IN (...) string-literal list, so the bit column is the
// single source of truth for this business rule.
function expenseCategoryQuery(dateWhere: string): string {
  return `
    SELECT ec.Category, SUM(fe.Amount) AS TotalAmount
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.IsExcludedFromEbitda = 0 ${dateWhere}
    GROUP BY ec.Category
    ORDER BY TotalAmount DESC
  `;
}

// Intereses/Impuestos, kept separate from Gastos Operativos so EBITDA can
// exclude them per definition (Earnings Before Interest, Taxes, ...). Same
// IsExcludedFromEbitda bit column as above, inverted, scoped to Gasto so an
// Ingreso-side exclusion (e.g. asset sale income) never lands in this
// Gasto-labeled Intereses/Impuestos breakout.
function excludedExpenseQuery(dateWhere: string): string {
  return `
    SELECT ec.Category, SUM(fe.Amount) AS TotalAmount
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.IsExcludedFromEbitda = 1 ${dateWhere}
    GROUP BY ec.Category
  `;
}

// Operating income for cash-basis EBITDA: I-01 Ventas only (IsExcludedFromEbitda
// = 0 among Ingreso concepts — every other Ingreso code is loans, asset sales,
// interest income, receivables, FX, or tax pass-through, see spec section 3.2).
// Amount is negated: Ingreso rows net negative under monto_d - monto_h
// (verified live 2026-09-14), so -SUM(...) yields a positive income figure.
function cashFlowIncomeQuery(dateWhere: string): string {
  return `
    SELECT SUM(-fe.Amount) AS IngresosOperativos
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Ingreso' AND ec.IsExcludedFromEbitda = 0 ${dateWhere}
  `;
}

// Concept-level drilldown for a single expense category (breakdownBy=concepto
// drilldown target — clicking "Nomina" in the Gastos Operativos breakdown
// shows its individual concepts, e.g. "Sueldos Administrativos", "Bono
// Vacacional", etc.). Same { breakdown: BreakdownRow[] } contract as every
// other tab's breakdown fetch (see ventas/route.ts, vendedores/route.ts).
function conceptBreakdownQuery(dateWhere: string): string {
  return `
    SELECT TOP 15 ec.ConceptName AS GroupLabel, ec.ConceptCode AS GroupValue, SUM(fe.Amount) AS Amount
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.Category = @category ${dateWhere}
    GROUP BY ec.ConceptName, ec.ConceptCode
    ORDER BY Amount DESC
  `;
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const breakdownByParam = searchParams.get('breakdownBy');
  const parentValue = searchParams.get('parentValue');

  try {
    const pool = await getDwhPool();

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const expenseDateWhere = buildDateWhereClause(dateRange, 'fe');

    if (breakdownByParam === 'concepto' && parentValue) {
      const req = pool.request();
      req.input('category', parentValue);
      const result = await req.query(conceptBreakdownQuery(expenseDateWhere));
      return NextResponse.json({
        breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), amount: Number(r.Amount) })),
      });
    }

    const [totals, categoryResult, excludedResult, incomeResult, usdRate] = await Promise.all([
      pool.request().query(waterfallTotalsQuery(salesDateWhere)),
      pool.request().query(expenseCategoryQuery(expenseDateWhere)),
      pool.request().query(excludedExpenseQuery(expenseDateWhere)),
      pool.request().query(cashFlowIncomeQuery(expenseDateWhere)),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

    const row = totals.recordset[0] ?? {
      GrossAmount: 0,
      DiscountAmount: 0,
      NetAmount: 0,
      COGSAmount: 0,
      GrossProfitAmount: 0,
    };

    const grossAmount = Number(row.GrossAmount);
    const discountAmount = Number(row.DiscountAmount);
    const netAmount = Number(row.NetAmount);
    const cogsAmount = Number(row.COGSAmount);
    const grossProfitAmount = Number(row.GrossProfitAmount);

    const waterfall: FinanzasWaterfallStep[] = [
      { step: 'Bruto', amount: grossAmount, cumulative: grossAmount },
      { step: 'Descuento', amount: -discountAmount, cumulative: grossAmount - discountAmount },
      { step: 'Neto', amount: netAmount, cumulative: netAmount },
      { step: 'COGS', amount: -cogsAmount, cumulative: netAmount - cogsAmount },
      { step: 'Utilidad Bruta', amount: grossProfitAmount, cumulative: grossProfitAmount },
    ];

    const expenseBreakdown: ExpenseCategoryRow[] = categoryResult.recordset.map(r => ({
      category: String(r.Category),
      amount: Number(r.TotalAmount),
    }));

    const gastosOperativos = expenseBreakdown.reduce((sum, r) => sum + r.amount, 0);
    const intereses = Number(excludedResult.recordset.find(r => r.Category === 'Intereses')?.TotalAmount ?? 0);
    const impuestos = Number(excludedResult.recordset.find(r => r.Category === 'Impuestos')?.TotalAmount ?? 0);
    const ingresosOperativos = Number(incomeResult.recordset[0]?.IngresosOperativos ?? 0);

    // Cash-basis EBITDA, decoupled from the Fact_Sales waterfall above (see
    // docs/superpowers/specs/2026-09-14-cash-movement-ebitda-design.md
    // section 2): Ingresos Operativos (I-01 Ventas from movimientos) minus
    // Gastos Operativos (also from movimientos). Replaces the old
    // "Utilidad Bruta - Gastos Operativos" calc, which was always exactly
    // -gastosOperativos because Fact_Sales.GrossProfitAmount is always NULL
    // (no cost data has ever been recorded in Profit Plus).
    const ebitda = ingresosOperativos - gastosOperativos;
    const utilidadNeta = ebitda - intereses - impuestos;

    const response: FinanzasResponse = {
      waterfall,
      cashFlowEbitda: {
        ingresosOperativos,
        gastosOperativos,
        ebitda,
        intereses,
        impuestos,
        utilidadNeta,
      },
      expenseBreakdown,
      usdRate,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Update the `query-builder.ts` fact-table comment**

In `app/api/dwh/lib/query-builder.ts`, find the comment block listing fact tables (around the `Dimension` type / `getDimensionSpec` documentation) that says:

```typescript
 * fact.Fact_Collections and fact.Fact_Expenses are also read under
 * app/api/dwh/, but never through getDimensionSpec/isDimension (their
 * queries hard-code their own columns), so they're intentionally omitted
 * here.
```

Change `fact.Fact_Expenses` to `fact.Fact_CashMovements`:

```typescript
 * fact.Fact_Collections and fact.Fact_CashMovements are also read under
 * app/api/dwh/, but never through getDimensionSpec/isDimension (their
 * queries hard-code their own columns), so they're intentionally omitted
 * here.
```

- [ ] **Step 6: Run the test and type-check**

Run: `bun test app/api/dwh/finanzas/__tests__/route.test.ts && bunx tsc --noEmit`
Expected: test PASSES; type-check has no errors (confirms no other file still references the old `FinanzasResponse.ebitda`/`.intereses`/`.impuestos`/`.utilidadNeta` top-level fields or `Fact_Expenses`).

- [ ] **Step 7: Commit**

```bash
git add app/api/dwh/finanzas/route.ts app/(app)/analitica/types.ts app/api/dwh/lib/query-builder.ts app/api/dwh/finanzas/__tests__/route.test.ts
git commit -m "feat: compute EBITDA from cash movements, decoupled from sales waterfall"
```

---

## Task 4: Finanzas tab — new EBITDA card

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-finanzas.tsx`

**Interfaces:**
- Consumes: `FinanzasResponse.cashFlowEbitda: CashFlowEbitda` (Task 3).

- [ ] **Step 1: Remove the old EBITDA/Intereses/Impuestos/Utilidad Neta KPI row and its waterfall coupling**

In `app/(app)/analitica/tabs/tab-finanzas.tsx`, remove this block (currently lines 245-256):

```tsx
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div title={EBITDA_TOOLTIP} className="cursor-help">
          <KpiCard label="EBITDA (aprox.)" value={moneyLabel(data.ebitda, currency, rate)} />
        </div>
        <KpiCard label="Intereses" value={moneyLabel(data.intereses, currency, rate)} />
        <KpiCard label="Impuestos" value={moneyLabel(data.impuestos, currency, rate)} />
        <KpiCard
          label="Utilidad neta"
          value={moneyLabel(data.utilidadNeta, currency, rate)}
          tone={data.utilidadNeta < 0 ? 'warn' : 'default'}
        />
      </div>
```

- [ ] **Step 2: Add a new "EBITDA (movimientos de caja)" card in its place**

Insert this in the same position (between the sales KPI row and the "Cascada de rentabilidad" `ChartCard`):

```tsx
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">EBITDA (movimientos de caja)</h2>
          <span title={EBITDA_TOOLTIP} className="cursor-help text-xs text-gray-400">ⓘ</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard label="Ingresos operativos" value={moneyLabel(data.cashFlowEbitda.ingresosOperativos, currency, rate)} />
          <KpiCard label="Gastos operativos" value={moneyLabel(data.cashFlowEbitda.gastosOperativos, currency, rate)} />
          <KpiCard label="EBITDA" value={moneyLabel(data.cashFlowEbitda.ebitda, currency, rate)} />
          <KpiCard label="Intereses" value={moneyLabel(data.cashFlowEbitda.intereses, currency, rate)} />
          <KpiCard label="Impuestos" value={moneyLabel(data.cashFlowEbitda.impuestos, currency, rate)} />
          <KpiCard
            label="Utilidad neta"
            value={moneyLabel(data.cashFlowEbitda.utilidadNeta, currency, rate)}
            tone={data.cashFlowEbitda.utilidadNeta < 0 ? 'warn' : 'default'}
          />
        </div>
      </div>
```

- [ ] **Step 3: Update the waterfall subtitle and `COST_STEPS`**

The `waterfall` array no longer contains `Gastos Operativos`/`EBITDA (aprox.)`/`Intereses`/`Impuestos`/`Utilidad Neta` steps (Task 3 removed them from the API response), so the chart subtitle and `COST_STEPS` set referencing them are now stale. Update the `ChartCard`'s `subtitle` prop (currently):

```tsx
        subtitle={`Bruto → Descuento → Neto → COGS → Utilidad bruta → Gastos Operativos → EBITDA (aprox.) → Intereses → Impuestos → Utilidad Neta${
          discountRate !== null ? ` — descuento promedio ${pct(discountRate)}` : ''
        }`}
```

to:

```tsx
        subtitle={`Bruto → Descuento → Neto → COGS → Utilidad bruta${
          discountRate !== null ? ` — descuento promedio ${pct(discountRate)}` : ''
        }`}
```

And simplify `COST_STEPS` (currently `new Set(['Descuento', 'COGS', 'Gastos Operativos', 'Intereses', 'Impuestos'])`) to only the steps that still appear in `waterfall`:

```tsx
const COST_STEPS = new Set(['Descuento', 'COGS']);
```

Update the comment above `COST_STEPS` (currently explaining why `Gastos Operativos`/`Intereses`/`Impuestos` needed the by-name set rather than a sign check) to reflect that those steps no longer live in `waterfall`:

```tsx
// Waterfall rendering: every step's own {amount, cumulative} pair is enough to
// derive its bar's floating range — no need to look at neighboring steps.
// `previousValue` is the level the bar starts from (cumulative minus this
// step's own delta); the bar then spans up to `cumulative`. For the anchor
// steps (Bruto, Neto, Utilidad Bruta) amount === cumulative, so previousValue
// is 0 and the bar is a full column from the axis; for the delta steps
// (Descuento, COGS) it floats between the two surrounding totals.
//
// COST_STEPS names every step that is a cost/reduction by definition
// (Descuento, COGS) so they always render red regardless of their computed
// sign — matters because a negative discount or COGS total is a real,
// currently-live case (see the EBITDA cash-flow card below for the
// Gastos-Operativos-can-net-negative case that used to live in this
// waterfall before the 2026-09-14 EBITDA rework moved it out).
const COST_STEPS = new Set(['Descuento', 'COGS']);
```

- [ ] **Step 4: Start the dev server and verify the tab renders correctly**

Run: `bun dev` (or the project's existing dev command), then navigate to `/analitica?tab=finanzas` in a browser.

Expected: sales waterfall chart renders with 5 steps (Bruto, Descuento, Neto, COGS, Utilidad Bruta); new "EBITDA (movimientos de caja)" card renders below the sales KPI row with 6 values (Ingresos operativos, Gastos operativos, EBITDA, Intereses, Impuestos, Utilidad neta); no console errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/analitica/tabs/tab-finanzas.tsx
git commit -m "feat: render EBITDA as its own card, decoupled from the sales waterfall"
```

---

## Task 5: E2E test update + DWH guide cleanup + final rename grep

**Files:**
- Modify: `e2e/analitica.spec.ts:84-144`
- Modify: `docs/DATA_WAREHOUSE_GUIDE.md`

**Interfaces:**
- Consumes: the rendered Finanzas tab from Task 4 (new EBITDA card, unchanged sales waterfall).

- [ ] **Step 1: Update the Finanzas E2E test**

In `e2e/analitica.spec.ts`, replace the test starting at line 84 (`'Finanzas tab shows the extended EBITDA waterfall and expense category drilldown'`) through its closing `});` (currently ending around line 144). Replace the whole test body with:

```typescript
  test('Finanzas tab shows the cash-flow EBITDA card and expense category drilldown', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=finanzas');

    // The EBITDA card is now a separate section from the sales waterfall
    // (see docs/superpowers/specs/2026-09-14-cash-movement-ebitda-design.md)
    // — its 6 KPI cards render as plain DOM <p> labels, no longer as
    // waterfall chart steps.
    await expect(adminPage.getByText('EBITDA (movimientos de caja)')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText('Ingresos operativos', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Gastos operativos', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('EBITDA', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Intereses', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Impuestos', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Utilidad neta', { exact: true })).toBeVisible();

    // The D&A caveat tooltip now lives on the card's info icon rather than
    // the old "EBITDA (aprox.)" KPI card's title attribute.
    await expect(adminPage.locator('[title*="depreciación"]').first()).toBeVisible();

    // Sales waterfall chart still renders (Bruto → Descuento → Neto → COGS →
    // Utilidad Bruta only — the EBITDA-onward steps moved out of it).
    const chart = adminPage.getByRole('application');
    await expect(chart).toBeVisible();
    const chartText = await chart.textContent();
    expect(chartText).toContain('Utilidad Bruta');
    expect(chartText).not.toContain('EBITDA');

    // Expense category breakdown table, below the EBITDA card — same
    // GroupedDrilldownTable "Desglosar por" + expand pattern as Vendedores.
    await adminPage.getByLabel('Desglosar por:').selectOption('producto');

    const expandButton = adminPage.locator('table tbody tr').first().locator('button[aria-label="Expandir"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();

    // Expanding a category row loads its concept-level breakdown
    // (breakdownBy=concepto&parentValue=<category>) — assert a second row
    // appears (the expanded concept sub-table), same assertion style as the
    // Vendedores product-breakdown test above.
    await expect(adminPage.locator('table tbody tr').nth(1)).toBeVisible();

    // Regression guard for the 2026-09-11 bug class: a breakdown row that
    // renders its metric via generic toLocaleString instead of the parent's
    // moneyLabel/currency conversion, so a currency toggle has no effect on
    // expanded rows. Capture the expanded concept row's amount in Bs., then
    // toggle to USD and assert it changed (both the parent category row and
    // the still-expanded concept row must convert).
    const parentAmountBs = await adminPage.locator('table tbody tr').first().locator('td').last().textContent();
    const conceptAmountBs = await adminPage.locator('table tbody tr').nth(1).locator('td').last().textContent();

    await adminPage.getByRole('button', { name: 'USD' }).click();

    await expect(adminPage.locator('table tbody tr').first().locator('td').last()).not.toHaveText(parentAmountBs ?? '');
    await expect(adminPage.locator('table tbody tr').nth(1).locator('td').last()).not.toHaveText(conceptAmountBs ?? '');
    await expect(adminPage.locator('table tbody tr').first().locator('td').last()).toContainText('$');
    await expect(adminPage.locator('table tbody tr').nth(1).locator('td').last()).toContainText('$');
  });
```

- [ ] **Step 2: Run the E2E test**

Run: `bunx playwright test e2e/analitica.spec.ts -g "Finanzas tab shows the cash-flow EBITDA card"`
Expected: PASS. (Per this project's standing convention — see memory `e2e_suite_production_build_fix` — this must run against a production build, `next build && next start`, not `next dev`, or the test can flake. Follow whatever `package.json` script this repo already uses for E2E, e.g. `bun run test:e2e`, rather than starting `next dev` manually.)

- [ ] **Step 3: Update `docs/DATA_WAREHOUSE_GUIDE.md`**

Update every `Fact_Expenses` reference to `Fact_CashMovements` (in the fact-table list, the "Check DWH Health" row-count query, and anywhere else it's mentioned — search the file for the exact string first).

Additionally, in the "Cost Data Gap ⚠️" section, add a line noting the EBITDA workaround now shipped:

```markdown
**EBITDA workaround (shipped 2026-09-14):** the Finanzas tab's EBITDA figure
is computed from bank/cash movements (`fact.Fact_CashMovements`,
`Ingresos Operativos − Gastos Operativos`) instead of `Fact_Sales`'s
COGS/GrossProfit columns — see
`docs/superpowers/specs/2026-09-14-cash-movement-ebitda-design.md`. The sales
waterfall's `Utilidad Bruta`/`Margen bruto` figures are still driven by
`Fact_Sales` and remain `0`/unusable for margin reporting until this gap is
closed upstream.
```

- [ ] **Step 4: Final grep for stragglers**

Run: `grep -rn "Fact_Expenses\|Load_Fact_Expenses" --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.md" . | grep -v node_modules | grep -v "docs/superpowers/plans/" | grep -v "docs/superpowers/specs/"`

Expected: no output. If anything appears, update it to `Fact_CashMovements`/`Load_Fact_CashMovements` before proceeding — per the spec (§6) and this plan's Global Constraints, no reference may be left behind.

- [ ] **Step 5: Commit**

```bash
git add e2e/analitica.spec.ts docs/DATA_WAREHOUSE_GUIDE.md
git commit -m "test: update Finanzas E2E for the cash-flow EBITDA card; document the workaround"
```
