# Customer Legal Entity Grouping & Generic Drilldown Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group Profit Plus customer records that belong to the same legal entity (a retail chain's many stores) into one rollup dimension so analytics can rank/segment at entity grain, and build a reusable "group by / break down by" pivot mechanism so Ventas, Devoluciones, Vendedores, Clientes, and CxC can all cross-cut by Cliente (Entidad or Tienda), Producto, and Vendedor.

**Architecture:** New `dim.Dim_LegalEntity` dimension + `Dim_Customer.MatrizCode`/`LegalEntityKey` columns, resolved via Profit's native `saCliente.matriz` parent-child link (not RIF text matching). A generic `Dimension` model in `app/api/dwh/lib/query-builder.ts` centralizes the SQL fragment (join/group/label) each pivot dimension needs; each API route keeps its own fact table, metrics, and filters. One shared `<GroupedDrilldownTable>` React component (two selects + lazy-expand rows) is reused across the 5 tabs.

**Tech Stack:** Next.js API routes (`app/api/dwh/*`), `mssql` driver, SQL Server (DWH_AlimentosNY star schema), React/TypeScript client components, Recharts, `bun:test` for ETL integration tests, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-09-10-customer-legal-entity-grouping-design.md`

## Global Constraints

- All new/changed SQL migrations must be idempotent (`IF NOT EXISTS` / `CREATE OR ALTER`) per `dwh-migrations/README.md`.
- `Dim_Customer` is SCD Type 2 — never `UPDATE` a current row's attribute columns in place; the existing pattern closes out (`IsCurrent = 0`) and inserts a new version. `MatrizCode` must be added to `Load_Dim_Customer`'s existing change-detection list, `INSERT` column list, and `SELECT` list, following that exact pattern.
- No changes to any `Fact_*` table — all entity-grain logic joins through `Dim_Customer.LegalEntityKey → Dim_LegalEntity`.
- `Dim_LegalEntity` is Type 1 (overwrite), unlike `Dim_Customer`.
- Every customer row must resolve to exactly one `LegalEntityKey` — never null (see spec §3.2 "Edge case").
- New migration file: `dwh-migrations/0014_dim_legal_entity.sql`.
- Do not repurpose `Dim_Customer.LegalEntityRIF` — it stays as-is, unused, per spec §2.
- API routes keep today's session/DWH-access guard pattern verbatim (`getSessionFromRequest` → `hasDwhAccess` → 401/403) — copy from any existing route, don't invent a new auth check.
- All new SQL in API routes reads from `dwh`/`dim`/`fact` schemas only — no `COLLATE`/`RTRIM` gymnastics (that's already handled at ETL load time), per the existing routes' header comments.

---

## Task 1: Add `MatrizCode` to `Dim_Customer` and `Dim_LegalEntity` dimension + `Load_Dim_LegalEntity` procedure

**Files:**
- Create: `dwh-migrations/0014_dim_legal_entity.sql`
- Modify: `dwh-migrations/0005_dim_customer.sql` — NO. Existing numbered migrations are never edited after being committed (each is a historical, already-applied step against real databases). Instead, `0014_dim_legal_entity.sql` adds the `MatrizCode` column via `ALTER TABLE` and replaces `Load_Dim_Customer` via `CREATE OR ALTER PROCEDURE` (which is allowed — procedures are always replaced in place, only table `CREATE`s are one-shot).
- Test: `scripts/dwh/__tests__/dim-legal-entity.test.ts`

**Interfaces:**
- Consumes: existing `dim.Dim_Customer` table (`dwh-migrations/0005_dim_customer.sql`), existing `dwh.Load_Dim_Customer` procedure, `runDwhMigrations`/`dwhDatabaseName` from `scripts/migrate-dwh.ts`.
- Produces: `dim.Dim_LegalEntity` table (`LegalEntityKey`, `RootCustomerCode`, `LegalEntityName`, `StoreCount`, `LoadedAtUtc`), `dim.Dim_Customer.MatrizCode` and `dim.Dim_Customer.LegalEntityKey` columns, `dwh.Load_Dim_LegalEntity` procedure (callable via `EXEC dwh.Load_Dim_LegalEntity`) — Task 2 and later tasks' SQL queries join on `Dim_Customer.LegalEntityKey` and `Dim_LegalEntity.LegalEntityName`.

- [ ] **Step 1: Write the migration file**

Create `dwh-migrations/0014_dim_legal_entity.sql`:

```sql
-- New columns on Dim_Customer: raw matriz link from source, and the
-- resolved entity FK populated by Load_Dim_LegalEntity below.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Customer') AND name = 'MatrizCode')
    ALTER TABLE dim.Dim_Customer ADD MatrizCode char(16) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Customer') AND name = 'LegalEntityKey')
    ALTER TABLE dim.Dim_Customer ADD LegalEntityKey int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_LegalEntity' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_LegalEntity (
        LegalEntityKey   int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RootCustomerCode char(16)      NOT NULL,
        LegalEntityName  varchar(120)  NULL,
        StoreCount       int           NOT NULL,
        LoadedAtUtc      datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_Dim_LegalEntity_RootCustomerCode ON dim.Dim_LegalEntity (RootCustomerCode);
END
GO

CREATE INDEX IX_Dim_Customer_LegalEntityKey ON dim.Dim_Customer (LegalEntityKey);
GO

