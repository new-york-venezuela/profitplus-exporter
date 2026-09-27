# Consignment Store Delivery Analytics ("Gama") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the employee-maintained Excel delivery log for Gama (a consignment client whose store-level deliveries aren't individually invoiced) into a queryable DWH fact table, joined against Gama's existing per-store `Dim_Customer` rows and priced from Gama's own invoice history.

**Architecture:** One new fact table (`fact.Fact_ConsignmentDeliveries`) plus one small mapping/seed table (`dwh.ConsignmentProductMap`), created by a migration that also inserts one new `Dim_Customer` row for a store not yet in the ERP ("Gama La Joya"). A standalone Bun script (`scripts/import-consignment-deliveries.ts`, following the `scripts/dwh-legacy-2025-import.ts` precedent — plain exported functions, no framework) reads the `.xlsx` with the `xlsx` package already in `package.json`, resolves store/product identity via static in-script lookup tables (no runtime fuzzy matching), computes an identity/content-hash pair per row for idempotent re-import, and derives USD unit price via an as-of lookup against `fact.Fact_Sales`.

**Tech Stack:** TypeScript, Bun, `mssql`, `xlsx` (SheetJS, already a dependency), `bun:test` for the DB-integration test.

**Spec:** `docs/superpowers/specs/2026-09-27-consignment-store-deliveries-design.md`

## Global Constraints

- Every `CREATE TABLE`/seed `INSERT` in the migration must be safely re-runnable (`IF NOT EXISTS` guards), per `migrations/dwh/README.md`.
- `.input()` binding for every parameterized query — no string concatenation of user/file-controlled values (AGENTS.md: "DWH `mssql` queries... if you add a filter, use `.input()` there too").
- `NetAmount`/pricing conversions must go through the per-row `DocumentExchangeRate` pattern, never a blanket current rate (spec Section 4, `erp_currency_bsd_usd` memory).
- The import script never writes to `dim.Dim_Customer` — dimension writes stay inside the migration (spec Section 1).
- No fuzzy/runtime matching for store or product names — both are static, human-reviewed lookup tables checked into source (spec Sections 1–2).
- `Fact_ConsignmentDeliveries` stays structurally separate from `Fact_Sales` — no shared rows, no merged "total sales" query (spec Section 5).

## Review Focus

- **Re-running the import after the employee corrects a quantity** (not just appends new rows) must update the existing fact row in place, not insert a duplicate — this is the entire reason `SourceRowKey`/`SourceRowContentHash` are split (spec Section 3/6). A test that only covers first-time import of a fixed file will miss this.
- **A row whose store or product has no entry in the static maps** must hard-fail the whole run with a clear message naming the unmapped value, not silently skip it or crash on a null dereference partway through a batch (spec Section 6, steps 2–3).
- **A product with no prior `Fact_Sales` line for Gama** (no price history yet) must leave `UnitPriceUsd`/`LineAmountUsd` as `NULL`, not `0` or a crash from dividing by a missing row (spec Section 4).
- **The three "Cj" (box) product columns** must be clearly distinguishable in the loaded data (`IsBoxUnit` flag) so a future consumer doesn't sum `LineAmountUsd` across all 12 products expecting unit-comparable totals (spec Section 2).
- **A delivery row where every product column is blank/zero** (a store visited with nothing delivered, or a stray row) must not produce a phantom `Fact_ConsignmentDeliveries` row with `QuantityDelivered = 0` — the file's real rows always have at least one non-null product quantity; only rows with an actual quantity for a given product should become a fact row (this mirrors how the file itself is structured: one row can supply multiple product columns, each a candidate fact row).

---

## File Structure

- **Modify:** `migrations/dwh/0035_consignment_store_deliveries.sql` (new file) — schema + seeds.
- **Create:** `scripts/import-consignment-deliveries.ts` — the import script, structured as plain exported functions (parse, resolve, hash, upsert) plus a thin `main()`, mirroring `scripts/dwh-legacy-2025-import.ts`.
- **Create:** `scripts/dwh/__tests__/consignment-deliveries-schema.test.ts` — DB-integration test for the migration (mirrors `scripts/dwh/__tests__/legacy-2025-schema.test.ts`).
- **Create:** `scripts/dwh/__tests__/consignment-deliveries-import.test.ts` — unit tests for the pure parsing/hashing/mapping logic in the import script (no DB needed for these).

---

### Task 1: Migration — schema, product map seed, and the "Gama La Joya" customer row

**Files:**
- Create: `migrations/dwh/0035_consignment_store_deliveries.sql`
- Test: `scripts/dwh/__tests__/consignment-deliveries-schema.test.ts`

**Interfaces:**
- Produces: `fact.Fact_ConsignmentDeliveries` table (columns: `FactConsignmentDeliveryKey`, `DateKey`, `CustomerKey`, `ProductKey`, `NotaEntregaNum`, `QuantityDelivered`, `UnitPriceUsd`, `LineAmountUsd`, `SourceClientTag`, `SourceFileName`, `SourceRowKey`, `SourceRowContentHash`, `LoadedAtUtc`), unique index on `SourceRowKey`. `dwh.ConsignmentProductMap` table (`ConsignmentProductMapKey`, `SourceClientTag`, `ExcelProductName`, `ProductKey`, `IsBoxUnit`), seeded with the 12 Gama rows from the spec. One new `dim.Dim_Customer` row for "Gama La Joya" (`CustomerCode = 'J-301420608-24'`).
- Consumes: existing `dim.Dim_Date`, `dim.Dim_Customer`, `dim.Dim_Product` tables (all already migrated).

- [ ] **Step 1: Write the schema migration SQL**

