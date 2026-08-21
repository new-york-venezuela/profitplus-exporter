# Inventory Adjustment Procedure — Migration Mechanism + Stored Procedure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a migration mechanism for the Profit Plus MSSQL
database (independent from the existing SQLite/Drizzle migrations) and
deploy `pApiCrearAjusteInventario`, an atomic stored procedure that
wraps the ERP's 3-step adjustment write path in one transaction, plus
the two new `saTipoAjuste` rows the manual-recount workflow needs.

**Architecture:** A new top-level `mssql-migrations/` directory of
numbered `.sql` files, applied by a standalone script
(`scripts/migrate-mssql.ts`, run via `bun run migrate:mssql`) that
tracks what's already been applied in a new `dbo.__exporter_migrations`
table living inside Profit Plus itself. This mirrors the shape of the
existing `drizzle/migrations/` + `bun run migrate` pair closely enough
to be familiar, while staying a fully separate code path — no import
from `drizzle-orm` anywhere in the new script, since it targets a
different database with a different deploy story (a shared ERP, not an
app-owned SQLite file). The stored procedure itself is pure SQL,
deployed as data via the migration runner; this plan does not add any
Next.js route that calls it (that's Plan 4) — tests call it directly
via the `mssql` package.

**Tech Stack:** `mssql` npm package (already a dependency, used by
`lib/db/mssql.ts`), Bun (`bun run <script>.ts`), TypeScript, `bun test`
(direct-DB integration tests, following the pattern already used by
`__tests__/integration/admin-inventory-config.integration.test.ts` from
Plan 1 — this plan tests against the real dev MSSQL instance instead of
SQLite).

**Spec:** `docs/superpowers/specs/2026-08-20-inventory-adjustment-procedure-design.md`

## Global Constraints

- This plan is scoped to the database side only. No Next.js API route
  calls this procedure — that's Plan 4 (spec, Goal). Do not add one.
- The migration runner connects using the exact same env vars
  `lib/db/mssql.ts` already reads: `DB_SERVER`, `DB_PORT`, `DB_NAME`,
  `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERT`. No new
  env vars (spec, Data Model).
- The runner uses a fresh, one-off `mssql` connection
  (`new sql.ConnectionPool(...).connect()`), not `lib/db/mssql.ts`'s
  pooled singleton — it's a standalone script, not a running server
  (spec, Data Model).
- Files with `GO` batch separators (only migration `0002`, which
  creates a TVP type and a stored procedure) must be split on lines
  containing only `GO` and each batch run separately via the `mssql`
  package's `request.batch()` — **verified necessary during the design
  phase**: `.query()` does not accept the multi-statement DDL shape
  `CREATE TYPE ... GO CREATE PROCEDURE ...` requires; `CREATE TYPE
  AjusteInventarioLineaType` and `CREATE PROCEDURE
  pApiCrearAjusteInventario` must be genuinely separate batches (spec,
  "New migration mechanism").
- `co_mone='BS    '` (padded to `char(6)`) and `tasa=1` are hardcoded in
  the procedure — this is the verified real base-currency code for this
  database, **not** `'VES'` (spec, "Three bugs..." #1). Multi-currency
  adjustments are out of scope.
- The adjustment number is returned via the `@sAjueNumOut` **OUTPUT
  parameter**, never a trailing `SELECT` — reading it any other way
  risks silently getting the wrong resultset back, since the nested ERP
  procedures produce resultsets of their own (spec, "Three bugs..." #2).
- The procedure wraps its body in explicit `BEGIN TRY`/`BEGIN CATCH`
  with a manual `ROLLBACK TRAN` guarded by `XACT_STATE() <> 0` —
  `XACT_ABORT ON` alone is **verified insufficient**: it left an orphan
  `saAjuste` header row on a negative-stock rejection during design
  testing (spec, "Three bugs..." #3). Do not simplify this to
  `SET XACT_ABORT ON` alone.
- Every integration test in this plan runs against the real dev MSSQL
  database (the `profitplus-erp-mock` Docker container, `DB_NAME` from
  `.env`/`.env.example`'s `MSSQL Docker Mock` section) — there is no
  mocked/in-memory MSSQL option in this codebase. Tests must clean up
  after themselves using **snapshot-and-restore**, not delta arithmetic
  — a delta-based cleanup script written during the design phase used
  unparameterized string interpolation and corrupted a real
  `saStockAlmacen.stock` value by orders of magnitude before being
  caught (spec, Testing). Capture the exact `stock` value before a test
  runs and restore it with a parameterized `UPDATE ... SET stock =
  @capturedValue` afterward.
- `char`/`varchar` columns read back from MSSQL are space-padded; use
  `lib/trim-strings.ts`'s `trimStrings()` (already used elsewhere in
  this codebase) or `.trim()` directly on any string comparison in a
  test, never compare an untrimmed value in an assertion (spec, Testing
  item 8).

---

## File Structure

```
mssql-migrations/0001_create_migrations_table.sql   — NEW: dbo.__exporter_migrations
mssql-migrations/0002_pApiCrearAjusteInventario.sql — NEW: TVP type + stored procedure
mssql-migrations/0003_seed_manual_recount_tipos.sql — NEW: saTipoAjuste E00003/S00005 seed

scripts/migrate-mssql.ts                            — NEW: migration runner

package.json                                        — MODIFY: add "migrate:mssql" script

__tests__/integration/mssql-migrate.integration.test.ts               — NEW
__tests__/integration/pApiCrearAjusteInventario.integration.test.ts   — NEW
```

---

### Task 1: Migration runner + `0001_create_migrations_table.sql`

**Files:**
- Create: `mssql-migrations/0001_create_migrations_table.sql`
- Create: `scripts/migrate-mssql.ts`
- Modify: `package.json`
- Test: `__tests__/integration/mssql-migrate.integration.test.ts`

**Interfaces:**
- Produces: `dbo.__exporter_migrations(name VARCHAR(255) PRIMARY KEY,
  applied_at DATETIME2)` in the target MSSQL database, and a
  `runMigrations(): Promise<string[]>` function exported from
  `scripts/migrate-mssql.ts` (returns the list of migration filenames
  that were newly applied this run — empty array if everything was
  already applied) that later tasks' tests call directly instead of
  shelling out, and that `bun run migrate:mssql` (the CLI entry point)
  also calls.

This task builds the whole runner but only ships migration `0001` — the
runner's own bootstrap table. Tasks 2 and 3 add `.sql` files under the
same `mssql-migrations/` directory; no runner code changes for those,
since the runner reads the directory generically.

- [ ] **Step 1: Write the failing integration test**

Create `__tests__/integration/mssql-migrate.integration.test.ts`:

```typescript
import { describe, test, expect, afterAll } from 'bun:test';
import sql from 'mssql';
import { runMigrations } from '@/scripts/migrate-mssql';

function buildTestConfig(): sql.config {
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

let testPool: sql.ConnectionPool;

afterAll(async () => {
  if (testPool?.connected) await testPool.close();
});

describe('mssql migration runner', () => {
  test('applies migration 0001 and creates the tracking table', async () => {
    const applied = await runMigrations();
    expect(applied).toContain('0001_create_migrations_table.sql');

    testPool = await new sql.ConnectionPool(buildTestConfig()).connect();
    const result = await testPool.request().query(
      `SELECT name FROM dbo.__exporter_migrations WHERE name = '0001_create_migrations_table.sql'`
    );
    expect(result.recordset).toHaveLength(1);
  });

  test('running twice is idempotent — second run applies nothing new', async () => {
    await runMigrations();
    const secondRun = await runMigrations();
    expect(secondRun).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test __tests__/integration/mssql-migrate.integration.test.ts`
Expected: FAIL — cannot find module `@/scripts/migrate-mssql` (or the
file exists with no `runMigrations` export, depending on order of
work — either way, a clear failure, not a pass).

- [ ] **Step 3: Write migration `0001`**

Create `mssql-migrations/0001_create_migrations_table.sql`:

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__exporter_migrations' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.__exporter_migrations (
        name        VARCHAR(255)  NOT NULL PRIMARY KEY,
        applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
```

The `IF NOT EXISTS` guard makes this file safe even outside the
runner's own tracking logic (belt-and-suspenders, matching the pattern
migration `0003` will also use for its data-only insert).

- [ ] **Step 4: Implement the migration runner**

Create `scripts/migrate-mssql.ts`:

```typescript
import sql from 'mssql';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'mssql-migrations');

function buildConfig(): sql.config {
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

async function ensureTrackingTableExists(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__exporter_migrations' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
        CREATE TABLE dbo.__exporter_migrations (
            name        VARCHAR(255)  NOT NULL PRIMARY KEY,
            applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
        );
    END
  `);
}

async function getAppliedMigrationNames(pool: sql.ConnectionPool): Promise<Set<string>> {
  const result = await pool.request().query(`SELECT name FROM dbo.__exporter_migrations`);
  return new Set(result.recordset.map((row: { name: string }) => row.name));
}

function splitIntoBatches(fileContents: string): string[] {
  return fileContents
    .split(/^\s*GO\s*$/im)
    .map(batch => batch.trim())
    .filter(batch => batch.length > 0);
}

export async function runMigrations(): Promise<string[]> {
  const pool = await new sql.ConnectionPool(buildConfig()).connect();

  try {
    await ensureTrackingTableExists(pool);
    const applied = await getAppliedMigrationNames(pool);

    const allFiles = (await readdir(MIGRATIONS_DIR))
      .filter(name => name.endsWith('.sql'))
      .sort();

    const newlyApplied: string[] = [];

    for (const fileName of allFiles) {
      if (applied.has(fileName)) continue;

      const contents = await readFile(join(MIGRATIONS_DIR, fileName), 'utf-8');
      const batches = splitIntoBatches(contents);

      for (const batch of batches) {
        await pool.request().batch(batch);
      }

      await pool.request()
        .input('name', sql.VarChar(255), fileName)
        .query(`INSERT INTO dbo.__exporter_migrations (name) VALUES (@name)`);

      newlyApplied.push(fileName);
    }

    return newlyApplied;
  } finally {
    await pool.close();
  }
}

if (import.meta.main) {
  runMigrations()
    .then(applied => {
      if (applied.length === 0) {
        console.log('✓ No hay migraciones nuevas que aplicar');
      } else {
        console.log(`✓ Migraciones aplicadas: ${applied.join(', ')}`);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('✗ Error aplicando migraciones:', error);
      process.exit(1);
    });
}
```

Note: migration `0001`'s own SQL is never actually read from disk on a
truly fresh database in this implementation — `ensureTrackingTableExists`
creates the table directly before the loop even starts, and the loop
then finds `0001_create_migrations_table.sql` already covered by that
same `IF NOT EXISTS` when it runs the file's batch (a harmless no-op),
then records it as applied. This keeps the special-casing described in
the spec ("migration 0001 is special-cased") to just this one function,
rather than needing an `if (fileName === '0001...')` branch in the main
loop.

- [ ] **Step 5: Add the `migrate:mssql` script**

Edit `package.json` — add this line to `"scripts"`, right after the
existing `"migrate"` entry:

```json
"migrate:mssql": "bun --bun run scripts/migrate-mssql.ts",
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test __tests__/integration/mssql-migrate.integration.test.ts`
Expected: PASS (2 tests). If it fails with a connection error, confirm
the `profitplus-erp-mock` Docker container is running (`docker ps`) and
`.env` has the `DB_SERVER`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`
values from `.env.example`'s "MSSQL Docker Mock" section.

- [ ] **Step 7: Commit**

```bash
git add mssql-migrations/0001_create_migrations_table.sql scripts/migrate-mssql.ts package.json __tests__/integration/mssql-migrate.integration.test.ts
git commit -m "feat: add mssql-migrations runner (bun run migrate:mssql)"
```

---

### Task 2: `pApiCrearAjusteInventario` stored procedure (migration 0002)

**Files:**
- Create: `mssql-migrations/0002_pApiCrearAjusteInventario.sql`
- Test: `__tests__/integration/pApiCrearAjusteInventario.integration.test.ts`

**Interfaces:**
- Consumes: `runMigrations()` from `scripts/migrate-mssql.ts` (Task 1)
  — the test file's `beforeAll` applies migrations before exercising
  the procedure.
- Produces: the SQL Server type `AjusteInventarioLineaType` and stored
  procedure `pApiCrearAjusteInventario` in the target database. Plan
  4's future API route will call this procedure directly via the
  `mssql` package — its signature (below) is the contract that route
  will depend on.

Procedure signature (exact — this is what callers use):
```sql
pApiCrearAjusteInventario(
    @sMotivo VARCHAR(80),
    @dtFecha SMALLDATETIME,
    @sCoUsIn CHAR(6),
    @sCoSucuIn CHAR(6),
    @Lineas AjusteInventarioLineaType READONLY,   -- co_tipo, co_art, co_alma, co_uni, total_art, cost_unit, permitir_negativo
    @sAjueNumOut CHAR(20) OUTPUT
)
```

- [ ] **Step 1: Write the failing integration test**

Create `__tests__/integration/pApiCrearAjusteInventario.integration.test.ts`.

This test needs real warehouse `14` (verified in the spec to carry real
stock) and a real article code with `saArtUnidad` coverage for that
warehouse. Rather than hardcode a guessed article code, the test's
`beforeAll` looks one up live — this keeps the test correct regardless
of which specific articles exist in whatever dev DB instance runs it,
matching how the spec's own verification worked:

```typescript
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import sql from 'mssql';
import { runMigrations } from '@/scripts/migrate-mssql';

function buildTestConfig(): sql.config {
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

let pool: sql.ConnectionPool;
let testArticle: { co_art: string; co_uni: string };
let stockSnapshot: number;
let secondArticle: { co_art: string; co_uni: string } | null = null;
let secondStockSnapshot: number | null = null;
let pricedArticle: { co_art: string; co_uni: string; expectedCost: number } | null = null;
const WAREHOUSE = '14';

function buildLineasTable(lines: Array<{
  co_tipo: string; co_art: string; co_alma: string; co_uni: string;
  total_art: number; cost_unit: number | null; permitir_negativo: boolean;
}>): sql.Table {
  const table = new sql.Table('AjusteInventarioLineaType');
  table.columns.add('co_tipo', sql.Char(6));
  table.columns.add('co_art', sql.Char(30));
  table.columns.add('co_alma', sql.Char(6));
  table.columns.add('co_uni', sql.Char(6));
  table.columns.add('total_art', sql.Decimal(18, 5));
  table.columns.add('cost_unit', sql.Decimal(18, 5));
  table.columns.add('permitir_negativo', sql.Bit);
  for (const line of lines) {
    table.rows.add(
      line.co_tipo, line.co_art, line.co_alma, line.co_uni,
      line.total_art, line.cost_unit, line.permitir_negativo,
    );
  }
  return table;
}

async function callProcedure(lines: Parameters<typeof buildLineasTable>[0]) {
  const request = pool.request();
  request.input('sMotivo', sql.VarChar(80), 'Integration test adjustment');
  request.input('dtFecha', sql.SmallDateTime, new Date());
  request.input('sCoUsIn', sql.Char(6), 'PROFIT');
  request.input('sCoSucuIn', sql.Char(6), null);
  request.input('Lineas', buildLineasTable(lines));
  request.output('sAjueNumOut', sql.Char(20));
  return request.execute('pApiCrearAjusteInventario');
}

async function getStock(coArt: string, coAlma: string): Promise<number> {
  const result = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .query(`SELECT stock FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
  return result.recordset[0]?.stock ?? 0;
}

async function restoreStock(coArt: string, coAlma: string, value: number): Promise<void> {
  await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .input('value', sql.Decimal(18, 5), value)
    .query(`UPDATE saStockAlmacen SET stock = @value WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
}

async function cleanupAjuste(ajueNum: string): Promise<void> {
  await pool.request().input('n', sql.Char(20), ajueNum)
    .query(`DELETE FROM saAjusteReng WHERE ajue_num = @n`);
  await pool.request().input('n', sql.Char(20), ajueNum)
    .query(`DELETE FROM saAjuste WHERE ajue_num = @n`);
}

beforeAll(async () => {
  await runMigrations();
  pool = await new sql.ConnectionPool(buildTestConfig()).connect();

  const articleResult = await pool.request()
    .input('coAlma', sql.Char(6), WAREHOUSE)
    .query(`
      SELECT TOP 1 s.co_art, au.co_uni
      FROM saStockAlmacen s
      JOIN saArtUnidad au ON au.co_art = s.co_art
      WHERE s.co_alma = @coAlma AND s.tipo = 'ACT' AND s.stock > 10
    `);
  if (articleResult.recordset.length === 0) {
    throw new Error(`No article with stock > 10 found in warehouse ${WAREHOUSE} for test setup`);
  }
  testArticle = {
    co_art: (articleResult.recordset[0].co_art as string).trim(),
    co_uni: (articleResult.recordset[0].co_uni as string).trim(),
  };
  stockSnapshot = await getStock(testArticle.co_art, WAREHOUSE);

  const secondArticleResult = await pool.request()
    .input('coAlma', sql.Char(6), WAREHOUSE)
    .input('excludeArt', sql.Char(30), testArticle.co_art)
    .query(`
      SELECT TOP 1 s.co_art, au.co_uni
      FROM saStockAlmacen s
      JOIN saArtUnidad au ON au.co_art = s.co_art
      WHERE s.co_alma = @coAlma AND s.tipo = 'ACT' AND s.stock > 10
        AND s.co_art <> @excludeArt
    `);
  if (secondArticleResult.recordset.length > 0) {
    secondArticle = {
      co_art: (secondArticleResult.recordset[0].co_art as string).trim(),
      co_uni: (secondArticleResult.recordset[0].co_uni as string).trim(),
    };
    secondStockSnapshot = await getStock(secondArticle.co_art, WAREHOUSE);
  }

  const pricedArticleResult = await pool.request()
    .query(`
      SELECT TOP 1 A.co_art, au.co_uni, CHE.costo
      FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
      JOIN saArtUnidad au ON au.co_art = A.co_art
      ORDER BY CHE.fecha_emision DESC
    `);
  if (pricedArticleResult.recordset.length > 0) {
    pricedArticle = {
      co_art: (pricedArticleResult.recordset[0].co_art as string).trim(),
      co_uni: (pricedArticleResult.recordset[0].co_uni as string).trim(),
      expectedCost: Number(pricedArticleResult.recordset[0].costo),
    };
  }
});

afterEach(async () => {
  await restoreStock(testArticle.co_art, WAREHOUSE, stockSnapshot);
  if (secondArticle && secondStockSnapshot !== null) {
    await restoreStock(secondArticle.co_art, WAREHOUSE, secondStockSnapshot);
  }
});

afterAll(async () => {
  if (pool?.connected) await pool.close();
});

describe('pApiCrearAjusteInventario', () => {
  test('creates a header, line, and updates stock for a single entrada line', async () => {
    const result = await callProcedure([{
      co_tipo: 'E00003', co_art: testArticle.co_art, co_alma: WAREHOUSE,
      co_uni: testArticle.co_uni, total_art: 5, cost_unit: null, permitir_negativo: false,
    }]);

    const ajueNum = (result.output.sAjueNumOut as string).trim();
    expect(ajueNum.length).toBeGreaterThan(0);

    const newStock = await getStock(testArticle.co_art, WAREHOUSE);
    expect(newStock).toBe(stockSnapshot + 5);

    const lineCheck = await pool.request().input('n', sql.Char(20), ajueNum)
      .query(`SELECT co_art, total_art FROM saAjusteReng WHERE ajue_num = @n`);
    expect(lineCheck.recordset).toHaveLength(1);
    expect((lineCheck.recordset[0].co_art as string).trim()).toBe(testArticle.co_art);

    await cleanupAjuste(ajueNum);
  });

  test('a single call with one entrada line and one salida line applies both correctly', async () => {
    if (!secondArticle || secondStockSnapshot === null) {
      throw new Error('Need a second distinct stocked article in warehouse 14 for the multi-line test');
    }

    const result = await callProcedure([
      {
        co_tipo: 'E00003', co_art: testArticle.co_art, co_alma: WAREHOUSE,
        co_uni: testArticle.co_uni, total_art: 3, cost_unit: null, permitir_negativo: false,
      },
      {
        co_tipo: 'S00005', co_art: secondArticle.co_art, co_alma: WAREHOUSE,
        co_uni: secondArticle.co_uni, total_art: 2, cost_unit: null, permitir_negativo: false,
      },
    ]);
    const ajueNum = (result.output.sAjueNumOut as string).trim();

    expect(await getStock(testArticle.co_art, WAREHOUSE)).toBe(stockSnapshot + 3);
    expect(await getStock(secondArticle.co_art, WAREHOUSE)).toBe(secondStockSnapshot - 2);

    const lineCheck = await pool.request().input('n', sql.Char(20), ajueNum)
      .query(`SELECT co_art FROM saAjusteReng WHERE ajue_num = @n ORDER BY reng_num`);
    expect(lineCheck.recordset).toHaveLength(2);

    await cleanupAjuste(ajueNum);
  });

  test('cost lookup resolves the most recent saCostoHistoricoEntrada entry for a priced article', async () => {
    if (!pricedArticle) {
      throw new Error('No article with saCostoHistoricoEntrada rows found for this test scenario');
    }

    const beforeStock = await getStock(pricedArticle.co_art, WAREHOUSE);
    const result = await callProcedure([{
      co_tipo: 'E00003', co_art: pricedArticle.co_art, co_alma: WAREHOUSE,
      co_uni: pricedArticle.co_uni, total_art: 1, cost_unit: null, permitir_negativo: true,
    }]);
    const ajueNum = (result.output.sAjueNumOut as string).trim();

    const lineCheck = await pool.request().input('n', sql.Char(20), ajueNum)
      .query(`SELECT cost_unit FROM saAjusteReng WHERE ajue_num = @n`);
    expect(Number(lineCheck.recordset[0].cost_unit)).toBe(pricedArticle.expectedCost);

    await cleanupAjuste(ajueNum);
    await restoreStock(pricedArticle.co_art, WAREHOUSE, beforeStock);
  });

  test('rejects negative stock and leaves no trace (header, line, stock all unchanged)', async () => {
    const beforeCount = (await pool.request()
      .query(`SELECT COUNT(*) AS c FROM saAjuste`)).recordset[0].c;

    await expect(callProcedure([{
      co_tipo: 'S00005', co_art: testArticle.co_art, co_alma: WAREHOUSE,
      co_uni: testArticle.co_uni, total_art: stockSnapshot + 1000,
      cost_unit: null, permitir_negativo: false,
    }])).rejects.toThrow();

    const afterCount = (await pool.request()
      .query(`SELECT COUNT(*) AS c FROM saAjuste`)).recordset[0].c;
    expect(afterCount).toBe(beforeCount);

    const stockAfter = await getStock(testArticle.co_art, WAREHOUSE);
    expect(stockAfter).toBe(stockSnapshot);
  });

  test('allows negative stock when permitir_negativo is true', async () => {
    const result = await callProcedure([{
      co_tipo: 'S00005', co_art: testArticle.co_art, co_alma: WAREHOUSE,
      co_uni: testArticle.co_uni, total_art: stockSnapshot + 100,
      cost_unit: null, permitir_negativo: true,
    }]);
    const ajueNum = (result.output.sAjueNumOut as string).trim();

    const newStock = await getStock(testArticle.co_art, WAREHOUSE);
    expect(newStock).toBe(stockSnapshot - 100);

    await cleanupAjuste(ajueNum);
  });

  test('falls back to cost 0 when cost_unit is null and no cost history exists', async () => {
    const noCostArticle = await pool.request()
      .query(`
        SELECT TOP 1 A.co_art
        FROM saArticulo A
        WHERE NOT EXISTS (SELECT 1 FROM saCostoHistoricoEntrada CHE WHERE CHE.cod_articulo_rowguid = A.rowguid)
          AND EXISTS (SELECT 1 FROM saArtUnidad au WHERE au.co_art = A.co_art)
      `);
    if (noCostArticle.recordset.length === 0) {
      throw new Error('No article without cost history found for this test scenario');
    }
    const coArt = (noCostArticle.recordset[0].co_art as string).trim();
    const uniResult = await pool.request().input('a', sql.Char(30), coArt)
      .query(`SELECT TOP 1 co_uni FROM saArtUnidad WHERE co_art = @a`);
    const coUni = (uniResult.recordset[0].co_uni as string).trim();

    const result = await callProcedure([{
      co_tipo: 'E00003', co_art: coArt, co_alma: WAREHOUSE,
      co_uni: coUni, total_art: 1, cost_unit: null, permitir_negativo: true,
    }]);
    const ajueNum = (result.output.sAjueNumOut as string).trim();

    const lineCheck = await pool.request().input('n', sql.Char(20), ajueNum)
      .query(`SELECT cost_unit FROM saAjusteReng WHERE ajue_num = @n`);
    expect(Number(lineCheck.recordset[0].cost_unit)).toBe(0);

    await cleanupAjuste(ajueNum);
    await restoreStock(coArt, WAREHOUSE, await getStock(coArt, WAREHOUSE) - 1);
  });

  test('the saTipoAjuste rows used above are seeded by migration 0003 as entrada/salida', async () => {
    const rows = await pool.request()
      .query(`SELECT co_tipo, tipo_trans FROM saTipoAjuste WHERE co_tipo IN ('E00003', 'S00005')`);
    const byCode = new Map(rows.recordset.map((r: { co_tipo: string; tipo_trans: string }) => [r.co_tipo.trim(), r.tipo_trans.trim()]));
    expect(byCode.get('E00003')).toBe('0');
    expect(byCode.get('S00005')).toBe('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test __tests__/integration/pApiCrearAjusteInventario.integration.test.ts`
Expected: FAIL — `pApiCrearAjusteInventario` doesn't exist yet
(`beforeAll` itself may also fail depending on test data availability;
if `beforeAll` throws "No article with stock > 10 found in warehouse
14", the dev DB's warehouse 14 needs a stocked article — check
`saStockAlmacen` directly and adjust the `> 10` threshold or warehouse
if needed, this is dev-data dependent, not a code bug).

- [ ] **Step 3: Write migration `0002`**

Create `mssql-migrations/0002_pApiCrearAjusteInventario.sql`:

```sql
IF EXISTS (SELECT 1 FROM sys.types WHERE name = 'AjusteInventarioLineaType')
    DROP TYPE AjusteInventarioLineaType;
GO

CREATE TYPE AjusteInventarioLineaType AS TABLE (
    co_tipo            CHAR(6)         NOT NULL,
    co_art             CHAR(30)        NOT NULL,
    co_alma            CHAR(6)         NOT NULL,
    co_uni             CHAR(6)         NOT NULL,
    total_art          DECIMAL(18,5)   NOT NULL,
    cost_unit          DECIMAL(18,5)   NULL,
    permitir_negativo  BIT             NOT NULL
);
GO

IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'pApiCrearAjusteInventario')
    DROP PROCEDURE pApiCrearAjusteInventario;
GO

CREATE PROCEDURE [pApiCrearAjusteInventario]
    (
      @sMotivo VARCHAR(80),
      @dtFecha SMALLDATETIME,
      @sCoUsIn CHAR(6),
      @sCoSucuIn CHAR(6),
      @Lineas AjusteInventarioLineaType READONLY,
      @sAjueNumOut CHAR(20) OUTPUT
    )
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        EXEC pConsecutivoProximoOutPut
            @sCo_Sucur = @sCoSucuIn,
            @sCo_Consecutivo = 'AJUS_NUM',
            @strConsecutivoResult = @sAjueNumOut OUTPUT;

        EXEC pInsertarAjusteEntradaSalida
            @sAjue_Num = @sAjueNumOut, @sCo_Mone = 'BS    ', @sMotivo = @sMotivo,
            @sdFecha = @dtFecha, @deTasa = 1, @bAnulado = 0,
            @deAux01 = 0, @sAux02 = '', @sCo_Us_In = @sCoUsIn,
            @sCo_Sucu_In = @sCoSucuIn;

        DECLARE @RengNum INT = 1;
        DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
            SELECT co_tipo, co_art, co_alma, co_uni, total_art, cost_unit, permitir_negativo
            FROM @Lineas;

        DECLARE @co_tipo CHAR(6), @co_art CHAR(30), @co_alma CHAR(6),
                @co_uni CHAR(6), @total_art DECIMAL(18,5),
                @cost_unit DECIMAL(18,5), @permitir_negativo BIT;

        OPEN cur;
        FETCH NEXT FROM cur INTO @co_tipo, @co_art, @co_alma, @co_uni,
            @total_art, @cost_unit, @permitir_negativo;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF @cost_unit IS NULL
                SELECT TOP 1 @cost_unit = CHE.costo
                FROM saCostoHistoricoEntrada CHE
                JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
                WHERE A.co_art = @co_art
                ORDER BY CHE.fecha_emision DESC;

            SET @cost_unit = ISNULL(@cost_unit, 0);

            EXEC pInsertarRenglonesAjusteEntradaSalida
                @sAjue_Num = @sAjueNumOut, @iReng_Num = @RengNum,
                @sCo_Tipo = @co_tipo, @sCo_Art = @co_art, @sCo_Alma = @co_alma,
                @sCo_Uni = @co_uni, @sSco_Uni = @co_uni,
                @deTotal_Art = @total_art, @deStotal_Art = @total_art,
                @deCost_Unit = @cost_unit, @deCosto_Adi1 = @cost_unit,
                @deCosto_Adi2 = 0, @deCosto_Adi3 = 0,
                @sCo_Us_In = @sCoUsIn, @sCo_Sucu_In = @sCoSucuIn;

            DECLARE @bSumar BIT;
            SELECT @bSumar = CASE WHEN tipo_trans = '0' THEN 1 ELSE 0 END
            FROM saTipoAjuste WHERE co_tipo = @co_tipo;

            EXEC pStockActualizar
                @sCo_Alma = @co_alma, @sCo_Art = @co_art, @sCo_Uni = @co_uni,
                @deCantidad = @total_art, @sTipoStock = 'ACT',
                @bSumarStock = @bSumar, @bPermiteStockNegativo = @permitir_negativo;

            SET @RengNum += 1;
            FETCH NEXT FROM cur INTO @co_tipo, @co_art, @co_alma, @co_uni,
                @total_art, @cost_unit, @permitir_negativo;
        END
        CLOSE cur;
        DEALLOCATE cur;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrState INT = ERROR_STATE();

        IF @@TRANCOUNT > 0 AND XACT_STATE() <> 0
            ROLLBACK TRAN;

        IF CURSOR_STATUS('local', 'cur') >= 0
        BEGIN
            CLOSE cur;
            DEALLOCATE cur;
        END

        RAISERROR('%s', @ErrSeverity, @ErrState, @ErrMsg);
        RETURN;
    END CATCH
END
GO
```

This is the exact procedure body verified live during the design phase
(spec, "Migration 0002" section) — copied as-is, not re-derived. The
`DROP TYPE`/`DROP PROCEDURE IF EXISTS` guards at the top make this
migration file safe to hand-run again outside the tracking table (same
belt-and-suspenders reasoning as migration `0001`/`0003`), and matter
in practice: `CREATE TYPE`/`CREATE PROCEDURE` both fail if the object
already exists, unlike `CREATE TABLE`'s `IF NOT EXISTS` pattern.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test __tests__/integration/pApiCrearAjusteInventario.integration.test.ts`
Expected: PASS (7 tests). If the negative-stock test fails because the
call did NOT throw, re-check the migration file was actually applied
with the `BEGIN TRY`/`CATCH` version (not an older draft) — re-run
`bun run migrate:mssql` after confirming the `.sql` file content, since
the runner skips a migration name it's already recorded even if the
file's contents changed. If you need to force a re-apply during
development, manually `DELETE FROM
dbo.__exporter_migrations WHERE name = '0002_pApiCrearAjusteInventario.sql'`
first.

- [ ] **Step 5: Commit**

```bash
git add mssql-migrations/0002_pApiCrearAjusteInventario.sql __tests__/integration/pApiCrearAjusteInventario.integration.test.ts
git commit -m "feat: add pApiCrearAjusteInventario stored procedure"
```

---

### Task 3: Seed manual-recount `saTipoAjuste` rows (migration 0003)

**Files:**
- Create: `mssql-migrations/0003_seed_manual_recount_tipos.sql`

**Interfaces:**
- Consumes: nothing new — `saTipoAjuste` already exists in Profit
  Plus.
- Produces: two new catalog rows, `E00003` and `S00005`, which Task
  2's tests already exercise (its last test asserts these exist with
  the right `tipo_trans`) and which any test in Task 2 run before this
  migration is applied would fail on. Task order matters: this task
  must land before Task 2's tests can pass, so implement it first if
  working sequentially, or note the dependency if dispatching Task 2
  and Task 3 to different workers.

This task is a single data-only SQL file with no corresponding new
test file of its own — Task 2's Step 1 test (specifically its last
`describe` block, "the saTipoAjuste rows used above...") is the test
coverage for this migration, since the two are inseparable in practice
(Task 2's other tests use `E00003`/`S00005` as their `co_tipo` values).

- [ ] **Step 1: Write migration `0003`**

Create `mssql-migrations/0003_seed_manual_recount_tipos.sql`:

```sql
IF NOT EXISTS (SELECT 1 FROM saTipoAjuste WHERE co_tipo = 'E00003')
    INSERT INTO saTipoAjuste (co_tipo, des_tipo, tipo_trans, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo)
    VALUES ('E00003', 'Ajuste Por Conteo Manual (Sobrante)', '0', 'PROFIT', NULL, GETDATE(), 'PROFIT', NULL, GETDATE());

IF NOT EXISTS (SELECT 1 FROM saTipoAjuste WHERE co_tipo = 'S00005')
    INSERT INTO saTipoAjuste (co_tipo, des_tipo, tipo_trans, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo)
    VALUES ('S00005', 'Ajuste Por Conteo Manual (Faltante)', '1', 'PROFIT', NULL, GETDATE(), 'PROFIT', NULL, GETDATE());
```

- [ ] **Step 2: Apply migrations and verify via a throwaway query**

Run: `bun run migrate:mssql`
Expected: output includes
`0003_seed_manual_recount_tipos.sql` in the applied list (alongside
`0001_...` and `0002_...` if this is a fresh database, or alone if
Tasks 1-2 already ran their own migrate calls during their own test
runs).

Then run this one-off verification (delete the file after — it's not
part of the plan's deliverables, just a manual check):

```bash
cat <<'EOF' > /tmp/verify-tipos.ts
import sql from 'mssql';
const pool = await new sql.ConnectionPool({
  server: process.env.DB_SERVER!,
  port: parseInt(process.env.DB_PORT ?? '1433'),
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
  },
}).connect();
const result = await pool.request().query(
  `SELECT co_tipo, des_tipo, tipo_trans FROM saTipoAjuste WHERE co_tipo IN ('E00003', 'S00005')`
);
console.log(result.recordset);
await pool.close();
EOF
bun --bun run /tmp/verify-tipos.ts
rm /tmp/verify-tipos.ts
```

Expected: two rows printed, `E00003` with `tipo_trans: '0     '` (or
trimmed `'0'`) and `S00005` with `tipo_trans: '1     '` (or trimmed
`'1'`).

- [ ] **Step 3: Run Task 2's full test file to confirm the last test now passes**

Run: `bun test __tests__/integration/pApiCrearAjusteInventario.integration.test.ts`
Expected: PASS (7 tests) — same command as Task 2 Step 4, now with
migration `0003` in place too. If Task 2 was implemented after this
task, this is simply the first time this command has been run; if Task
2 came first, this re-run confirms the previously-impossible last test
now passes.

- [ ] **Step 4: Commit**

```bash
git add mssql-migrations/0003_seed_manual_recount_tipos.sql
git commit -m "feat: seed manual-recount saTipoAjuste rows (E00003, S00005)"
```

---

### Task 4: Full-suite verification

**Files:** none (verification-only task)

**Interfaces:** none — this task confirms Tasks 1-3 integrate cleanly
and don't break anything else in the repo.

- [ ] **Step 1: Run the full test suite**

Run: `bun run test`
Expected: all tests from Tasks 1-3 PASS. The only failures should be
the same pre-existing, unrelated ones already on `main` before this
plan (the `comprasMapper` assertions and `ForgotPasswordService`
signature checks noted in Plan 1's plan) — do not attempt to fix those
here. If you see a different failure count, investigate before
concluding this task is done; do not assume a mismatch is "probably
fine."

- [ ] **Step 2: Run the migration runner one final time to confirm full idempotency**

Run: `bun run migrate:mssql`
Expected: `✓ No hay migraciones nuevas que aplicar` — confirms all
three migrations from this plan are recorded and re-running is a
genuine no-op, matching the "idempotent by design" requirement from the
spec's Data Model section.

- [ ] **Step 3: Confirm no stray test data remains**

Run this one-off check (same throwaway-script pattern as Task 3 Step
2 — write, run, delete):

```bash
cat <<'EOF' > /tmp/verify-clean.ts
import sql from 'mssql';
const pool = await new sql.ConnectionPool({
  server: process.env.DB_SERVER!,
  port: parseInt(process.env.DB_PORT ?? '1433'),
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
  },
}).connect();
const result = await pool.request().query(
  `SELECT COUNT(*) AS c FROM saAjuste WHERE motivo = 'Integration test adjustment'`
);
console.log('Leftover test saAjuste rows:', result.recordset[0].c);
await pool.close();
EOF
bun --bun run /tmp/verify-clean.ts
rm /tmp/verify-clean.ts
```

Expected: `Leftover test saAjuste rows: 0`. If nonzero, the test
suite's `cleanupAjuste()` calls didn't run to completion on some prior
failed run — manually delete those rows from `saAjusteReng` then
`saAjuste` (in that FK order) before considering this task done, since
leftover rows would otherwise silently inflate row counts for the next
person who runs these tests.

- [ ] **Step 4: No commit for this task**

This is a verification-only task with no file changes — nothing to
commit. If Step 3 required manual cleanup, that cleanup was against the
live database directly, not a code change.

---

## Out of Scope (reaffirmed from the spec)

- The Next.js API route that calls `pApiCrearAjusteInventario` — Plan
  4.
- Deploying these migrations to the real production Profit Plus server
  — a manual operational step for later; `bun run migrate:mssql` is not
  wired into any CI/deploy pipeline by this plan.
- Multi-currency adjustments, `saInventarioFisico`/physical-count-session
  changes, and retry/queueing logic — all explicitly out of scope per
  the spec's own "Out of Scope" section.