-- Load_Dim_Customer gains MatrizCode in its change-detection, INSERT, and
-- SELECT lists, following its existing SCD Type 2 pattern exactly (close
-- out + insert new version, never UPDATE an attribute in place).
CREATE OR ALTER PROCEDURE dwh.Load_Dim_Customer
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCliente');
    DECLARE @NewWatermark binary(8);
    DECLARE @Now datetime2(3) = SYSUTCDATETIME();
    DECLARE @RowCount int;

    UPDATE tgt
    SET tgt.ValidTo = @Now, tgt.IsCurrent = 0
    FROM dim.Dim_Customer tgt
    INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
    WHERE tgt.IsCurrent = 1
      AND src.validador > @Watermark
      AND (
            ISNULL(tgt.CustomerName, '') <> ISNULL(src.cli_des, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.TaxId, '') <> ISNULL(src.rif, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.LegalEntityRIF, '') <> ISNULL(src.rif, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.IsSpecialTaxpayer, 0) <> ISNULL(src.contrib, 0)
         OR ISNULL(tgt.CreditLimit, -1) <> ISNULL(src.mont_cre, -1)
         OR ISNULL(RTRIM(tgt.CreditLimitCurrencyCode), '') <> ISNULL(RTRIM(src.co_mone), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.ZoneCode), '') <> ISNULL(RTRIM(src.co_zon), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.SegmentCode), '') <> ISNULL(RTRIM(src.co_seg), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.DefaultSalesRepCode), '') <> ISNULL(RTRIM(src.co_ven), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.IsLegalEntity, 0) <> ISNULL(src.juridico, 0)
         OR ISNULL(tgt.IsInactive, 0) <> ISNULL(src.inactivo, 0)
         OR ISNULL(RTRIM(tgt.MatrizCode), '') <> ISNULL(RTRIM(src.matriz), '') COLLATE SQL_Latin1_General_CP1_CI_AS
      );

    INSERT INTO dim.Dim_Customer (
        CustomerCode, CustomerName, TaxId, LegalEntityRIF, IsSpecialTaxpayer, CreditLimit, CreditLimitCurrencyCode,
        ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity, IsInactive, MatrizCode, ValidFrom, ValidTo, IsCurrent
    )
    SELECT
        RTRIM(src.co_cli), src.cli_des, src.rif, src.rif, ISNULL(src.contrib, 0), src.mont_cre, src.co_mone,
        src.co_zon, src.co_seg, src.co_ven, ISNULL(src.juridico, 0), ISNULL(src.inactivo, 0),
        NULLIF(RTRIM(src.matriz), ''), @Now, NULL, 1
    FROM Ncake_a.dbo.saCliente src
    WHERE src.validador > @Watermark
      AND NOT EXISTS (
          SELECT 1 FROM dim.Dim_Customer tgt
          WHERE RTRIM(tgt.CustomerCode) = RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.IsCurrent = 1
      );

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saCliente;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCliente';
END
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_LegalEntity
AS
BEGIN
    SET NOCOUNT ON;

    -- Step 1: upsert one Dim_LegalEntity row per root (parent-with-children, or standalone).
    -- A row is a "root" if it has no MatrizCode, or its MatrizCode doesn't
    -- resolve to any current customer row (orphaned/bad data - treated as
    -- its own root rather than dropped).
    MERGE dim.Dim_LegalEntity AS tgt
    USING (
        SELECT
            root.CustomerCode AS RootCustomerCode,
            root.CustomerName AS LegalEntityName,
            1 + ISNULL(child_counts.ChildCount, 0) AS StoreCount
        FROM dim.Dim_Customer root
        LEFT JOIN (
            SELECT LTRIM(RTRIM(c.MatrizCode)) AS ParentCode, COUNT(*) AS ChildCount
            FROM dim.Dim_Customer c
            WHERE c.IsCurrent = 1 AND c.MatrizCode IS NOT NULL AND LTRIM(RTRIM(c.MatrizCode)) <> ''
            GROUP BY LTRIM(RTRIM(c.MatrizCode))
        ) child_counts ON child_counts.ParentCode = root.CustomerCode
        WHERE root.IsCurrent = 1
          AND (
                root.MatrizCode IS NULL OR LTRIM(RTRIM(root.MatrizCode)) = ''
             OR NOT EXISTS (
                    SELECT 1 FROM dim.Dim_Customer p
                    WHERE p.IsCurrent = 1 AND p.CustomerCode = LTRIM(RTRIM(root.MatrizCode))
                )
          )
    ) AS src
    ON tgt.RootCustomerCode = src.RootCustomerCode
    WHEN MATCHED THEN UPDATE SET tgt.LegalEntityName = src.LegalEntityName, tgt.StoreCount = src.StoreCount
    WHEN NOT MATCHED THEN INSERT (RootCustomerCode, LegalEntityName, StoreCount, LoadedAtUtc)
        VALUES (src.RootCustomerCode, src.LegalEntityName, src.StoreCount, SYSUTCDATETIME());

    -- Step 2: backfill Dim_Customer.LegalEntityKey for every current row (root or child).
    -- Mirrors step 1's root-resolution exactly.
    UPDATE c
    SET c.LegalEntityKey = le.LegalEntityKey
    FROM dim.Dim_Customer c
    JOIN dim.Dim_LegalEntity le
      ON le.RootCustomerCode = CASE
           WHEN LTRIM(RTRIM(ISNULL(c.MatrizCode, ''))) <> ''
                AND EXISTS (
                    SELECT 1 FROM dim.Dim_Customer p
                    WHERE p.IsCurrent = 1 AND p.CustomerCode = LTRIM(RTRIM(c.MatrizCode))
                )
           THEN LTRIM(RTRIM(c.MatrizCode))
           ELSE c.CustomerCode
         END
    WHERE c.IsCurrent = 1 AND (c.LegalEntityKey IS NULL OR c.LegalEntityKey <> le.LegalEntityKey);
END
```

- [ ] **Step 2: Run the migration against the local dev DWH to verify it applies cleanly**

Run: `bun run migrate:dwh`
Expected: output confirms migration `0014_dim_legal_entity.sql` applied (check console output lists it), exits 0.

- [ ] **Step 3: Write the failing integration test**

Create `scripts/dwh/__tests__/dim-legal-entity.test.ts`:

```ts
// scripts/dwh/__tests__/dim-legal-entity.test.ts
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