```sql
-- migrations/dwh/0035_consignment_store_deliveries.sql

-- New store for Gama, not yet backed by a real saCliente row in the ERP —
-- see docs/superpowers/specs/2026-09-27-consignment-store-deliveries-design.md
-- Section 1. If Load_Dim_Customer later finds a real saCliente row for this
-- store, its own SCD2 logic takes over from here with no special handling.
IF NOT EXISTS (SELECT 1 FROM dim.Dim_Customer WHERE RTRIM(CustomerCode) = 'J-301420608-24')
BEGIN
    INSERT INTO dim.Dim_Customer (
        CustomerCode, CustomerName, TaxId, LegalEntityRIF, IsSpecialTaxpayer, CreditLimit, CreditLimitCurrencyCode,
        ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity, IsInactive, MatrizCode, ValidFrom, ValidTo, IsCurrent, LegalEntityKey
    )
    VALUES (
        'J-301420608-24 ', 'EXCELSIOR GAMA SUPERMERCADOS, C.A. (La Joya)', NULL, NULL, 0, NULL, NULL,
        'CCS   ', NULL, NULL, 0, 0, 'J-301420608     ', SYSUTCDATETIME(), NULL, 1, 26
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ConsignmentProductMap' AND schema_id = SCHEMA_ID('dwh'))
BEGIN
    CREATE TABLE dwh.ConsignmentProductMap (
        ConsignmentProductMapKey int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SourceClientTag          varchar(40)  NOT NULL,
        ExcelProductName         varchar(60)  NOT NULL,
        ProductKey               int          NOT NULL,
        IsBoxUnit                bit          NOT NULL DEFAULT 0,
        CONSTRAINT FK_ConsignmentProductMap_Product FOREIGN KEY (ProductKey) REFERENCES dim.Dim_Product(ProductKey)
    );
    CREATE UNIQUE INDEX IX_ConsignmentProductMap_Client_Name ON dwh.ConsignmentProductMap (SourceClientTag, ExcelProductName);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.ConsignmentProductMap WHERE SourceClientTag = 'gama')
BEGIN
    INSERT INTO dwh.ConsignmentProductMap (SourceClientTag, ExcelProductName, ProductKey, IsBoxUnit)
    SELECT 'gama', v.ExcelProductName, p.ProductKey, v.IsBoxUnit
    FROM (VALUES
        ('4 Granos 500gr',       '0000007', CAST(0 AS bit)),
        ('7 Cereales 600gr',     '0000008', CAST(0 AS bit)),
        ('Miel y pasas 600gr',   '0000009', CAST(0 AS bit)),
        ('Pan Blanco 600gr',     '0000022', CAST(0 AS bit)),
        ('Magdalena',            '0000016', CAST(0 AS bit)),
        ('Molido 300gr',         '0000011', CAST(0 AS bit)),
        ('Baguette 220gr',       '0000004', CAST(0 AS bit)),
        ('cheese Cake fresa',    '0000017', CAST(0 AS bit)),
        ('cheese Cake Choco',    '0000018', CAST(0 AS bit)),
        ('Pizza Margarita 270',  '0000002', CAST(0 AS bit)),
        ('Pizza Magarita Cj',    '0000014', CAST(1 AS bit)),
        ('Pizza New York Cj',    '0000015', CAST(1 AS bit)),
        ('Pizza Americana Cj',   '0000020', CAST(1 AS bit))
    ) AS v(ExcelProductName, ProductCode, IsBoxUnit)
    INNER JOIN dim.Dim_Product p ON RTRIM(p.ProductCode) = v.ProductCode AND p.IsCurrent = 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_ConsignmentDeliveries' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_ConsignmentDeliveries (
        FactConsignmentDeliveryKey bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey               int             NOT NULL,
        CustomerKey           int             NOT NULL,
        ProductKey            int             NOT NULL,
        NotaEntregaNum        varchar(30)     NULL,
        QuantityDelivered     decimal(18,5)   NOT NULL,
        UnitPriceUsd          decimal(18,5)   NULL,
        LineAmountUsd         decimal(18,2)   NULL,
        SourceClientTag       varchar(40)     NOT NULL,
        SourceFileName        varchar(200)    NOT NULL,
        SourceRowKey          varchar(64)     NOT NULL,
        SourceRowContentHash  varchar(64)     NOT NULL,
        LoadedAtUtc            datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Fact_ConsignmentDeliveries_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_ConsignmentDeliveries_Customer FOREIGN KEY (CustomerKey) REFERENCES dim.Dim_Customer(CustomerKey),
        CONSTRAINT FK_Fact_ConsignmentDeliveries_Product FOREIGN KEY (ProductKey) REFERENCES dim.Dim_Product(ProductKey)
    );
    CREATE UNIQUE INDEX IX_Fact_ConsignmentDeliveries_RowKey ON fact.Fact_ConsignmentDeliveries (SourceRowKey);
    CREATE INDEX IX_Fact_ConsignmentDeliveries_DateKey ON fact.Fact_ConsignmentDeliveries (DateKey);
    CREATE INDEX IX_Fact_ConsignmentDeliveries_CustomerKey ON fact.Fact_ConsignmentDeliveries (CustomerKey);
END
GO
```

- [ ] **Step 2: Write the schema test**