describe('Dim_LegalEntity', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_LegalEntity');
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

  test('every current Dim_Customer row has a non-null LegalEntityKey', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dim.Dim_Customer WHERE IsCurrent = 1 AND LegalEntityKey IS NULL
    `);
    expect(result.recordset[0].total).toBe(0);
  });

  test('a known multi-store chain (matriz populated in ERP) rolls up to one entity with correct StoreCount', async () => {
    // Find any parent code in the live ERP data that has at least 2 children
    // via matriz (verified live during design: Gama/Farmatodo/Plaza/Plansuárez
    // all qualify in the dev database).
    const chains = await erpPool.request().query(`
      SELECT LTRIM(RTRIM(matriz)) AS parentCode, COUNT(*) AS childCount
      FROM saCliente
      WHERE matriz IS NOT NULL AND LTRIM(RTRIM(matriz)) <> ''
      GROUP BY LTRIM(RTRIM(matriz))
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
    `);
    expect(chains.recordset.length).toBeGreaterThan(0);
    const chain = chains.recordset[0];

    const entity = await pool.request()
      .input('rootCode', sql.Char(16), chain.parentCode)
      .query(`
        SELECT le.LegalEntityKey, le.StoreCount
        FROM dim.Dim_LegalEntity le
        WHERE RTRIM(le.RootCustomerCode) = @rootCode
      `);
    expect(entity.recordset.length).toBe(1);
    // StoreCount = parent (1) + all children
    expect(entity.recordset[0].StoreCount).toBe(1 + Number(chain.childCount));

    // All child rows resolve to that same LegalEntityKey
    const childrenResolved = await pool.request()
      .input('legalEntityKey', entity.recordset[0].LegalEntityKey)
      .input('rootCode', sql.Char(16), chain.parentCode)
      .query(`
        SELECT COUNT(*) AS total
        FROM dim.Dim_Customer c
        WHERE c.IsCurrent = 1 AND RTRIM(c.MatrizCode) = @rootCode AND c.LegalEntityKey = @legalEntityKey
      `);
    expect(childrenResolved.recordset[0].total).toBe(Number(chain.childCount));
  });

  test('a standalone customer (no matriz, not referenced as matriz) is its own entity of size 1', async () => {
    const standalone = await erpPool.request().query(`
      SELECT TOP 1 LTRIM(RTRIM(co_cli)) AS code
      FROM saCliente s
      WHERE (s.matriz IS NULL OR LTRIM(RTRIM(s.matriz)) = '')
        AND NOT EXISTS (
          SELECT 1 FROM saCliente child
          WHERE LTRIM(RTRIM(child.matriz)) = LTRIM(RTRIM(s.co_cli))
        )
    `);
    expect(standalone.recordset.length).toBe(1);
    const code = standalone.recordset[0].code;

    const entity = await pool.request()
      .input('code', sql.Char(16), code)
      .query(`
        SELECT le.StoreCount
        FROM dim.Dim_Customer c
        JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
        WHERE c.IsCurrent = 1 AND RTRIM(c.CustomerCode) = @code
      `);
    expect(entity.recordset.length).toBe(1);
    expect(entity.recordset[0].StoreCount).toBe(1);
  });

  test('re-running the load is idempotent', async () => {
    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_LegalEntity`);

    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_LegalEntity`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails before the migration exists (sanity check), then passes**

Run: `bun test scripts/dwh/__tests__/dim-legal-entity.test.ts`
Expected: PASS (the migration was already written in Step 1) — all 4 tests green. If any fail, fix the migration SQL, not the test (the test encodes the spec's stated invariants).

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0014_dim_legal_entity.sql scripts/dwh/__tests__/dim-legal-entity.test.ts
git commit -m "feat: add Dim_LegalEntity and matriz-based customer entity resolution"
```

---

## Task 2: Add `Load_Dim_LegalEntity` to the incremental load script and DWH guide

**Files:**
- Modify: `scripts/dwh-incremental-load.ts`
- Modify: `docs/DATA_WAREHOUSE_GUIDE.md`

**Interfaces:**
- Consumes: `dwh.Load_Dim_LegalEntity` (Task 1).
- Produces: nothing new consumed by later tasks — this is a rollout/ops task, no code dependency.

- [ ] **Step 1: Add the new EXEC line to the incremental load batch**

In `scripts/dwh-incremental-load.ts`, edit the `INCREMENTAL_LOAD` template string:

```ts
const INCREMENTAL_LOAD = `
EXEC dwh.Load_Dim_Currency;
EXEC dwh.Load_Fact_ExchangeRate;
EXEC dwh.Load_Dim_Customer;
EXEC dwh.Load_Dim_LegalEntity;
EXEC dwh.Load_Dim_Product;
EXEC dwh.Load_Dim_SalesRep;
EXEC dwh.Load_Dim_Warehouse;
EXEC dwh.Load_Fact_Sales;
EXEC dwh.Load_Fact_Returns;
EXEC dwh.Load_Fact_Collections;
`;
```

(`Load_Dim_LegalEntity` runs immediately after `Load_Dim_Customer`, since it reads `Dim_Customer.MatrizCode` populated by that call.)

- [ ] **Step 2: Update the DWH guide's documented run order**

In `docs/DATA_WAREHOUSE_GUIDE.md`, find every code block listing the manual load order (both "Path 1: Full Initial Load" and "Path 2: Incremental Refresh" sections shown in the guide) and add `EXEC dwh.Load_Dim_LegalEntity;` immediately after each `EXEC dwh.Load_Dim_Customer;` line, matching the same placement as Step 1.

- [ ] **Step 3: Verify the updated script runs end-to-end against the local dev DWH**

Run: `bun run scripts/dwh-incremental-load.ts`
Expected: exits 0, prints "Incremental Load ran successfully".

- [ ] **Step 4: Commit**

```bash
git add scripts/dwh-incremental-load.ts docs/DATA_WAREHOUSE_GUIDE.md
git commit -m "chore: wire Load_Dim_LegalEntity into incremental load and docs"
```

---

## Task 3: Generic pivot `Dimension` model in the query-builder

**Files:**
- Modify: `app/api/dwh/lib/query-builder.ts`
- Modify: `app/(app)/analitica/types.ts`
- Test: `app/api/dwh/lib/__tests__/query-builder.test.ts`

**Interfaces:**
- Consumes: nothing new (extends the existing file; `getUsdRate`/`buildDateWhereClause` stay as-is).
- Produces:
  - `type Dimension = 'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor'`
  - `interface DimensionSpec { joinClause: string; groupByColumn: string; labelExpr: string; valueExpr: string }`
  - `function getDimensionSpec(dimension: Dimension): DimensionSpec`
  - `function isDimension(value: string | null): value is Dimension`
  - These are consumed by Tasks 5-9 (the 5 route updates) to build their `GROUP BY`/join SQL fragments.

- [ ] **Step 1: Write the failing test**

Create `app/api/dwh/lib/__tests__/query-builder.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { getDimensionSpec, isDimension } from '../query-builder';

describe('getDimensionSpec', () => {
  test('cliente_entidad groups and labels by legal entity', () => {
    const spec = getDimensionSpec('cliente_entidad');
    expect(spec.joinClause).toContain('Dim_LegalEntity');
    expect(spec.groupByColumn).toContain('LegalEntityKey');
    expect(spec.labelExpr).toContain('LegalEntityName');
  });

  test('cliente_tienda groups and labels by individual customer/store', () => {
    const spec = getDimensionSpec('cliente_tienda');
    expect(spec.joinClause).toContain('Dim_Customer');
    expect(spec.groupByColumn).toContain('CustomerKey');
    expect(spec.labelExpr).toContain('CustomerName');
  });

  test('producto groups and labels by product', () => {
    const spec = getDimensionSpec('producto');
    expect(spec.joinClause).toContain('Dim_Product');
    expect(spec.groupByColumn).toContain('ProductKey');
  });

  test('vendedor groups and labels by sales rep', () => {
    const spec = getDimensionSpec('vendedor');
    expect(spec.joinClause).toContain('Dim_SalesRep');
    expect(spec.groupByColumn).toContain('SalesRepKey');
  });

  test('correlate produces distinct aliases on each side for cliente_entidad', () => {
    const spec = getDimensionSpec('cliente_entidad');
    const { innerJoin, condition } = spec.correlate('fr', 'fs2');
    expect(innerJoin).toContain('fs2_c');
    expect(condition).not.toBe('le.LegalEntityKey = le.LegalEntityKey');
    expect(condition).toContain('fs2_c.LegalEntityKey');
    expect(condition).toContain('fr.CustomerKey');
  });

  test('correlate produces a direct key match for cliente_tienda', () => {
    const spec = getDimensionSpec('cliente_tienda');
    const { condition } = spec.correlate('fr', 'fs2');
    expect(condition).toBe('fs2.CustomerKey = fr.CustomerKey');
  });
});

describe('isDimension', () => {
  test('accepts valid dimension values', () => {
    expect(isDimension('cliente_entidad')).toBe(true);
    expect(isDimension('cliente_tienda')).toBe(true);
    expect(isDimension('producto')).toBe(true);
    expect(isDimension('vendedor')).toBe(true);
  });

  test('rejects invalid or null values', () => {
    expect(isDimension('mes')).toBe(false);
    expect(isDimension(null)).toBe(false);
    expect(isDimension('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/api/dwh/lib/__tests__/query-builder.test.ts`
Expected: FAIL with "getDimensionSpec is not a function" (or similar import error).

- [ ] **Step 3: Implement `Dimension`/`DimensionSpec`/`getDimensionSpec`/`isDimension`**

Add to `app/api/dwh/lib/query-builder.ts` (below the existing `buildDateWhereClause`):

```ts
export type Dimension = 'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor';

export interface DimensionSpec {
  /** SQL join fragment, assumes the base fact table is aliased `f`. */
  joinClause: string;
  /** Column(s) to GROUP BY (fully qualified, using this spec's own aliases). */
  groupByColumn: string;
  /** Display label expression, safe to alias as GroupLabel. */
  labelExpr: string;
  /** Value to return as the row's identifier, used as `parentValue` on drill-in. */
  valueExpr: string;
  /**
   * A correlation condition for use in a scalar subquery that needs to
   * re-aggregate a DIFFERENT fact table (e.g. Fact_Sales) for the same
   * dimension value as the outer query's row (built against Fact_Returns,
   * or Fact_AR_Snapshot, etc). `outerAlias`/`innerAlias` are the fact-table
   * aliases on each side (e.g. 'fr' outer, 'fs2' inner) — the function
   * builds its own inner join with a distinct alias so it never collides
   * with the outer query's join.
   */
  correlate: (outerAlias: string, innerAlias: string) => { innerJoin: string; condition: string };
}

const DIMENSION_SPECS: Record<Dimension, DimensionSpec> = {
  cliente_entidad: {
    joinClause: 'JOIN dim.Dim_Customer c ON c.CustomerKey = f.CustomerKey JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey',
    groupByColumn: 'le.LegalEntityKey, le.LegalEntityName',
    labelExpr: 'le.LegalEntityName',
    valueExpr: 'CAST(le.LegalEntityKey AS varchar(20))',
    correlate: (outerAlias, innerAlias) => ({
      innerJoin: `JOIN dim.Dim_Customer ${innerAlias}_c ON ${innerAlias}_c.CustomerKey = ${innerAlias}.CustomerKey`,
      condition: `${innerAlias}_c.LegalEntityKey = (SELECT c3.LegalEntityKey FROM dim.Dim_Customer c3 WHERE c3.CustomerKey = ${outerAlias}.CustomerKey)`,
    }),
  },
  cliente_tienda: {
    joinClause: 'JOIN dim.Dim_Customer c ON c.CustomerKey = f.CustomerKey',
    groupByColumn: 'c.CustomerKey, ISNULL(c.CustomerName, c.CustomerCode)',
    labelExpr: 'ISNULL(c.CustomerName, c.CustomerCode)',
    valueExpr: 'CAST(c.CustomerKey AS varchar(20))',
    correlate: (outerAlias, innerAlias) => ({
      innerJoin: '',
      condition: `${innerAlias}.CustomerKey = ${outerAlias}.CustomerKey`,
    }),
  },
  producto: {
    joinClause: 'JOIN dim.Dim_Product p ON p.ProductKey = f.ProductKey',
    groupByColumn: 'p.ProductKey, ISNULL(p.ProductName, p.ProductCode)',
    labelExpr: 'ISNULL(p.ProductName, p.ProductCode)',
    valueExpr: 'CAST(p.ProductKey AS varchar(20))',
    correlate: (outerAlias, innerAlias) => ({
      innerJoin: '',
      condition: `${innerAlias}.ProductKey = ${outerAlias}.ProductKey`,
    }),
  },
  vendedor: {
    joinClause: 'JOIN dim.Dim_SalesRep r ON r.SalesRepKey = f.SalesRepKey',
    groupByColumn: 'r.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)',
    labelExpr: 'ISNULL(r.SalesRepName, r.SalesRepCode)',
    valueExpr: 'CAST(r.SalesRepKey AS varchar(20))',
    correlate: (outerAlias, innerAlias) => ({
      innerJoin: '',
      condition: `${innerAlias}.SalesRepKey = ${outerAlias}.SalesRepKey`,
    }),
  },
};

export function getDimensionSpec(dimension: Dimension): DimensionSpec {
  return DIMENSION_SPECS[dimension];
}

export function isDimension(value: string | null): value is Dimension {
  return value === 'cliente_entidad' || value === 'cliente_tienda' || value === 'producto' || value === 'vendedor';
}
```

**Why `correlate` exists**: several routes need a scalar subquery against a *different* fact table than the one being grouped (e.g. Devoluciones groups `Fact_Returns` but needs each row's matching `Fact_Sales` total). Naively reusing `joinClause`/`valueExpr` inside such a subquery is unsound — both the outer and inner query would resolve to the same fixed alias (`le`, `c`, `p`, `r`), so a naive `WHERE innerValueExpr = outerValueExpr` silently becomes always-true (`le.LegalEntityKey = le.LegalEntityKey`) and sums every row instead of just the correlated one. `correlate` sidesteps this by taking explicit, distinct aliases for each side and returning a real join + condition — every consuming task below uses `spec.correlate(...)`, never hand-written alias-substitution string surgery.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/api/dwh/lib/__tests__/query-builder.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Add `breakdownBy`/`parentValue` to the shared analytics types**

In `app/(app)/analitica/types.ts`, add near the top (after `DrillContext`):

```ts
export type PivotDimension = 'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor';

export interface BreakdownRow {
  label: string;
  value: string;
  [metricKey: string]: string | number | null;
}
```

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck` (or `bunx tsc --noEmit` if no dedicated script — check `package.json` scripts first)
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/dwh/lib/query-builder.ts app/api/dwh/lib/__tests__/query-builder.test.ts app/\(app\)/analitica/types.ts
git commit -m "feat: add generic pivot Dimension model to dwh query-builder"
```

---

## Task 4: Shared `<GroupedDrilldownTable>` frontend component

**Files:**
- Create: `app/(app)/analitica/components/grouped-drilldown-table.tsx`
- Test: manual verification only in this task (component is exercised end-to-end once wired into a tab in Task 5) — no isolated unit test harness exists for React components in this codebase (checked: no `@testing-library/react` in `package.json`); defer behavioral verification to Task 5's tab integration and Task 10's E2E.

**Interfaces:**
- Consumes: `PivotDimension`, `BreakdownRow` (Task 3).
- Produces:

```ts
export interface DrilldownColumn<TRow> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  format: (row: TRow) => string;
}

export interface GroupedDrilldownTableProps<TRow extends { label: string; value: string }> {
  rows: TRow[];
  columns: DrilldownColumn<TRow>[];
  groupByOptions: { value: PivotDimension; label: string }[];
  groupBy: PivotDimension;
  onGroupByChange: (next: PivotDimension) => void;
  breakdownByOptions?: { value: PivotDimension; label: string }[];
  breakdownBy?: PivotDimension | null;
  onBreakdownByChange?: (next: PivotDimension | null) => void;
  onFetchBreakdown?: (parentValue: string, breakdownBy: PivotDimension) => Promise<BreakdownRow[]>;
}
```

Later tasks (5-9) import `GroupedDrilldownTable` and pass their own row/column shapes.

- [ ] **Step 1: Implement the component**

Create `app/(app)/analitica/components/grouped-drilldown-table.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { PivotDimension, BreakdownRow } from '../types';

export interface DrilldownColumn<TRow> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  format: (row: TRow) => string;
}

export interface GroupedDrilldownTableProps<TRow extends { label: string; value: string }> {
  rows: TRow[];
  columns: DrilldownColumn<TRow>[];
  groupByOptions: { value: PivotDimension; label: string }[];
  groupBy: PivotDimension;
  onGroupByChange: (next: PivotDimension) => void;
  breakdownByOptions?: { value: PivotDimension; label: string }[];
  breakdownBy?: PivotDimension | null;
  onBreakdownByChange?: (next: PivotDimension | null) => void;
  onFetchBreakdown?: (parentValue: string, breakdownBy: PivotDimension) => Promise<BreakdownRow[]>;
}

export default function GroupedDrilldownTable<TRow extends { label: string; value: string }>({
  rows,
  columns,
  groupByOptions,
  groupBy,
  onGroupByChange,
  breakdownByOptions,
  breakdownBy,
  onBreakdownByChange,
  onFetchBreakdown,
}: GroupedDrilldownTableProps<TRow>) {
  const [expandedValue, setExpandedValue] = useState<string | null>(null);
  const [breakdownRows, setBreakdownRows] = useState<BreakdownRow[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  async function handleToggleExpand(value: string) {
    if (expandedValue === value) {
      setExpandedValue(null);
      return;
    }
    setExpandedValue(value);
    if (!breakdownBy || !onFetchBreakdown) return;
    setBreakdownLoading(true);
    try {
      const result = await onFetchBreakdown(value, breakdownBy);
      setBreakdownRows(result);
    } finally {
      setBreakdownLoading(false);
    }
  }

  const canExpand = Boolean(breakdownBy && onFetchBreakdown);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Agrupar por:
          <select
            value={groupBy}
            onChange={e => onGroupByChange(e.target.value as PivotDimension)}
            className="border border-gray-200 rounded px-2 py-1 text-sm"
          >
            {groupByOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        {breakdownByOptions && onBreakdownByChange && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Desglosar por:
            <select
              value={breakdownBy ?? ''}
              onChange={e => onBreakdownByChange(e.target.value ? (e.target.value as PivotDimension) : null)}
              className="border border-gray-200 rounded px-2 py-1 text-sm"
            >
              <option value="">Sin desglose</option>
              {breakdownByOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {canExpand && <th className="w-8" />}
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Nombre</th>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase ${col.align === 'left' ? 'text-left' : 'text-right'}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (canExpand ? 2 : 1)} className="px-3 py-6 text-center text-gray-400">
                  Sin datos disponibles todavía.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <>
                  <tr key={row.value} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    {canExpand && (
                      <td className="px-2 text-center">
                        <button
                          onClick={() => handleToggleExpand(row.value)}
                          className="text-gray-400 hover:text-blue-600"
                          aria-label={expandedValue === row.value ? 'Contraer' : 'Expandir'}
                        >
                          {expandedValue === row.value ? '▾' : '▸'}
                        </button>
                      </td>
                    )}
                    <td className="px-3 py-2 text-gray-800">{row.label}</td>
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={`px-3 py-2 ${col.align === 'left' ? 'text-left text-gray-600' : 'text-right font-medium text-gray-900'}`}
                      >
                        {col.format(row)}
                      </td>
                    ))}
                  </tr>
                  {expandedValue === row.value && canExpand && (
                    <tr key={`${row.value}-breakdown`}>
                      <td colSpan={columns.length + 2} className="px-3 py-2 bg-gray-50/50">
                        {breakdownLoading ? (
                          <div className="text-xs text-gray-400 py-2">Cargando desglose…</div>
                        ) : breakdownRows.length === 0 ? (
                          <div className="text-xs text-gray-400 py-2">Sin desglose disponible.</div>
                        ) : (
                          <table className="min-w-full text-xs ml-6">
                            <tbody className="divide-y divide-gray-100">
                              {breakdownRows.map(br => (
                                <tr key={br.value}>
                                  <td className="px-3 py-1.5 text-gray-600">{br.label}</td>
                                  {Object.keys(br)
                                    .filter(k => k !== 'label' && k !== 'value')
                                    .map(metricKey => (
                                      <td key={metricKey} className="px-3 py-1.5 text-right text-gray-800">
                                        {typeof br[metricKey] === 'number' ? (br[metricKey] as number).toLocaleString('es-VE') : String(br[metricKey] ?? '—')}
                                      </td>
                                    ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck` (or `bunx tsc --noEmit`)
Expected: no new errors. (React fragment keys with array index inside `.map` returning `<>...</>` — confirm no key-warning-as-error config; if the project's linter flags the bare fragment, wrap with `<React.Fragment key={row.value}>` instead of the shorthand.)

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/analitica/components/grouped-drilldown-table.tsx
git commit -m "feat: add shared GroupedDrilldownTable component"
```

---

## Task 5: Ventas — entity/store grouping, breakdown, and label-clipping fix

**Files:**
- Modify: `app/api/dwh/ventas/route.ts`
- Modify: `app/(app)/analitica/tabs/tab-ventas.tsx`
- Test: `app/api/dwh/ventas/__tests__/route.test.ts` (new — first API-level test for this route; check no existing test file first)

**Interfaces:**
- Consumes: `getDimensionSpec`, `isDimension`, `Dimension` (Task 3); `GroupedDrilldownTable`, `DrilldownColumn` (Task 4).
- Produces: nothing new consumed by later tasks (this is a leaf/consumer task) — Tasks 6-9 follow the identical pattern independently.

- [ ] **Step 1: Check for an existing test file for this route**

Run: `ls app/api/dwh/ventas/__tests__/ 2>&1`
Expected: "No such file or directory" (confirms this is new, not an oversight).

- [ ] **Step 2: Write the failing test**

Create `app/api/dwh/ventas/__tests__/route.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// This route requires a valid session cookie to pass the auth gate; without
// one it returns 401 before touching the DB. This test only verifies the
// route file exports GET and rejects unauthenticated requests — full
// data-shape verification happens via the E2E suite (Task 10), which runs
// against a real logged-in session and a real DWH.
describe('GET /api/dwh/ventas', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/ventas?groupBy=cliente_entidad');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test app/api/dwh/ventas/__tests__/route.test.ts`
Expected: currently PASSES already (401 gate exists) — this step confirms the test harness itself works before we change route.ts; if it fails to even import, fix the import path first.

- [ ] **Step 4: Update `clienteQuery` to use the generic dimension model**

In `app/api/dwh/ventas/route.ts`, replace the hardcoded `clienteQuery` function and its `GroupBy` handling:

```ts
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimension, type Dimension } from '@/app/api/dwh/lib/query-builder';
```

Replace the `clienteQuery` function, using `spec.correlate(...)` (Task 3) for the `Fact_Returns` scalar subquery, exactly as Tasks 6 and 7 do — this preserves the original's returns-rate column at every grain, entity included:

```ts
function clienteQuery(dimension: Dimension, dateWhere: string, returnsDateWhere: string, monthFilter: string, salesRepFilter: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fr2');
  return `
    SELECT TOP 15
      ${spec.valueExpr} AS GroupValue,
      ${spec.labelExpr} AS GroupLabel,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr2.NetAmount), 0)
         FROM fact.Fact_Returns fr2
         ${innerJoin}
         WHERE fr2.IsVoided = 0 ${returnsDateWhere} AND ${condition}
      ) AS ReturnsNet
    FROM fact.Fact_Sales fs
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${monthFilter} ${salesRepFilter}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesNet DESC
  `;
}
```

Update the call site in `GET` to pass `returnsDateWhere` (already computed earlier in the function as `buildDateWhereClause(dateRange, 'fr')`) as the new second argument.

Update the `groupBy` parsing in `GET`:

```ts
  const groupByParam = searchParams.get('groupBy') ?? 'mes';
  const groupBy: GroupBy = groupByParam === 'cliente' || groupByParam === 'linea' ? groupByParam : 'mes';
  const clienteDimensionParam = searchParams.get('clienteDimension');
  const clienteDimension: Dimension = isDimension(clienteDimensionParam) ? clienteDimensionParam : 'cliente_entidad';
  const breakdownByParam = searchParams.get('breakdownBy');
  const breakdownBy: Dimension | null = isDimension(breakdownByParam) ? breakdownByParam : null;
  const parentValue = searchParams.get('parentValue');
```

Update the `if (groupBy === 'cliente')` branch's call site to pass the new `returnsDateWhere` and `clienteDimension` arguments:

```ts
      const result = await req.query(clienteQuery(clienteDimension, salesDateWhere, returnsDateWhere, monthFilter, salesRepFilter));
```

Then add a new branch before the final `return NextResponse.json(response)` that handles the breakdown-fetch case. The breakdown filters `Fact_Sales` down to rows belonging to the expanded parent row — the parent row's own dimension is `clienteDimension` (whichever the user had selected, entity or store grain), which is *not necessarily* the same as `breakdownBy` (the new dimension being broken down into, e.g. `producto`). Filter using `clienteDimension`'s own `valueExpr`/`joinClause`, and group/label using `breakdownBy`'s:

```ts
    if (breakdownBy && parentValue) {
      const breakdownSpec = getDimensionSpec(breakdownBy);
      const parentSpec = getDimensionSpec(clienteDimension);
      const req = pool.request();
      req.input('parentValue', parentValue);
      const result = await req.query(`
        SELECT TOP 15 ${breakdownSpec.valueExpr} AS GroupValue, ${breakdownSpec.labelExpr} AS GroupLabel, SUM(fs.NetAmount) AS SalesNet
        FROM fact.Fact_Sales fs
        ${breakdownSpec.joinClause.replace(/\bf\b/g, 'fs')}
        ${parentSpec.joinClause.replace(/\bf\b/g, 'fs')}
        WHERE fs.IsVoided = 0 AND ${parentSpec.valueExpr.replace(/\bf\b/g, 'fs')} = @parentValue ${salesDateWhere}
        GROUP BY ${breakdownSpec.groupByColumn}
        ORDER BY SalesNet DESC
      `);
      return NextResponse.json({ breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), salesNet: Number(r.SalesNet) })) });
    }
```

Note: `breakdownSpec.joinClause` and `parentSpec.joinClause` both join against `fs` and use non-overlapping aliases (`le`/`c` for a `cliente_*` dimension, `p` for `producto`, `r` for `vendedor`) — since `breakdownBy` and `clienteDimension` are always different dimension families in practice (you break down a customer row by product/vendedor, not by another customer grain), their joins don't collide. If a future change allows `breakdownBy` and `clienteDimension` to be the same family (e.g. breaking down `cliente_entidad` by `cliente_tienda`), this double-join needs revisiting — out of scope for this task, which only wires `producto`/`vendedor` as breakdown options for Ventas per spec §5.

- [ ] **Step 5: Run test to verify it still passes**

Run: `bun test app/api/dwh/ventas/__tests__/route.test.ts`
Expected: PASS (401 gate unaffected by these changes).

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: no new errors — fix any signature mismatches between `route.ts` and `query-builder.ts` exports.

- [ ] **Step 7: Fix the top-customer label clipping bug and wire the entity/store toggle in the tab**

In `app/(app)/analitica/tabs/tab-ventas.tsx`:

1. Fix the clipping bug — add top margin and a wider category axis:

```tsx
              <BarChart data={chartData} layout={groupBy === 'mes' ? 'horizontal' : 'vertical'} margin={{ top: 8, left: groupBy === 'mes' ? 0 : 24 }}>
```
```tsx
                    <YAxis type="category" dataKey="label" width={200} tick={{ fontSize: 11 }} />
```

2. Add a `clienteDimension` toggle (Entidad/Tienda), shown only when `groupBy === 'cliente'`:

```tsx
  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad');
```

Include `clienteDimension` in the `params` built in the `load()` effect and in its dependency array:

```ts
        const params = new URLSearchParams({ dateRange, currency, groupBy });
        if (groupBy === 'cliente') {
          params.set('clienteDimension', clienteDimension);
          if (month) params.set('month', month);
        }
```
```ts
  }, [dateRange, currency, groupBy, month, clienteDimension]);
```

Add the toggle UI next to the existing `GROUP_BY_OPTIONS` buttons, rendered only `{groupBy === 'cliente' && (...)}`:

```tsx
        {groupBy === 'cliente' && (
          <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setClienteDimension('cliente_entidad')}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${clienteDimension === 'cliente_entidad' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Entidad
            </button>
            <button
              onClick={() => setClienteDimension('cliente_tienda')}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${clienteDimension === 'cliente_tienda' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Tienda
            </button>
          </div>
        )}
```

- [ ] **Step 8: Typecheck the frontend change**

Run: `bun run typecheck`
Expected: no new errors.

- [ ] **Step 9: Manual verification against the running app**

Run: `bun run build && bun run start` (per [[e2e_suite_production_build_fix]] convention — this app has reproduced dev-mode flakiness with DWH-backed pages, verify against a production build), then open `/analitica`, Ventas tab, switch to "Por cliente", toggle Entidad/Tienda, confirm the list changes and the top label is no longer clipped.
Expected: entity mode shows fewer, larger rows (chains collapsed); store mode shows every store separately; top row's label fully visible.

- [ ] **Step 10: Commit**

```bash
git add app/api/dwh/ventas/route.ts app/api/dwh/ventas/__tests__/route.test.ts app/\(app\)/analitica/tabs/tab-ventas.tsx
git commit -m "feat: entity/store toggle and breakdown for Ventas top clientes, fix label clipping"
```

---

## Task 6: Devoluciones — entity/store grouping and breakdown (fixes missing-Gama bug)

**Files:**
- Modify: `app/api/dwh/devoluciones/route.ts`
- Modify: `app/(app)/analitica/tabs/tab-devoluciones.tsx`
- Test: `app/api/dwh/devoluciones/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getDimensionSpec`, `isDimension`, `Dimension` (Task 3); `GroupedDrilldownTable` (Task 4).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Create `app/api/dwh/devoluciones/__tests__/route.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/devoluciones', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/devoluciones?groupBy=cliente&clienteDimension=cliente_entidad');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it currently passes (harness sanity check)**

Run: `bun test app/api/dwh/devoluciones/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 3: Update `clienteMatrixQuery` to use the generic dimension model**

In `app/api/dwh/devoluciones/route.ts`:

```ts
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimension, type Dimension } from '@/app/api/dwh/lib/query-builder';
```

Replace `clienteMatrixQuery`, using `spec.correlate(...)` (Task 3) to build the `Fact_Sales` scalar subquery correctly instead of any hand-written alias substitution:

```ts
function clienteMatrixQuery(dimension: Dimension, returnsDateWhere: string, salesDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fr', 'fs2');
  return `
    SELECT TOP 50
      ${spec.valueExpr} AS GroupValue,
      ${spec.labelExpr} AS GroupName,
      SUM(fr.NetAmount) AS ReturnsNet,
      (SELECT ISNULL(SUM(fs2.NetAmount), 0)
         FROM fact.Fact_Sales fs2
         ${innerJoin}
         WHERE fs2.IsVoided = 0 ${salesDateWhere} AND ${condition}
      ) AS SalesNet
    FROM fact.Fact_Returns fr
    ${spec.joinClause.replace(/\bf\b/g, 'fr')}
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY ReturnsNet DESC
  `;
}
```

Update `matrixQuery`'s dispatcher and the `GET` handler's `groupBy`/`clienteDimension` parsing the same way as Task 5 (add `clienteDimension` query param, default `'cliente_entidad'`, only relevant when `groupBy === 'cliente'`).

Update `toMatrixCell` to accept the resolved `GroupName` as before — no change needed there since it already just displays `row.GroupName`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/api/dwh/devoluciones/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no new errors.

- [ ] **Step 6: Add the Entidad/Tienda toggle to the Devoluciones tab**

In `app/(app)/analitica/tabs/tab-devoluciones.tsx`, add the same `clienteDimension` state and toggle UI pattern as Task 5 Step 7, shown only when `groupBy === 'cliente'`, and include `clienteDimension` in the fetch params/effect dependencies.

- [ ] **Step 7: Typecheck the frontend change**

Run: `bun run typecheck`
Expected: no new errors.

- [ ] **Step 8: Manual verification — confirms the Gama bug is fixed**

Run: `bun run build && bun run start`, open `/analitica`, Devoluciones tab, switch to "Por cliente" + Entidad mode.
Expected: the multi-store chain(s) confirmed live during design (Gama/Farmatodo/Plaza/Plansuárez, or whichever exist in the environment under test) now appear as single rows with summed `ReturnsNet`, ranked correctly — this is the direct regression check for the originally-reported "Gama missing" bug.

- [ ] **Step 9: Commit**

```bash
git add app/api/dwh/devoluciones/route.ts app/api/dwh/devoluciones/__tests__/route.test.ts app/\(app\)/analitica/tabs/tab-devoluciones.tsx
git commit -m "fix: entity/store toggle for Devoluciones cliente view, fixes missing-chain bug"
```

---

## Task 7: Clientes/Pareto — entity grouping (fixes zero-tier-A bug)

**Files:**
- Modify: `app/api/dwh/clientes/route.ts`
- Modify: `app/(app)/analitica/tabs/tab-clientes.tsx`
- Test: `app/api/dwh/clientes/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getDimensionSpec`, `isDimension`, `Dimension` (Task 3, including the `keyColumn`/correlation approach established in Task 6).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Create `app/api/dwh/clientes/__tests__/route.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/clientes', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/clientes');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it currently passes**

Run: `bun test app/api/dwh/clientes/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 3: Update `customerQuery` to default to entity grain, with a store-grain toggle**

In `app/api/dwh/clientes/route.ts`:

```ts
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimension, type Dimension } from '@/app/api/dwh/lib/query-builder';
```

Replace `customerQuery`, using `spec.correlate(...)` (Task 3) for the `Fact_Returns` scalar subquery — this preserves the original's `returnsDateWhere` parameter:

```ts
function customerQuery(dimension: Dimension, salesDateWhere: string, returnsDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fr2');
  return `
    SELECT
      ${spec.labelExpr} AS Name,
      SUM(fs.NetAmount) AS SalesNet,
      (SELECT ISNULL(SUM(fr2.NetAmount), 0)
         FROM fact.Fact_Returns fr2
         ${innerJoin}
         WHERE fr2.IsVoided = 0 ${returnsDateWhere} AND ${condition}
      ) AS ReturnsNet
    FROM fact.Fact_Sales fs
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesNet DESC
  `;
}
```

Update `GET` to parse a `clienteDimension` param (default `'cliente_entidad'`) and pass it through. The Pareto walk logic (`PARETO_THRESHOLDS`, the `reduce`/loop) is **unchanged** — it already just consumes whatever rows come back in `SalesNet DESC` order, per spec §5.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/api/dwh/clientes/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no new errors.

- [ ] **Step 6: Add the Entidad/Tienda toggle to the Clientes tab**

In `app/(app)/analitica/tabs/tab-clientes.tsx`, add the same toggle pattern as Tasks 5/6, always visible (this tab has no other `groupBy` states to gate it behind).

- [ ] **Step 7: Typecheck the frontend change**

Run: `bun run typecheck`
Expected: no new errors.

- [ ] **Step 8: Manual verification — confirms the zero-tier-A bug is fixed**

Run: `bun run build && bun run start`, open `/analitica`, Clientes tab, Entidad mode (default).
Expected: at least one customer/entity now lands in Pareto tier A if the underlying data has real concentration (verify against whatever chain data exists in the environment under test) — this is the direct regression check for the originally-reported "no A-tier customers" bug.

- [ ] **Step 9: Commit**

```bash
git add app/api/dwh/clientes/route.ts app/api/dwh/clientes/__tests__/route.test.ts app/\(app\)/analitica/tabs/tab-clientes.tsx
git commit -m "fix: entity-grain Pareto segmentation for Clientes tab, fixes empty tier-A bug"
```

---

## Task 8: Vendedores — Producto/Tienda breakdown and "Tasa cobr." tooltip fix

**Files:**
- Modify: `app/api/dwh/vendedores/route.ts`
- Modify: `app/(app)/analitica/tabs/tab-vendedores.tsx`
- Test: `app/api/dwh/vendedores/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getDimensionSpec`, `isDimension`, `Dimension` (Task 3); `GroupedDrilldownTable` (Task 4, optional — this tab's existing table is a plain `<table>`, not yet using the shared component; wiring breakdown here can reuse the same expand/fetch pattern without migrating the whole table to the shared component if time-boxing requires it — but prefer using `GroupedDrilldownTable` for consistency per spec §4.4).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Create `app/api/dwh/vendedores/__tests__/route.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/vendedores', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/vendedores');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it currently passes**

Run: `bun test app/api/dwh/vendedores/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 3: Add a breakdown query for `producto`/`cliente_tienda` scoped to one sales rep**

In `app/api/dwh/vendedores/route.ts`, add handling for `breakdownBy` + `parentValue` (a `SalesRepKey`) analogous to Task 5's breakdown branch:

```ts
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimension, type Dimension } from '@/app/api/dwh/lib/query-builder';

function breakdownQuery(dimension: Dimension, salesDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  return `
    SELECT TOP 15 ${spec.valueExpr} AS GroupValue, ${spec.labelExpr} AS GroupLabel, SUM(fs.NetAmount) AS SalesNet
    FROM fact.Fact_Sales fs
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${salesDateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesNet DESC
  `;
}
```

In `GET`, before building the main response, handle the breakdown case:

```ts
  const breakdownByParam = searchParams.get('breakdownBy');
  const breakdownBy: Dimension | null = isDimension(breakdownByParam) ? breakdownByParam : null;
  const parentValue = searchParams.get('parentValue');

  if (breakdownBy && parentValue && /^\d+$/.test(parentValue)) {
    const pool = await getDwhPool();
    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const req = pool.request();
    req.input('salesRepKey', Number(parentValue));
    const result = await req.query(breakdownQuery(breakdownBy, salesDateWhere));
    return NextResponse.json({
      breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), salesNet: Number(r.SalesNet) })),
    });
  }
```

Place this after the auth/session checks, before the main `salesRepQuery` logic. Also add `SalesRepKey` to the main `salesRepQuery`'s `SELECT`/`GROUP BY` (it's not currently selected — only `Name` is) so the frontend has a `parentValue` to send back on expand. This adds one new column to the existing query; every other column stays exactly as in the current `salesRepQuery` (`app/api/dwh/vendedores/route.ts:15-34`):

```ts
function salesRepQuery(salesDateWhere: string, returnsDateWhere: string, collectionsDateWhere: string): string {
  return `
    SELECT
      CAST(fs.SalesRepKey AS varchar(20)) AS SalesRepKeyValue,
      ISNULL(r.SalesRepName, r.SalesRepCode) AS Name,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNet,
      (SELECT ISNULL(SUM(fc.AmountCollected), 0)
         FROM fact.Fact_Collections fc
         WHERE fc.SalesRepKey = fs.SalesRepKey AND fc.IsVoided = 0 ${collectionsDateWhere}) AS Collected
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
    ORDER BY SalesNet DESC
  `;
}
```

In `app/(app)/analitica/types.ts`, add a `value: string` field to `VendedoresRow` (holding the stringified `SalesRepKey`, matching the `{ label: string; value: string }` shape `GroupedDrilldownTable` requires — see Task 4):

```ts
export interface VendedoresRow {
  value: string; // SalesRepKey, stringified — used as parentValue for breakdown fetches
  name: string;
  salesNet: number;
  returnsNet: number;
  returnRate: number | null;
  collectionRate: number | null;
  avgDiscount: number | null;
}
```

In `app/api/dwh/vendedores/route.ts`'s `rows.map`, read the new `SalesRepKeyValue` column and populate `value`:

```ts
    const rows: VendedoresRow[] = salesReps.recordset.map(r => {
      const salesNet = Number(r.SalesNet);
      const returnsNet = Number(r.ReturnsNet);
      const grossAmount = Number(r.GrossAmount);
      const discountAmount = Number(r.DiscountAmount);
      const collected = Number(r.Collected);

      return {
        value: String(r.SalesRepKeyValue),
        name: r.Name,
        salesNet,
        returnsNet,
        returnRate: salesNet > 0 ? returnsNet / salesNet : null,
        collectionRate: salesNet > 0 ? collected / salesNet : null,
        avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
      };
    });