```typescript
// scripts/dwh/__tests__/consignment-deliveries-schema.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

process.env.DW_NAME = `DWH_AlimentosNY_Test_consignment_${Date.now()}`;

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

describe('0035_consignment_store_deliveries migration', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
  }, 60_000);

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('inserts the Gama La Joya customer row under the Gama matriz', async () => {
    const result = await pool.request().query(`
      SELECT CustomerName, RTRIM(MatrizCode) AS MatrizCode, LegalEntityKey, IsCurrent
      FROM dim.Dim_Customer WHERE RTRIM(CustomerCode) = 'J-301420608-24'
    `);
    expect(result.recordset).toHaveLength(1);
    expect(result.recordset[0].MatrizCode).toBe('J-301420608');
    expect(result.recordset[0].LegalEntityKey).toBe(26);
    expect(result.recordset[0].IsCurrent).toBe(true);
  });

  test('seeds all 13 ConsignmentProductMap rows for gama, with 3 flagged IsBoxUnit', async () => {
    const result = await pool.request().query(`
      SELECT ExcelProductName, IsBoxUnit FROM dwh.ConsignmentProductMap WHERE SourceClientTag = 'gama'
    `);
    expect(result.recordset).toHaveLength(13);
    const boxUnitNames = result.recordset.filter((r: { IsBoxUnit: boolean }) => r.IsBoxUnit).map((r: { ExcelProductName: string }) => r.ExcelProductName);
    expect(boxUnitNames.sort()).toEqual(['Pizza Americana Cj', 'Pizza Magarita Cj', 'Pizza New York Cj']);
  });

  test('creates Fact_ConsignmentDeliveries with FKs to Dim_Date, Dim_Customer, Dim_Product', async () => {
    const result = await pool.request().query(`
      SELECT OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable
      FROM sys.foreign_keys fk
      WHERE fk.parent_object_id = OBJECT_ID('fact.Fact_ConsignmentDeliveries')
    `);
    const referencedTables = result.recordset.map((r: { ReferencedTable: string }) => r.ReferencedTable);
    expect(referencedTables).toEqual(expect.arrayContaining(['Dim_Date', 'Dim_Customer', 'Dim_Product']));
  });

  test('enforces uniqueness on SourceRowKey', async () => {
    const dateRow = await pool.request().query(`SELECT TOP 1 DateKey FROM dim.Dim_Date`);
    const custRow = await pool.request().query(`SELECT TOP 1 CustomerKey FROM dim.Dim_Customer`);
    const prodRow = await pool.request().query(`SELECT TOP 1 ProductKey FROM dim.Dim_Product`);
    const insertOne = () => pool.request()
      .input('dateKey', sql.Int, dateRow.recordset[0].DateKey)
      .input('customerKey', sql.Int, custRow.recordset[0].CustomerKey)
      .input('productKey', sql.Int, prodRow.recordset[0].ProductKey)
      .query(`
        INSERT INTO fact.Fact_ConsignmentDeliveries
          (DateKey, CustomerKey, ProductKey, QuantityDelivered, SourceClientTag, SourceFileName, SourceRowKey, SourceRowContentHash)
        VALUES (@dateKey, @customerKey, @productKey, 1, 'gama', 'test.xlsx', 'dup-key', 'hash-a')
      `);
    await insertOne();
    await expect(insertOne()).rejects.toThrow();
  });

  test('migration is re-runnable without error', async () => {
    await expect(runDwhMigrations()).resolves.toBeDefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails (table/rows don't exist yet in a fresh test DB before this migration file is picked up — actually it WILL pass once the migration file exists, since `runDwhMigrations` applies every file in the directory; instead verify it fails if you temporarily rename the migration file)**

Run: `mv migrations/dwh/0035_consignment_store_deliveries.sql /tmp/0035.sql.bak && bun test --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consignment-deliveries-schema.test.ts; mv /tmp/0035.sql.bak migrations/dwh/0035_consignment_store_deliveries.sql`
Expected: FAIL (table/rows not found) with the migration file absent, confirming the test actually exercises the new migration and isn't vacuously passing.

- [ ] **Step 4: Run the test with the migration file in place**

Run: `bun test --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consignment-deliveries-schema.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Run the full migration against the real local DWH to confirm it's re-runnable there too**

Run: `bun run migrate:dwh`
Expected: exits 0, output lists `0035_consignment_store_deliveries.sql` as applied (or already-applied on a second run).

- [ ] **Step 6: Commit**

```bash
git add migrations/dwh/0035_consignment_store_deliveries.sql scripts/dwh/__tests__/consignment-deliveries-schema.test.ts
git commit -m "$(cat <<'EOF'
feat: add Fact_ConsignmentDeliveries schema and Gama product/store seeds

New fact table for Gama's store-level delivery tracking, sourced from
an employee-maintained Excel log rather than the ERP (store-level
invoicing for Gama stopped in March 2026 and rolled into one
consolidated matriz invoice). Reuses the existing per-store
Dim_Customer rows under the Gama matriz instead of a new dimension,
adding one new row for "Gama La Joya" which has no ERP customer code
yet. Seeds the 12-product Excel-name-to-ProductKey mapping, flagging
the 3 "Cj" (box) columns that have no case-level SKU in the ERP.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Import script — pure parsing/hashing/mapping logic (no DB)

**Files:**
- Create: `scripts/import-consignment-deliveries.ts`
- Test: `scripts/dwh/__tests__/consignment-deliveries-import.test.ts`

**Interfaces:**
- Consumes: `xlsx` package (`XLSX.readFile`, `XLSX.utils.sheet_to_json`), `crypto` (`createHash`) from Node/Bun stdlib.
- Produces (exported for the test file and for Task 3 to compose into `main()`):
  - `STORE_MAP: Record<string, string>` — Excel store name → `CustomerCode` (23 entries, from the spec's mapping table).
  - `type ParsedRow = { storeName: string; date: Date; notaEntregaNum: string | null; productName: string; quantity: number }`
  - `parseWorkbook(filePath: string): ParsedRow[]` — reads the file, flattens one row-per-product-column into one `ParsedRow` per non-null/non-zero quantity cell, skips the "Total Unidades"/"Total $" summary rows and any row with a blank store name.
  - `computeRowKey(sourceClientTag: string, customerCode: string, dateKey: number, notaEntregaNum: string | null, productKey: number): string` — SHA-256 hex of the identity tuple.
  - `computeContentHash(quantity: number): string` — SHA-256 hex of the mutable-fields tuple (just quantity today).
  - `toDateKey(date: Date): number` — `yyyyMMdd` integer, matching the DWH's existing `DateKey` convention (see `migrations/dwh/0009_fact_sales.sql`'s `FORMAT(..., 'yyyyMMdd')` pattern).

- [ ] **Step 1: Write the failing tests for the pure functions**

```typescript
// scripts/dwh/__tests__/consignment-deliveries-import.test.ts
import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';
import {
  STORE_MAP, parseWorkbook, computeRowKey, computeContentHash, toDateKey,
} from '../../import-consignment-deliveries';

describe('STORE_MAP', () => {
  test('has exactly 23 entries (22 original file stores + La Joya)', () => {
    expect(Object.keys(STORE_MAP)).toHaveLength(23);
  });

  test('maps known stores to the resolved CustomerCode from the spec', () => {
    expect(STORE_MAP['Gama Express Chuao']).toBe('J-301420608-21');
    expect(STORE_MAP['Gama Express Caurimare']).toBe('J-301420608-18');
    expect(STORE_MAP['Gama Plus Santa Eduvigis']).toBe('J-301420608-2');
    expect(STORE_MAP['Gama Plus La Trinidad']).toBe('J-301420608-6');
    expect(STORE_MAP['Gama La Joya']).toBe('J-301420608-24');
  });
});

describe('toDateKey', () => {
  test('formats a date as yyyyMMdd', () => {
    expect(toDateKey(new Date(Date.UTC(2026, 3, 16)))).toBe(20260416);
  });
});