```

`GroupedDrilldownTable`'s `label` requirement (also part of its `TRow extends { label: string; value: string }` constraint) is satisfied by mapping `name` to `label` at the call site in the tab component (Step 6 below), not by renaming `VendedoresRow.name` itself — keep `name` as the field consumed by any existing non-table code, and pass `{ ...row, label: row.name }` (or equivalent) into `GroupedDrilldownTable`'s `rows` prop.

- [ ] **Step 4: Run test to verify it still passes**

Run: `bun test app/api/dwh/vendedores/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no new errors — reconcile `VendedoresRow`/`VendedoresResponse` type changes across `types.ts`, `route.ts`, and the tab.

- [ ] **Step 6: Migrate the Vendedores table to `GroupedDrilldownTable` with breakdown wired, and fix the "Tasa cobr." label**

In `app/(app)/analitica/tabs/tab-vendedores.tsx`:
1. Replace the existing hand-rolled `<table>` with `<GroupedDrilldownTable>`, passing `columns` for the existing metric set (`salesNet`, `returnRate`, `collectionRate`, `avgDiscount`), `groupByOptions`/`groupBy` fixed to a no-op single option (this tab has no top-level groupBy toggle — only breakdown), and `breakdownByOptions: [{value: 'producto', label: 'Producto'}, {value: 'cliente_tienda', label: 'Tienda'}]` with `onFetchBreakdown` calling `/api/dwh/vendedores?breakdownBy=...&parentValue=...`.
2. Find the `'Tasa cobr.'` column definition (`tab-vendedores.tsx:47` per the spec) and add a `title` tooltip attribute or adjacent help text: `"Cobrado ÷ ventas netas del período. Puede superar 100% si se cobran facturas de períodos anteriores."`

- [ ] **Step 7: Typecheck the frontend change**

Run: `bun run typecheck`
Expected: no new errors.

- [ ] **Step 8: Manual verification**

Run: `bun run build && bun run start`, open `/analitica`, Vendedores tab, expand a sales rep row with breakdown set to Producto.
Expected: sub-rows appear showing that rep's top products; hovering "Tasa cobr." shows the clarifying tooltip.

- [ ] **Step 9: Commit**

```bash
git add app/api/dwh/vendedores/route.ts app/api/dwh/vendedores/__tests__/route.test.ts app/\(app\)/analitica/tabs/tab-vendedores.tsx app/\(app\)/analitica/types.ts
git commit -m "feat: add producto/tienda breakdown to Vendedores, clarify Tasa cobr. tooltip"
```

---

## Task 9: CxC — entity/store grouping for AR aging and top debtors

**Files:**
- Modify: `app/api/dwh/cxc/route.ts`
- Modify: `app/(app)/analitica/tabs/tab-cxc.tsx`
- Test: `app/api/dwh/cxc/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getDimensionSpec`, `isDimension`, `Dimension` (Task 3).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Create `app/api/dwh/cxc/__tests__/route.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/cxc', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/cxc');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it currently passes**

Run: `bun test app/api/dwh/cxc/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 3: Update `TOP_DEBTORS_QUERY` to support entity/store grouping**