describe('computeRowKey', () => {
  test('is stable for the same identity tuple', () => {
    const a = computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 5);
    const b = computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 5);
    expect(a).toBe(b);
  });

  test('differs when any identity field differs', () => {
    const base = computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 5);
    expect(computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 6)).not.toBe(base);
    expect(computeRowKey('gama', 'J-301420608-22', 20260416, 'D0001', 5)).not.toBe(base);
    expect(computeRowKey('gama', 'J-301420608-21', 20260417, 'D0001', 5)).not.toBe(base);
  });

  test('does not change when quantity changes (quantity is not part of identity)', () => {
    // computeRowKey has no quantity parameter at all -- this test documents that
    // intentional omission so a future refactor doesn't accidentally add it.
    const key1 = computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 5);
    const key2 = computeRowKey('gama', 'J-301420608-21', 20260416, 'D0001', 5);
    expect(key1).toBe(key2);
  });
});

describe('computeContentHash', () => {
  test('differs when quantity changes', () => {
    expect(computeContentHash(18)).not.toBe(computeContentHash(20));
  });

  test('is stable for the same quantity', () => {
    expect(computeContentHash(18)).toBe(computeContentHash(18));
  });
});

describe('parseWorkbook', () => {
  const fixturePath = join(import.meta.dir, 'fixtures', 'despacho-sample.xlsx');

  test('produces one ParsedRow per non-zero product cell', () => {
    const rows = parseWorkbook(fixturePath);
    // Fixture (see Step 2 below): 3 delivery rows, one with 2 non-null
    // product columns, one with 1, one with 0 (all blank) -- expect 3 ParsedRows.
    expect(rows).toHaveLength(3);
  });

  test('skips the Total Unidades / Total $ summary rows', () => {
    const rows = parseWorkbook(fixturePath);
    expect(rows.some(r => r.storeName === 'Total Unidades')).toBe(false);
    expect(rows.some(r => r.storeName === 'Total $')).toBe(false);
  });

  test('carries the nota/PO identifier through as an opaque string', () => {
    const rows = parseWorkbook(fixturePath);
    const row = rows.find(r => r.notaEntregaNum === 'D0001');
    expect(row).toBeDefined();
  });

  test('skips a row where every product column is blank', () => {
    const rows = parseWorkbook(fixturePath);
    // The fixture's third data row has a store+date+nota but zero product
    // quantities -- must not produce any ParsedRow at all for it.
    expect(rows.every(r => r.quantity > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Build the test fixture**

Create `scripts/dwh/__tests__/fixtures/despacho-sample.xlsx` with the same
column layout as the real file (headers in row 1, data starting row 2):
`A: Nombre de Cliente, B: Fecha de Despacho, C: Orden de Compra, D: 4 Granos 500gr, E: 7 Cereales 600gr` (5 columns is enough for the fixture — the real file's other 7 product columns aren't needed to exercise the parsing logic). Three data rows:
1. `Gama Express Chuao | 2026-04-16 | D0001 | 5 | 3` (→ 2 ParsedRows)
2. `Gama Vizcaya | 2026-04-17 | D0002 | 4 | (blank)` (→ 1 ParsedRow)
3. `Gama La Urbina | 2026-04-18 | D0003 | (blank) | (blank)` (→ 0 ParsedRows)
4. `Total Unidades | (blank) | (blank) | 9 | 3` (summary row, must be skipped)

Build it with a small one-off script (not committed) since this is a binary fixture:

```typescript
// run once via: bun run /tmp/build-fixture.ts, then discard
import * as XLSX from 'xlsx';
const wb = XLSX.utils.book_new();
const data = [
  ['Nombre de Cliente', 'Fecha de Despacho', 'Orden de Compra', '4 Granos 500gr', '7 Cereales 600gr'],
  ['Gama Express Chuao', new Date(2026, 3, 16), 'D0001', 5, 3],
  ['Gama Vizcaya', new Date(2026, 3, 17), 'D0002', 4, null],
  ['Gama La Urbina', new Date(2026, 3, 18), 'D0003', null, null],
  ['Total Unidades', null, null, 9, 3],
];
const ws = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, 'GAMA');
XLSX.writeFile(wb, 'scripts/dwh/__tests__/fixtures/despacho-sample.xlsx');
```

Run: `mkdir -p scripts/dwh/__tests__/fixtures && bun run /tmp/build-fixture.ts`
Expected: `scripts/dwh/__tests__/fixtures/despacho-sample.xlsx` created.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test scripts/dwh/__tests__/consignment-deliveries-import.test.ts`
Expected: FAIL with "Cannot find module '../../import-consignment-deliveries'" (file doesn't exist yet).

- [ ] **Step 4: Write the pure-logic portion of the import script**

```typescript
// scripts/import-consignment-deliveries.ts
import * as XLSX from 'xlsx';
import { createHash } from 'node:crypto';

// One-time-resolved mapping from the file's store names to the existing
// dim.Dim_Customer child rows under the Gama matriz (CustomerKey 29,
// LegalEntityKey 26) -- see
// docs/superpowers/specs/2026-09-27-consignment-store-deliveries-design.md
// Section 1's mapping table. Resolved by hand against a live query, not
// fuzzy-matched at runtime. "Gama La Joya" has no ERP row yet, so it
// points at the new row Task 1's migration inserts (J-301420608-24).
export const STORE_MAP: Record<string, string> = {
  'Gama Plus Santa Eduvigis': 'J-301420608-2',
  'Gama Vizcaya': 'J-301420608-10',
  'Gama Express Santa Monica': 'J-301420608-11',
  'Gama La India': 'J-301420608-12',
  'Gama La Tahona': 'J-301420608-13',
  'Gama Express Sebucan Norte': 'J-301420608-14',
  'Gama La Urbina': 'J-301420608-15',
  'Gama Express San Bernardino': 'J-301420608-16',
  'Gama Express Macaracuay Plaza': 'J-301420608-17',
  'Gama Express Caurimare': 'J-301420608-18',
  'Gama Panamericana': 'J-301420608-19',
  'Gama Express La Castellana': 'J-301420608-20',
  'Gama Express Chuao': 'J-301420608-21',
  'Gama Los Palos Grandes': 'J-301420608-22',
  'Gama Express Los Palos Grandes': 'J-301420608-3',
  'Gama Express Las Mercedes': 'J-301420608-4',
  'Gama Express Santa Fe': 'J-301420608-5',
  'Gama Plus La Trinidad': 'J-301420608-6',
  'Gama Express La Trinidad': 'J-301420608-7',
  'Gama Express El Paraiso': 'J-301420608-8',
  'Gama Santa Fe': 'J-301420608-9',
  'Gama La Joya': 'J-301420608-24',
};

const SUMMARY_ROW_STORE_NAMES = new Set(['Total Unidades', 'Total $']);

const PRODUCT_COLUMNS = [
  '4 Granos 500gr', '7 Cereales 600gr', 'Miel y pasas 600gr', 'Pan Blanco 600gr',
  'Magdalena', 'Molido 300gr', 'Baguette 220gr', 'cheese Cake fresa',
  'cheese Cake Choco', 'Pizza Margarita 270', 'Pizza Magarita Cj',
  'Pizza New York Cj', 'Pizza Americana Cj',
] as const;

export type ParsedRow = {
  storeName: string;
  date: Date;
  notaEntregaNum: string | null;
  productName: string;
  quantity: number;
};

export function parseWorkbook(filePath: string): ParsedRow[] {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const parsed: ParsedRow[] = [];
  for (const raw of rawRows) {
    const storeName = raw['Nombre de Cliente'];
    if (typeof storeName !== 'string' || storeName.trim() === '') continue;
    if (SUMMARY_ROW_STORE_NAMES.has(storeName)) continue;

    const date = raw['Fecha de Despacho'];
    if (!(date instanceof Date)) continue;

    const notaRaw = raw['Orden de Compra'];
    const notaEntregaNum = notaRaw === null || notaRaw === undefined ? null : String(notaRaw).trim();

    for (const productName of PRODUCT_COLUMNS) {
      const cell = raw[productName];
      if (typeof cell !== 'number' || cell <= 0) continue; // blank/zero cell -- no delivery of this product on this row
      parsed.push({ storeName: storeName.trim(), date, notaEntregaNum, productName, quantity: cell });
    }
  }
  return parsed;
}

export function toDateKey(date: Date): number {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return Number(`${y}${m}${d}`);
}

export function computeRowKey(
  sourceClientTag: string, customerCode: string, dateKey: number,
  notaEntregaNum: string | null, productKey: number,
): string {
  const identity = [sourceClientTag, customerCode, dateKey, notaEntregaNum ?? '', productKey].join('|');
  return createHash('sha256').update(identity).digest('hex');
}

export function computeContentHash(quantity: number): string {
  return createHash('sha256').update(String(quantity)).digest('hex');
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test scripts/dwh/__tests__/consignment-deliveries-import.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-consignment-deliveries.ts scripts/dwh/__tests__/consignment-deliveries-import.test.ts scripts/dwh/__tests__/fixtures/despacho-sample.xlsx
git commit -m "$(cat <<'EOF'
feat: add pure parsing/hashing logic for the Gama consignment import

Flattens the delivery workbook's wide, one-row-per-delivery /
one-column-per-product layout into one ParsedRow per non-blank
quantity cell, skipping the file's Total Unidades/Total $ summary
rows. Splits the fact table's idempotency key into an identity hash
(store+date+nota+product) and a separate content hash (quantity), so
re-running the import after the employee corrects a quantity updates
the existing row instead of duplicating it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Import script — DB resolution, pricing, upsert, and diagnostic report

**Files:**
- Modify: `scripts/import-consignment-deliveries.ts`
- Test: `scripts/dwh/__tests__/consignment-deliveries-run.test.ts`

**Interfaces:**
- Consumes: `getDwhPool` from `@/lib/db/dwh-mssql`; `STORE_MAP`, `parseWorkbook`, `toDateKey`, `computeRowKey`, `computeContentHash` from Task 2.
- Produces:
  - `type ImportReport = { inserted: number; updated: { rowKey: string; oldQuantity: number; newQuantity: number }[]; unmappedStores: string[]; unmappedProducts: string[]; pricesNotFound: { productKey: number; dateKey: number }[] }`
  - `resolveProductMap(pool: sql.ConnectionPool, sourceClientTag: string): Promise<Map<string, { productKey: number; isBoxUnit: boolean }>>` — loads `dwh.ConsignmentProductMap` into a `ExcelProductName -> {productKey, isBoxUnit}` map.
  - `resolveCustomerKeys(pool: sql.ConnectionPool, customerCodes: string[]): Promise<Map<string, number>>` — loads `CustomerCode -> CustomerKey` for the given codes from `dim.Dim_Customer` (`IsCurrent = 1`).
  - `lookupAsOfPrice(pool: sql.ConnectionPool, productKey: number, dateKey: number): Promise<number | null>` — the Section 4 as-of query, USD-converted per-row.
  - `importDeliveries(pool: sql.ConnectionPool, filePath: string, sourceClientTag: string): Promise<ImportReport>` — orchestrates parse → resolve → hash → upsert → report.
  - `main(): Promise<void>` — CLI entrypoint, reads `process.argv[2]` as the file path, `process.argv[3] ?? 'gama'` as the tag, calls `importDeliveries`, prints the report.

- [ ] **Step 1: Write the failing DB-integration test**

```typescript
// scripts/dwh/__tests__/consignment-deliveries-run.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { join } from 'node:path';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';
import { importDeliveries } from '../../import-consignment-deliveries';

process.env.DW_NAME = `DWH_AlimentosNY_Test_consignment_run_${Date.now()}`;

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

const fixturePath = join(import.meta.dir, 'fixtures', 'despacho-sample.xlsx');

describe('importDeliveries', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
  }, 60_000);

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('first run inserts one row per non-blank product cell, with no price found (no Fact_Sales history in a fresh test DB)', async () => {
    const report = await importDeliveries(pool, fixturePath, 'gama');
    expect(report.inserted).toBe(3); // matches the fixture's 3 non-blank product cells
    expect(report.updated).toHaveLength(0);
    expect(report.unmappedStores).toHaveLength(0);
    expect(report.unmappedProducts).toHaveLength(0);
    expect(report.pricesNotFound.length).toBeGreaterThan(0); // fresh DB has no Fact_Sales rows to price against

    const rows = await pool.request().query(`SELECT QuantityDelivered, UnitPriceUsd FROM fact.Fact_ConsignmentDeliveries`);
    expect(rows.recordset).toHaveLength(3);
    expect(rows.recordset.every((r: { UnitPriceUsd: number | null }) => r.UnitPriceUsd === null)).toBe(true);
  });

  test('second run against the same unchanged file inserts nothing new and updates nothing', async () => {
    const report = await importDeliveries(pool, fixturePath, 'gama');
    expect(report.inserted).toBe(0);
    expect(report.updated).toHaveLength(0);

    const rows = await pool.request().query(`SELECT COUNT(*) AS Count FROM fact.Fact_ConsignmentDeliveries`);
    expect(rows.recordset[0].Count).toBe(3); // still 3, not 6 -- no duplicate inserts
  });

  test('re-importing after the employee corrects a quantity updates the existing row instead of duplicating it', async () => {
    // This is the scenario SourceRowKey/SourceRowContentHash was split for
    // (spec Section 3/6) -- write two versions of the same fixture (same
    // store/date/nota/product identity, different quantity) to a dedicated
    // path so this test doesn't interact with fixturePath's row counts used
    // by the tests above.
    const XLSX = await import('xlsx');
    const editFixturePath = join(import.meta.dir, 'fixtures', 'despacho-edit-in-place.xlsx');

    const buildFixture = (quantity: number) => {
      const wb = XLSX.utils.book_new();
      const data = [
        ['Nombre de Cliente', 'Fecha de Despacho', 'Orden de Compra', '4 Granos 500gr'],
        ['Gama Vizcaya', new Date(2026, 4, 5), 'F0050', quantity],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'GAMA');
      XLSX.writeFile(wb, editFixturePath);
    };

    buildFixture(18);
    const firstReport = await importDeliveries(pool, editFixturePath, 'gama');
    expect(firstReport.inserted).toBe(1);
    expect(firstReport.updated).toHaveLength(0);

    const afterFirst = await pool.request().query(`
      SELECT QuantityDelivered FROM fact.Fact_ConsignmentDeliveries
      WHERE NotaEntregaNum = 'F0050'
    `);
    expect(afterFirst.recordset).toHaveLength(1);
    expect(Number(afterFirst.recordset[0].QuantityDelivered)).toBe(18);

    // Employee corrects the quantity in the same workbook (same store, date, nota, product -- only quantity changes).
    buildFixture(20);
    const secondReport = await importDeliveries(pool, editFixturePath, 'gama');
    expect(secondReport.inserted).toBe(0);
    expect(secondReport.updated).toHaveLength(1);
    expect(secondReport.updated[0].oldQuantity).toBe(18);
    expect(secondReport.updated[0].newQuantity).toBe(20);

    const afterSecond = await pool.request().query(`
      SELECT QuantityDelivered FROM fact.Fact_ConsignmentDeliveries
      WHERE NotaEntregaNum = 'F0050'
    `);
    expect(afterSecond.recordset).toHaveLength(1); // still exactly one row, not two
    expect(Number(afterSecond.recordset[0].QuantityDelivered)).toBe(20);
  });

  test('a row whose product/store has no map entry is reported as unmapped, not silently dropped or crashed on', async () => {
    // Build a fixture with an unknown product column name inline for this test.
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const data = [
      ['Nombre de Cliente', 'Fecha de Despacho', 'Orden de Compra', 'Unknown Product XYZ'],
      ['Gama Express Chuao', new Date(2026, 4, 1), 'D9999', 3],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'GAMA');
    const badFixturePath = join(import.meta.dir, 'fixtures', 'despacho-unmapped-product.xlsx');
    XLSX.writeFile(wb, badFixturePath);

    const report = await importDeliveries(pool, badFixturePath, 'gama');
    expect(report.unmappedProducts).toContain('Unknown Product XYZ');
    expect(report.inserted).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consignment-deliveries-run.test.ts`
Expected: FAIL with "importDeliveries is not exported" or similar (function doesn't exist yet).

- [ ] **Step 3: Add the DB-resolution, pricing, and orchestration logic**

```typescript
// Append to scripts/import-consignment-deliveries.ts
import sql from 'mssql';
import { getDwhPool } from '@/lib/db/dwh-mssql';

export type ImportReport = {
  inserted: number;
  updated: { rowKey: string; oldQuantity: number; newQuantity: number }[];
  unmappedStores: string[];
  unmappedProducts: string[];
  pricesNotFound: { productKey: number; dateKey: number }[];
};

export async function resolveProductMap(
  pool: sql.ConnectionPool, sourceClientTag: string,
): Promise<Map<string, { productKey: number; isBoxUnit: boolean }>> {
  const result = await pool.request()
    .input('tag', sql.VarChar(40), sourceClientTag)
    .query(`SELECT ExcelProductName, ProductKey, IsBoxUnit FROM dwh.ConsignmentProductMap WHERE SourceClientTag = @tag`);
  return new Map(result.recordset.map((r: { ExcelProductName: string; ProductKey: number; IsBoxUnit: boolean }) =>
    [r.ExcelProductName, { productKey: r.ProductKey, isBoxUnit: r.IsBoxUnit }]));
}

export async function resolveCustomerKeys(
  pool: sql.ConnectionPool, customerCodes: string[],
): Promise<Map<string, number>> {
  if (customerCodes.length === 0) return new Map();
  const result = await pool.request().query(`
    SELECT RTRIM(CustomerCode) AS CustomerCode, CustomerKey
    FROM dim.Dim_Customer WHERE IsCurrent = 1
  `);
  const byCode = new Map(result.recordset.map((r: { CustomerCode: string; CustomerKey: number }) => [r.CustomerCode, r.CustomerKey]));
  const filtered = new Map<string, number>();
  for (const code of customerCodes) {
    const key = byCode.get(code);
    if (key !== undefined) filtered.set(code, key);
  }
  return filtered;
}

// As-of price lookup against Gama's own Fact_Sales history -- see spec
// Section 4. Includes every Gama CustomerKey (matriz + dormant per-store
// codes), not just the matriz, since Gama is billed one consolidated
// price regardless of which store received the goods. USD conversion
// uses the transaction's own DocumentExchangeRate, per the historical-
// USD-conversion design (2026-09-23-historical-usd-conversion-design.md)
// -- never a blanket current rate.
export async function lookupAsOfPrice(
  pool: sql.ConnectionPool, productKey: number, dateKey: number,
): Promise<number | null> {
  const result = await pool.request()
    .input('productKey', sql.Int, productKey)
    .input('dateKey', sql.Int, dateKey)
    .query(`
      SELECT TOP 1 (fs.NetAmount / NULLIF(fs.DocumentExchangeRate, 0)) / NULLIF(fs.QuantitySold, 0) AS UnitPriceUsd
      FROM fact.Fact_Sales fs
      WHERE fs.ProductKey = @productKey
        AND fs.CustomerKey IN (SELECT CustomerKey FROM dim.Dim_Customer WHERE LegalEntityKey = 26 AND IsCurrent = 1)
        AND fs.DateKey <= @dateKey
        AND fs.IsVoided = 0
      ORDER BY fs.DateKey DESC
    `);
  const price = result.recordset[0]?.UnitPriceUsd;
  return price === undefined || price === null ? null : Number(price);
}

export async function importDeliveries(
  pool: sql.ConnectionPool, filePath: string, sourceClientTag: string,
): Promise<ImportReport> {
  const parsedRows = parseWorkbook(filePath);
  const productMap = await resolveProductMap(pool, sourceClientTag);

  const unmappedStores = new Set<string>();
  const unmappedProducts = new Set<string>();
  const neededCustomerCodes = new Set<string>();
  for (const row of parsedRows) {
    const customerCode = STORE_MAP[row.storeName];
    if (customerCode === undefined) { unmappedStores.add(row.storeName); continue; }
    neededCustomerCodes.add(customerCode);
    if (!productMap.has(row.productName)) unmappedProducts.add(row.productName);
  }

  const report: ImportReport = {
    inserted: 0, updated: [], unmappedStores: [...unmappedStores], unmappedProducts: [...unmappedProducts], pricesNotFound: [],
  };

  const customerKeyByCode = await resolveCustomerKeys(pool, [...neededCustomerCodes]);
  const priceCache = new Map<string, number | null>();
  const fileName = filePath.split('/').pop() ?? filePath;

  for (const row of parsedRows) {
    const customerCode = STORE_MAP[row.storeName];
    if (customerCode === undefined) continue; // already recorded in unmappedStores
    const productEntry = productMap.get(row.productName);
    if (productEntry === undefined) continue; // already recorded in unmappedProducts
    const customerKey = customerKeyByCode.get(customerCode);
    if (customerKey === undefined) continue; // resolved code but no current Dim_Customer row -- shouldn't happen given Task 1's seed, but fail closed rather than crash

    const dateKey = toDateKey(row.date);
    const priceCacheKey = `${productEntry.productKey}|${dateKey}`;
    if (!priceCache.has(priceCacheKey)) {
      const price = await lookupAsOfPrice(pool, productEntry.productKey, dateKey);
      priceCache.set(priceCacheKey, price);
      if (price === null) report.pricesNotFound.push({ productKey: productEntry.productKey, dateKey });
    }
    const unitPriceUsd = priceCache.get(priceCacheKey) ?? null;
    const lineAmountUsd = unitPriceUsd === null ? null : Number((row.quantity * unitPriceUsd).toFixed(2));

    const rowKey = computeRowKey(sourceClientTag, customerCode, dateKey, row.notaEntregaNum, productEntry.productKey);
    const contentHash = computeContentHash(row.quantity);

    const existing = await pool.request()
      .input('rowKey', sql.VarChar(64), rowKey)
      .query(`SELECT SourceRowContentHash, QuantityDelivered FROM fact.Fact_ConsignmentDeliveries WHERE SourceRowKey = @rowKey`);

    if (existing.recordset.length === 0) {
      await pool.request()
        .input('dateKey', sql.Int, dateKey)
        .input('customerKey', sql.Int, customerKey)
        .input('productKey', sql.Int, productEntry.productKey)
        .input('nota', sql.VarChar(30), row.notaEntregaNum)
        .input('quantity', sql.Decimal(18, 5), row.quantity)
        .input('unitPrice', sql.Decimal(18, 5), unitPriceUsd)
        .input('lineAmount', sql.Decimal(18, 2), lineAmountUsd)
        .input('tag', sql.VarChar(40), sourceClientTag)
        .input('fileName', sql.VarChar(200), fileName)
        .input('rowKey', sql.VarChar(64), rowKey)
        .input('contentHash', sql.VarChar(64), contentHash)
        .query(`
          INSERT INTO fact.Fact_ConsignmentDeliveries
            (DateKey, CustomerKey, ProductKey, NotaEntregaNum, QuantityDelivered, UnitPriceUsd, LineAmountUsd, SourceClientTag, SourceFileName, SourceRowKey, SourceRowContentHash)
          VALUES (@dateKey, @customerKey, @productKey, @nota, @quantity, @unitPrice, @lineAmount, @tag, @fileName, @rowKey, @contentHash)
        `);
      report.inserted++;
    } else if (existing.recordset[0].SourceRowContentHash !== contentHash) {
      const oldQuantity = Number(existing.recordset[0].QuantityDelivered);
      await pool.request()
        .input('rowKey', sql.VarChar(64), rowKey)
        .input('quantity', sql.Decimal(18, 5), row.quantity)
        .input('unitPrice', sql.Decimal(18, 5), unitPriceUsd)
        .input('lineAmount', sql.Decimal(18, 2), lineAmountUsd)
        .input('contentHash', sql.VarChar(64), contentHash)
        .query(`
          UPDATE fact.Fact_ConsignmentDeliveries
          SET QuantityDelivered = @quantity, UnitPriceUsd = @unitPrice, LineAmountUsd = @lineAmount,
              SourceRowContentHash = @contentHash, LoadedAtUtc = SYSUTCDATETIME()
          WHERE SourceRowKey = @rowKey
        `);
      report.updated.push({ rowKey, oldQuantity, newQuantity: row.quantity });
    }
    // else: unchanged, skip
  }

  return report;
}

export async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('Usage: bun run scripts/import-consignment-deliveries.ts <path-to-xlsx> [sourceClientTag]');
  const sourceClientTag = process.argv[3] ?? 'gama';

  const pool = await getDwhPool();
  const report = await importDeliveries(pool, filePath, sourceClientTag);

  console.log(`✓ Inserted: ${report.inserted}`);
  console.log(`✓ Updated: ${report.updated.length}`);
  for (const u of report.updated) console.log(`  - ${u.rowKey}: ${u.oldQuantity} → ${u.newQuantity}`);
  if (report.unmappedStores.length > 0) console.log(`✗ Unmapped stores: ${report.unmappedStores.join(', ')}`);
  if (report.unmappedProducts.length > 0) console.log(`✗ Unmapped products: ${report.unmappedProducts.join(', ')}`);
  if (report.pricesNotFound.length > 0) console.log(`⚠ No price found for ${report.pricesNotFound.length} (productKey, dateKey) pair(s)`);
}

if (import.meta.main) {
  main()
    .then(() => { console.log('✓ Consignment delivery import completed'); process.exit(0); })
    .catch(error => { console.error('✗ Error running the consignment delivery import:', error); process.exit(1); });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consignment-deliveries-run.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Run the full test suite for this feature together to check for interaction issues**

Run: `bun test --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/consignment-deliveries-schema.test.ts scripts/dwh/__tests__/consignment-deliveries-import.test.ts scripts/dwh/__tests__/consignment-deliveries-run.test.ts`
Expected: PASS, all tests across all three files green.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-consignment-deliveries.ts scripts/dwh/__tests__/consignment-deliveries-run.test.ts
git commit -m "$(cat <<'EOF'
feat: add DB resolution, as-of pricing, and upsert to the consignment import

Resolves store/product identity against the migration's seeded maps,
prices each delivered line via an as-of lookup against Gama's own
Fact_Sales history (USD-converted per-row via DocumentExchangeRate,
never a blanket current rate), and upserts on SourceRowKey so
re-running against the employee's growing tracking file only inserts
new deliveries and updates ones whose quantity was corrected, rather
than duplicating on every run.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: First real import run against `despacho-excelsior-gama.xlsx`

**Files:**
- None created/modified — this task runs the script built in Tasks 1–3 against the real file and reports back.

**Interfaces:**
- Consumes: `main()` from Task 3, the real file at `~/Desktop/despacho-excelsior-gama.xlsx`.

- [ ] **Step 1: Copy the real file into the repo's scratch area (not committed) for a stable path**

Run: `cp ~/Desktop/despacho-excelsior-gama.xlsx /tmp/despacho-excelsior-gama.xlsx`
Expected: file copied.

- [ ] **Step 2: Run the migration against the real local DWH (if not already applied by Task 1)**

Run: `bun run migrate:dwh`
Expected: exits 0.

- [ ] **Step 3: Run the import script against the real file**

Run: `bun --env-file=.env.local run scripts/import-consignment-deliveries.ts /tmp/despacho-excelsior-gama.xlsx gama`
Expected: exits 0, prints an insert count in the low hundreds (the spec found 523 delivery rows across 12 product columns, so the flattened row count — one row per non-blank product cell — will be higher than 523; report the actual number back), and prints any unmapped stores/products (expected: none, since Task 1/2's maps were built directly against this file's real contents) and any `pricesNotFound` pairs (expected: some, for any product Gama hadn't yet been invoiced for as of a given delivery date — not an error, just a diagnostic).

- [ ] **Step 4: Spot-check the loaded data**

Run:
```bash
bun --env-file=.env.local -e "
import { getDwhPool } from './lib/db/dwh-mssql';
const pool = await getDwhPool();
const total = await pool.request().query('SELECT COUNT(*) AS Count FROM fact.Fact_ConsignmentDeliveries');
console.log('Total rows:', total.recordset[0].Count);
const byStore = await pool.request().query(\`
  SELECT c.CustomerName, COUNT(*) AS Lines, SUM(f.QuantityDelivered) AS TotalQty
  FROM fact.Fact_ConsignmentDeliveries f
  JOIN dim.Dim_Customer c ON c.CustomerKey = f.CustomerKey
  GROUP BY c.CustomerName ORDER BY Lines DESC
\`);
console.table(byStore.recordset);
process.exit(0);
"
```
Expected: total row count matches Step 3's insert count; 23 distinct stores appear (22 original + La Joya); no store shows an implausible total (e.g. one store with 10x the volume of every other).

- [ ] **Step 5: Re-run the import unchanged to confirm idempotency against the real file**

Run: `bun --env-file=.env.local run scripts/import-consignment-deliveries.ts /tmp/despacho-excelsior-gama.xlsx gama`
Expected: `Inserted: 0`, `Updated: 0` — the real file hasn't changed since Step 3, so nothing should move.

- [ ] **Step 6: Report findings back**

No commit for this task (no file changes) — summarize in chat: total rows loaded, date range confirmed, any unmapped stores/products (should be none), how many `pricesNotFound` pairs and which products/dates they cover, and the per-store breakdown table from Step 4.

---

## Self-Review Notes

**Spec coverage:** Section 1 (store reuse + La Joya insert) → Task 1. Section 2 (product map + Cj caveat) → Task 1's seed. Section 3 (fact table + row/content hash split) → Task 1's schema, Task 2's hash functions. Section 4 (as-of pricing, USD conversion) → Task 3's `lookupAsOfPrice`. Section 5 (structural separation from `Fact_Sales`) → satisfied by construction, no shared writes anywhere in Tasks 1–3. Section 6 (re-runnable import, diagnostic report) → Task 3's upsert logic and `ImportReport`. Deliverable 3 (first import run) → Task 4.

**Type consistency:** `ParsedRow`, `ImportReport`, `STORE_MAP`'s value type (`string` = `CustomerCode`), and every function signature referenced across Tasks 2–3 match on first use and on later use.

**Review Focus coverage:** all 5 items each have an owning test — re-import-after-edit (Task 3's dedicated "re-importing after the employee corrects a quantity" test: same identity, changed quantity, asserts exactly one row survives with the new value and `report.updated` names the old→new transition), unmapped store/product hard-stop (Task 3's "unmapped" test), null pricing (Task 3's first test, against a fresh DB with no `Fact_Sales` history), `IsBoxUnit` visibility (Task 1's schema test), blank-cell rows producing no phantom fact row (Task 2's `parseWorkbook` tests, including a row where every product column is blank).