In `app/api/dwh/cxc/route.ts`, replace the static `TOP_DEBTORS_QUERY` constant with a function, following the same dimension-parameterized pattern:

```ts
import { getUsdRate, getDimensionSpec, isDimension, type Dimension } from '@/app/api/dwh/lib/query-builder';

function topDebtorsQuery(dimension: Dimension): string {
  const spec = getDimensionSpec(dimension);
  return `
    SELECT TOP 10
      ${spec.labelExpr} AS Name,
      SUM(a.OutstandingBalance) AS Outstanding
    FROM fact.Fact_AR_Snapshot a
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey
    GROUP BY ${spec.groupByColumn}
    HAVING SUM(a.OutstandingBalance) > 0
    ORDER BY Outstanding DESC
  `;
}
```

Update `GET` to parse `clienteDimension` (default `'cliente_entidad'`) from `searchParams` and call `pool.request().input('snapshotDateKey', snapshotDateKey).query(topDebtorsQuery(clienteDimension))` in place of the old constant-query call.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/api/dwh/cxc/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no new errors.

- [ ] **Step 6: Add the Entidad/Tienda toggle to the CxC tab**

In `app/(app)/analitica/tabs/tab-cxc.tsx`, add the same toggle pattern as Tasks 5-7 for the top-debtors table specifically (aging buckets are unaffected — they're not customer-grouped).

- [ ] **Step 7: Typecheck the frontend change**

Run: `bun run typecheck`
Expected: no new errors.

- [ ] **Step 8: Manual verification**

Run: `bun run build && bun run start`, open `/analitica`, CxC tab, toggle Entidad/Tienda on top debtors.
Expected: list changes grain consistently with the other tabs.

- [ ] **Step 9: Commit**

```bash
git add app/api/dwh/cxc/route.ts app/api/dwh/cxc/__tests__/route.test.ts app/\(app\)/analitica/tabs/tab-cxc.tsx
git commit -m "feat: entity/store toggle for CxC top debtors"
```

---

## Task 10: E2E coverage

**Files:**
- Create: `e2e/analitica.spec.ts`

**Interfaces:**
- Consumes: existing `e2e/fixtures.ts` (login helper) and `e2e/helpers/` — read these first to match the established login/session pattern before writing new test code (do not invent a new login flow).
- Produces: nothing consumed by other tasks — this is the final leaf task.

- [ ] **Step 1: Read the existing `@mssql`-tagged spec and fixtures to match conventions**

Run: `cat e2e/fixtures.ts` and find the existing `@mssql` spec (per the spec doc, `reports.spec.ts` — confirm its actual filename with `grep -l "@mssql" e2e/*.spec.ts`) and read it fully before writing new code.

- [ ] **Step 2: Write `e2e/analitica.spec.ts`**

Follow the exact structure of the existing `@mssql`-tagged spec found in Step 1 (login setup, `test.describe` with `{ tag: '@mssql' }`, teardown). Cover:

```ts
import { test, expect } from '@playwright/test';
// import whatever login helper the existing @mssql spec uses from e2e/fixtures.ts or e2e/helpers/

test.describe('Analítica - agrupación de clientes', { tag: '@mssql' }, () => {
  test.beforeEach(async ({ page }) => {
    // reuse the same login flow as the existing @mssql spec
  });

  test('toggling Entidad/Tienda changes the Ventas top-clientes list', async ({ page }) => {
    await page.goto('/analitica');
    await page.getByRole('tab', { name: /ventas/i }).click();
    await page.getByRole('button', { name: /por cliente/i }).click();

    const entidadRowCountBefore = await page.locator('table tbody tr').count();
    await page.getByRole('button', { name: /tienda/i }).click();
    // Store grain should show at least as many rows as entity grain
    // (every chain expands into multiple rows; standalone customers unchanged)
    await expect(page.locator('table tbody tr')).not.toHaveCount(0);
    const tiendaRowCount = await page.locator('table tbody tr').count();
    expect(tiendaRowCount).toBeGreaterThanOrEqual(entidadRowCountBefore);
  });

  test('a multi-store chain appears as a single row in Devoluciones entity mode', async ({ page }) => {
    await page.goto('/analitica');
    await page.getByRole('tab', { name: /devoluciones/i }).click();
    await page.getByRole('button', { name: /por cliente/i }).click();
    await page.getByRole('button', { name: /^entidad$/i }).click();
    // Assert the table renders without error and has at least one row -
    // exact chain names depend on whatever ERP test data is loaded, so this
    // checks structure/non-emptiness rather than a hardcoded name.
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('expanding a Vendedores row loads a product breakdown', async ({ page }) => {
    await page.goto('/analitica');
    await page.getByRole('tab', { name: /vendedores/i }).click();
    await page.locator('table tbody tr').first().locator('button[aria-label="Expandir"]').click();
    await expect(page.locator('table tbody tr').nth(1)).toBeVisible();
  });
});
```

Adjust selectors (`getByRole` names, exact button labels) to match the actual rendered text once Tasks 5-9 land — this is written against the plan's intended labels ("Entidad", "Tienda", "Por cliente") and must be reconciled against the real DOM during implementation, not assumed correct blind.

- [ ] **Step 3: Ensure local Node version supports Playwright before running**

Run: `node --version`
Expected: v20 or higher. If not, run `nvm install 20 && nvm use 20` first (per spec §6 — this is a known, already-diagnosed local environment gap, not a new blocker to investigate).

- [ ] **Step 4: Run the new spec**

Run: `bun run e2e:mssql`
Expected: all 3 new tests PASS against the local `profitplus-erp-mock` docker container (confirmed working — see spec §6).

- [ ] **Step 5: Commit**

```bash
git add e2e/analitica.spec.ts
git commit -m "test: add E2E coverage for analitica entity/store toggle and breakdown"
```

---

## Task 11: Full regression pass and PR

**Files:** none (verification only)

**Interfaces:** none — final task, verifies all prior tasks together.

- [ ] **Step 1: Run the full unit/integration test suite**

Run: `bun test`
Expected: all tests pass, including every new test file from Tasks 1, 3, 5-9.

- [ ] **Step 2: Run the full typecheck**

Run: `bun run typecheck`
Expected: zero errors.

- [ ] **Step 3: Run the full E2E suite (not just the new spec)**

Run: `bun run e2e:mssql`
Expected: all `@mssql`-tagged specs pass, including the pre-existing `reports.spec.ts` (confirms no regression from the `Dim_Customer` schema change).

- [ ] **Step 4: Manual smoke test of all 5 changed tabs**

Run: `bun run build && bun run start`, open `/analitica`, click through Ventas, Devoluciones, Clientes, Vendedores, CxC tabs.
Expected: no console errors, every tab loads data, every Entidad/Tienda toggle and breakdown expand works.

- [ ] **Step 5: Push branch and open PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat: customer legal entity grouping and generic drilldown pivot" --body "$(cat <<'EOF'
## Summary
- Groups multi-store customer chains (via Profit's native saCliente.matriz link) into one Dim_LegalEntity rollup, fixing empty Pareto tier-A and a chain missing from Devoluciones top-50.
- Adds a generic Cliente(Entidad|Tienda)/Producto/Vendedor pivot mechanism (shared query-builder + GroupedDrilldownTable component) across Ventas, Devoluciones, Vendedores, Clientes, and CxC.
- Fixes the Ventas top-cliente label clipping bug and clarifies the Vendedores "Tasa cobr." metric.

## Test plan
- [ ] `bun test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run e2e:mssql` passes (including new e2e/analitica.spec.ts)
- [ ] Manual verification of all 5 tabs against a production build

Spec: docs/superpowers/specs/2026-09-10-customer-legal-entity-grouping-design.md
Plan: docs/superpowers/plans/2026-09-10-customer-legal-entity-grouping.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01R2NDz7ADjh7gxRuyD2XYPW
EOF
)"
```
