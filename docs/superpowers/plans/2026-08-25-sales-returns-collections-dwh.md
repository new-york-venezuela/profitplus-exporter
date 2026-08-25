# Sales, Returns & Collections DWH — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new `DWH_AlimentosNY` database on the same SQL Server instance as the Profit Plus ERP (`Ncake_a`), with a Kimball star schema (7 conformed dimensions + `Fact_Sales`, `Fact_Returns`, `Fact_Collections`, `Fact_AR_Snapshot`, `Fact_ExchangeRate`) loaded incrementally from the ERP via `validador`-rowversion-watermarked MERGE procedures, plus a daily AR-aging snapshot job — everything needed to power Sales/Returns/Net-Revenue and Collections/Aging/DSO dashboards. Margin/cost dashboards are explicitly deferred (see spec §1) — the cost columns are wired into `Fact_Sales` but always populate `NULL`/`'NO_COST_DATA'` in this phase.

**Architecture:** A new `scripts/migrate-dwh.ts` runner (parallel to the existing `scripts/migrate-mssql.ts`), targeting new `DW_SERVER`/`DW_PORT`/`DW_NAME`/`DW_USER`/`DW_PASSWORD` env vars, applying numbered `.sql` files from a new `dwh-migrations/` directory in order, tracked in a `dwh.__dwh_migrations` table inside the new database. The runner bootstraps the database itself by first connecting to `master` and issuing `CREATE DATABASE IF NOT EXISTS`, then reconnecting to `DW_NAME` for every subsequent migration — one command (`bun run migrate:dwh`) takes the DWH from nothing to fully loaded schema. Load procedures live as stored procedures inside `DWH_AlimentosNY` itself (not application code), reading the ERP cross-database via three-part names (`Ncake_a.dbo.saFacturaVenta`), so they can also be invoked directly by a SQL Agent job without any app process running.

**Tech Stack:** `mssql` npm package (already a dependency), Bun, TypeScript, `bun test` for integration tests (read-only against live `Ncake_a`, read/write against the new `DW_AlimentosNY_Test`-suffixed... — see Global Constraints for the exact test database strategy), T-SQL (SQL Server 2012-compatible, matching Profit Plus 2k12's engine).

**Spec:** `docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md`

## Global Constraints

- **Margin/cost is out of scope for this plan.** `Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount` columns exist and are always `NULL`; `CostSourceFlag` is always `'NO_COST_DATA'` in every task in this plan (spec §1, §3.2, live-verified 2026-08-25: no finished-goods cost data exists anywhere in Profit Plus).
- **No return-reason dimension and no sales-target fact** — confirmed absent from Profit Plus's schema; do not add them (spec §1).
- **Incremental load key is `validador` (rowversion/`binary(8)`), never `fe_us_mo`** — monotonic and collision-free; `fe_us_mo` is human-editable and can be backdated (spec §2, §5).
- **Base currency in this installation is `'BS    '` (padded `char(6)`), not `'VES'`.** Any code resolving the base currency must do `SELECT co_mone FROM Ncake_a.dbo.saMoneda WHERE cambio = 1` dynamically — never hardcode `'VES'` (spec §2, verified in `erp-knowledge-base/docs/tables/saMoneda.md`).
- **All fact loads filter `anulado = 0` at the ERP source** for the "is this a real transaction" question, but the DWH still stores an `IsVoided` bit — voided/reversed documents are loaded, not skipped, so audit dashboards can count them; BI semantic layers default-filter `IsVoided = 0` (spec §2).
- **Physical tables, not views** — every dim/fact is a real table in `DWH_AlimentosNY`, loaded by `MERGE` stored procedures, never a live cross-database view (spec §4, user decision).
- **Schema layout**: `dwh` schema for control tables, `dim` schema for dimensions, `fact` schema for facts (spec §4). Every `CREATE TABLE`/`CREATE PROCEDURE` in this plan uses one of these three schemas — never bare `dbo` inside `DWH_AlimentosNY`.
- **SCD Type 2** for `Dim_Customer` and `Dim_Product` (effective-dated versions, `ValidFrom`/`ValidTo`/`IsCurrent`); **Type 1** (overwrite) for `Dim_SalesRep`, `Dim_Warehouse`, `Dim_Currency`, `Dim_DocumentType` (spec §3.1).
- **`.sql` migration files containing more than one DDL/DML statement that can't share a batch (e.g. `CREATE DATABASE` followed by `USE`, or multiple `CREATE PROCEDURE` statements) must be split on lines containing only `GO`, each run via `request.batch()`** — same verified requirement as the existing `migrate-mssql.ts` (spec references this pattern; verified necessary in the prior inventory-adjustment plan).
- **Testing**: integration tests read from live `Ncake_a` (read-only `SELECT`s only — never `INSERT`/`UPDATE`/`DELETE` against `Ncake_a`) to build expected values, and write to a dedicated test DWH database `DWH_AlimentosNY_Test` (created and torn down by the test suite itself, never `DWH_AlimentosNY`) to validate load-proc behavior end-to-end (user decision, this session).
- **`char`/`varchar` columns read back from MSSQL are space-padded to their declared width** — always `.trim()` string values pulled from `saFacturaVenta.doc_num`, `saCliente.co_cli`, etc. before using them as dimension natural keys, or SCD2 lookups will silently fail to match (carried over from the same real gotcha documented in the prior inventory-adjustment plan).

---

## Task 1: DWH database bootstrap + migration runner

**Files:**
- Create: `scripts/migrate-dwh.ts`
- Create: `dwh-migrations/0001_create_database.sql`
- Create: `dwh-migrations/0002_create_schemas_and_watermark_table.sql`
- Modify: `.env.example` (uncomment/extend the `DW_*` block)
- Modify: `package.json` (add `migrate:dwh` script)
- Test: `scripts/dwh/__tests__/migrate-dwh.test.ts`

**Interfaces:**
- Produces: `runDwhMigrations(): Promise<string[]>` (exported from `scripts/migrate-dwh.ts`) — returns the list of newly-applied migration filenames, mirroring `runMigrations()`'s shape in `scripts/migrate-mssql.ts`.
- Produces: env vars `DW_SERVER`, `DW_PORT`, `DW_NAME`, `DW_USER`, `DW_PASSWORD`, `DW_ENCRYPT`, `DW_TRUST_SERVER_CERT` — every later task's load procs and tests read these (falling back to `DB_SERVER`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_ENCRYPT`/`DB_TRUST_SERVER_CERT` when the `DW_*` variant is unset, matching the `.env.example` comment's original "defaults to the DB_SERVER/DB_PORT above" intent — only `DW_NAME` has its own hard default of `"DWH_AlimentosNY"`).

- [ ] **Step 1: Add the `DW_*` env block to `.env.example`**

Find the existing commented-out block:
```
# ─── DW_Profit (nightly ETL target, scripts/etl_dw.py) ─────────────────
# Optional overrides — defaults to the DB_SERVER/DB_PORT above with
# DW_NAME defaulting to "DW_Profit" if unset.
# DW_SERVER=192.168.1.x
# DW_PORT=1433
# DW_NAME=DW_Profit
```

Replace it with:
```
# ─── DWH_AlimentosNY (Sales/Returns/Collections warehouse, scripts/migrate-dwh.ts) ─
# Optional overrides — defaults to the DB_SERVER/DB_PORT/DB_USER/DB_PASSWORD/
# DB_ENCRYPT/DB_TRUST_SERVER_CERT above (same instance, different database)
# with DW_NAME defaulting to "DWH_AlimentosNY" if unset.
# DW_SERVER=192.168.1.x
# DW_PORT=1433
# DW_NAME=DWH_AlimentosNY
# DW_USER=readonly_user
# DW_PASSWORD=changeme
```

- [ ] **Step 2: Add real `DW_*` values to `.env.local`**

Add (uncommented, with real values — same host/credentials as the existing `DB_*` block unless a dedicated DWH login exists):
```
DW_SERVER=<same as DB_SERVER, or a dedicated value>
DW_PORT=<same as DB_PORT>
DW_NAME=DWH_AlimentosNY
DW_USER=<same as DB_USER, or a dedicated value>
DW_PASSWORD=<same as DB_PASSWORD, or a dedicated value>
```

- [ ] **Step 3: Write `dwh-migrations/0001_create_database.sql`**

```sql
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'DWH_AlimentosNY')
BEGIN
    CREATE DATABASE DWH_AlimentosNY;
END
```

- [ ] **Step 4: Write `dwh-migrations/0002_create_schemas_and_watermark_table.sql`**

```sql
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'dwh')
BEGIN
    EXEC('CREATE SCHEMA dwh');
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'dim')
BEGIN
    EXEC('CREATE SCHEMA dim');
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'fact')
BEGIN
    EXEC('CREATE SCHEMA fact');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EtlWatermark' AND schema_id = SCHEMA_ID('dwh'))
BEGIN
    CREATE TABLE dwh.EtlWatermark (
        SourceTableName   sysname       NOT NULL PRIMARY KEY,
        LastValidador     binary(8)     NOT NULL,
        LastRunAtUtc      datetime2(3)  NOT NULL,
        LastRowsProcessed int           NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__dwh_migrations' AND schema_id = SCHEMA_ID('dwh'))
BEGIN
    CREATE TABLE dwh.__dwh_migrations (
        name        VARCHAR(255)  NOT NULL PRIMARY KEY,
        applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
```

- [ ] **Step 5: Write `scripts/migrate-dwh.ts`**

```typescript
import sql from 'mssql';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'dwh-migrations');

function dwEnv(name: string, fallback: string): string {
  return process.env[`DW_${name}`] ?? process.env[`DB_${name}`] ?? fallback;
}

export function dwhDatabaseName(): string {
  return process.env.DW_NAME ?? 'DWH_AlimentosNY';
}

function buildConfig(database: string): sql.config {
  return {
    server: dwEnv('SERVER', 'localhost'),
    port: parseInt(dwEnv('PORT', '1433')),
    database,
    user: dwEnv('USER', 'sa'),
    password: dwEnv('PASSWORD', ''),
    options: {
      encrypt: dwEnv('ENCRYPT', 'false') === 'true',
      trustServerCertificate: dwEnv('TRUST_SERVER_CERT', 'true') !== 'false',
    },
  };
}

function splitIntoBatches(fileContents: string): string[] {
  return fileContents
    .split(/^\s*GO\s*$/im)
    .map(batch => batch.trim())
    .filter(batch => batch.length > 0);
}

async function ensureDatabaseExists(): Promise<void> {
  const masterPool = await new sql.ConnectionPool(buildConfig('master')).connect();
  try {
    const dbName = dwhDatabaseName();
    await masterPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbName}')
      BEGIN
          EXEC('CREATE DATABASE [${dbName}]');
      END
    `);
  } finally {
    await masterPool.close();
  }
}

async function ensureTrackingTableExists(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'dwh')
    BEGIN
        EXEC('CREATE SCHEMA dwh');
    END
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__dwh_migrations' AND schema_id = SCHEMA_ID('dwh'))
    BEGIN
        CREATE TABLE dwh.__dwh_migrations (
            name        VARCHAR(255)  NOT NULL PRIMARY KEY,
            applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
        );
    END
  `);
}

async function getAppliedMigrationNames(pool: sql.ConnectionPool): Promise<Set<string>> {
  const result = await pool.request().query(`SELECT name FROM dwh.__dwh_migrations`);
  return new Set(result.recordset.map((row: { name: string }) => row.name));
}

export async function runDwhMigrations(): Promise<string[]> {
  await ensureDatabaseExists();

  const pool = await new sql.ConnectionPool(buildConfig(dwhDatabaseName())).connect();

  try {
    await ensureTrackingTableExists(pool);
    const applied = await getAppliedMigrationNames(pool);

    const allFiles = (await readdir(MIGRATIONS_DIR))
      .filter(name => name.endsWith('.sql'))
      .sort();

    const newlyApplied: string[] = [];

    for (const fileName of allFiles) {
      if (applied.has(fileName)) continue;
      if (fileName === '0001_create_database.sql') {
        // Database creation already handled by ensureDatabaseExists() against
        // master, before this pool connected to the (now-existing) DWH
        // database — record it as applied without re-running its SQL.
        await pool.request()
          .input('name', sql.VarChar(255), fileName)
          .query(`INSERT INTO dwh.__dwh_migrations (name) VALUES (@name)`);
        newlyApplied.push(fileName);
        continue;
      }

      const contents = await readFile(join(MIGRATIONS_DIR, fileName), 'utf-8');
      const batches = splitIntoBatches(contents);

      for (const batch of batches) {
        await pool.request().batch(batch);
      }

      await pool.request()
        .input('name', sql.VarChar(255), fileName)
        .query(`INSERT INTO dwh.__dwh_migrations (name) VALUES (@name)`);

      newlyApplied.push(fileName);
    }

    return newlyApplied;
  } finally {
    await pool.close();
  }
}

if (import.meta.main) {
  runDwhMigrations()
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

- [ ] **Step 6: Add the `migrate:dwh` script to `package.json`**

Next to the existing `"migrate:mssql": "bun --bun run scripts/migrate-mssql.ts",` line, add:
```json
"migrate:dwh": "bun --bun run scripts/migrate-dwh.ts",
```

- [ ] **Step 7: Write the failing integration test**

```typescript
// scripts/dwh/__tests__/migrate-dwh.test.ts
import { describe, test, expect, afterAll } from 'bun:test';
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

describe('migrate-dwh', () => {
  afterAll(async () => {
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      IF EXISTS (SELECT * FROM sys.databases WHERE name = '${dwhDatabaseName()}')
      BEGIN
          ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
          DROP DATABASE [${dwhDatabaseName()}];
      END
    `);
    await masterPool.close();
  });

  test('creates the database and applies all pending migrations idempotently', async () => {
    const firstRun = await runDwhMigrations();
    expect(firstRun.length).toBeGreaterThan(0);
    expect(firstRun).toContain('0001_create_database.sql');
    expect(firstRun).toContain('0002_create_schemas_and_watermark_table.sql');

    const pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    try {
      const watermarkTable = await pool.request().query(`
        SELECT 1 AS found FROM sys.tables
        WHERE name = 'EtlWatermark' AND schema_id = SCHEMA_ID('dwh')
      `);
      expect(watermarkTable.recordset.length).toBe(1);
    } finally {
      await pool.close();
    }

    const secondRun = await runDwhMigrations();
    expect(secondRun).toEqual([]);
  });
});
```

Set `DW_NAME=DWH_AlimentosNY_Test` in the test environment (e.g. via a `.env.test` entry or inline when running this specific suite) so this test never touches the real `DWH_AlimentosNY`.

- [ ] **Step 8: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/migrate-dwh.test.ts`
Expected: FAIL with a module-not-found or connection error (the runner/migrations don't exist yet if Steps 1-6 weren't done first — if they were, this step should already pass; reorder so this genuinely fails first if strict TDD ordering is wanted, or treat Steps 1-6 as the "make it pass" step for this single black-box test)

- [ ] **Step 9: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/migrate-dwh.test.ts`
Expected: PASS — database created, both migrations applied, second run is a no-op, test database dropped in `afterAll`.

- [ ] **Step 10: Commit**

```bash
git add .env.example scripts/migrate-dwh.ts dwh-migrations/0001_create_database.sql dwh-migrations/0002_create_schemas_and_watermark_table.sql scripts/dwh/__tests__/migrate-dwh.test.ts package.json
git commit -m "feat: add DWH database bootstrap and migration runner"
```

---

## Task 2: Dim_Date

**Files:**
- Create: `dwh-migrations/0003_dim_date.sql`
- Test: `scripts/dwh/__tests__/dim-date.test.ts`

**Interfaces:**
- Produces: `dim.Dim_Date` table with `DateKey int PRIMARY KEY` (format `YYYYMMDD`), `FullDate date`, `Year int`, `Month int`, `MonthName varchar(20)`, `Day int`, `DayOfWeek int`, `DayName varchar(20)`, `IsWeekend bit`, `YearMonth char(7)` (format `YYYY-MM`, for easy month-grain grouping). Every later fact task's `DateKey` FK references this table.

- [ ] **Step 1: Write `dwh-migrations/0003_dim_date.sql`**

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Date' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Date (
        DateKey     int          NOT NULL PRIMARY KEY,
        FullDate    date         NOT NULL,
        Year        int          NOT NULL,
        Month       int          NOT NULL,
        MonthName   varchar(20)  NOT NULL,
        Day         int          NOT NULL,
        DayOfWeek   int          NOT NULL,
        DayName     varchar(20)  NOT NULL,
        IsWeekend   bit          NOT NULL,
        YearMonth   char(7)      NOT NULL
    );
END
GO

DECLARE @StartDate date = '2020-01-01';
DECLARE @EndDate   date = '2035-12-31';
DECLARE @CurrentDate date = @StartDate;

WHILE @CurrentDate <= @EndDate
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dim.Dim_Date WHERE DateKey = CONVERT(int, FORMAT(@CurrentDate, 'yyyyMMdd')))
    BEGIN
        INSERT INTO dim.Dim_Date (DateKey, FullDate, Year, Month, MonthName, Day, DayOfWeek, DayName, IsWeekend, YearMonth)
        VALUES (
            CONVERT(int, FORMAT(@CurrentDate, 'yyyyMMdd')),
            @CurrentDate,
            YEAR(@CurrentDate),
            MONTH(@CurrentDate),
            DATENAME(month, @CurrentDate),
            DAY(@CurrentDate),
            DATEPART(weekday, @CurrentDate),
            DATENAME(weekday, @CurrentDate),
            CASE WHEN DATEPART(weekday, @CurrentDate) IN (1, 7) THEN 1 ELSE 0 END,
            FORMAT(@CurrentDate, 'yyyy-MM')
        );
    END
    SET @CurrentDate = DATEADD(day, 1, @CurrentDate);
END
```

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/dwh/__tests__/dim-date.test.ts
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

describe('Dim_Date', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
  });

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('has one row per day covering 2020-01-01 through 2035-12-31', async () => {
    const result = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Date`);
    expect(result.recordset[0].total).toBe(5844); // days from 2020-01-01 to 2035-12-31 inclusive
  });

  test('DateKey format and attributes are correct for a known date', async () => {
    const result = await pool.request().query(`
      SELECT DateKey, FullDate, Year, Month, MonthName, Day, DayOfWeek, DayName, IsWeekend, YearMonth
      FROM dim.Dim_Date WHERE DateKey = 20260825
    `);
    const row = result.recordset[0];
    expect(row.Year).toBe(2026);
    expect(row.Month).toBe(8);
    expect(row.Day).toBe(25);
    expect(row.YearMonth).toBe('2026-08');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/dim-date.test.ts`
Expected: FAIL — `dim.Dim_Date` doesn't exist yet (migration `0003` not yet applied by `runDwhMigrations()` since the file doesn't exist).

- [ ] **Step 4: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/dim-date.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0003_dim_date.sql scripts/dwh/__tests__/dim-date.test.ts
git commit -m "feat: add Dim_Date to DWH"
```

---

## Task 3: Dim_Currency + Fact_ExchangeRate

**Files:**
- Create: `dwh-migrations/0004_dim_currency_and_fact_exchangerate.sql`
- Test: `scripts/dwh/__tests__/dim-currency-fact-exchangerate.test.ts`

**Interfaces:**
- Consumes: `Ncake_a.dbo.saMoneda` (co_mone, mone_des, cambio), `Ncake_a.dbo.saTasa` (co_mone, fecha, tasa_c, tasa_v), `dim.Dim_Date` (Task 2)
- Produces: `dim.Dim_Currency` (`CurrencyKey int IDENTITY PRIMARY KEY`, `CurrencyCode char(6)` natural key, `CurrencyName varchar(60)`, `IsBaseCurrency bit`), `fact.Fact_ExchangeRate` (`DateKey int`, `CurrencyKey int`, `RateBuy decimal(21,8)`, `RateSell decimal(21,8)`, composite PK on `DateKey`+`CurrencyKey`). Produces stored procedures `dwh.Load_Dim_Currency` and `dwh.Load_Fact_ExchangeRate`, both callable with no parameters.

- [ ] **Step 1: Write `dwh-migrations/0004_dim_currency_and_fact_exchangerate.sql`**

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Currency' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Currency (
        CurrencyKey     int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CurrencyCode    char(6)       NOT NULL UNIQUE,
        CurrencyName    varchar(60)   NULL,
        IsBaseCurrency  bit           NOT NULL,
        LoadedAtUtc     datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_ExchangeRate' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_ExchangeRate (
        DateKey      int             NOT NULL,
        CurrencyKey  int             NOT NULL,
        RateBuy      decimal(21,8)   NULL,
        RateSell     decimal(21,8)   NULL,
        LoadedAtUtc  datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Fact_ExchangeRate PRIMARY KEY (DateKey, CurrencyKey),
        CONSTRAINT FK_Fact_ExchangeRate_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_ExchangeRate_Dim_Currency FOREIGN KEY (CurrencyKey) REFERENCES dim.Dim_Currency(CurrencyKey)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saMoneda')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saMoneda', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saTasa')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saTasa', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Currency
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dim.Dim_Currency AS tgt
    USING (
        SELECT
            RTRIM(co_mone) AS CurrencyCode,
            mone_des        AS CurrencyName,
            CASE WHEN cambio = 1 THEN 1 ELSE 0 END AS IsBaseCurrency
        FROM Ncake_a.dbo.saMoneda
    ) AS src
        ON tgt.CurrencyCode = src.CurrencyCode
    WHEN MATCHED THEN UPDATE SET
        tgt.CurrencyName = src.CurrencyName,
        tgt.IsBaseCurrency = src.IsBaseCurrency
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (CurrencyCode, CurrencyName, IsBaseCurrency)
        VALUES (src.CurrencyCode, src.CurrencyName, src.IsBaseCurrency);
END
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_ExchangeRate
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saTasa');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    MERGE fact.Fact_ExchangeRate AS tgt
    USING (
        SELECT
            CONVERT(int, FORMAT(t.fecha, 'yyyyMMdd')) AS DateKey,
            c.CurrencyKey,
            t.tasa_c AS RateBuy,
            t.tasa_v AS RateSell
        FROM Ncake_a.dbo.saTasa t
        INNER JOIN dim.Dim_Currency c ON c.CurrencyCode = RTRIM(t.co_mone)
        WHERE EXISTS (SELECT 1 FROM Ncake_a.dbo.saMoneda m WHERE RTRIM(m.co_mone) = RTRIM(t.co_mone))
    ) AS src
        ON tgt.DateKey = src.DateKey AND tgt.CurrencyKey = src.CurrencyKey
    WHEN MATCHED THEN UPDATE SET
        tgt.RateBuy = src.RateBuy,
        tgt.RateSell = src.RateSell,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (DateKey, CurrencyKey, RateBuy, RateSell)
        VALUES (src.DateKey, src.CurrencyKey, src.RateBuy, src.RateSell);

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), 0x0000000000000000) FROM Ncake_a.dbo.saTasa;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saTasa';
END
```

**Note**: `saTasa` has no `validador` column per its documented schema (`erp-knowledge-base/docs/tables/saTasa.md` lists only `co_mone`, `fecha`, `tasa_c`, `tasa_v` — no audit columns at all). This procedure does a full re-`MERGE` every run (safe and cheap given `saTasa`'s small size — one row per currency per day) rather than watermark-filtering, but still records a watermark row for consistency with the control-table pattern and to leave room for a future audit-column addition upstream.

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/dwh/__tests__/dim-currency-fact-exchangerate.test.ts
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

describe('Dim_Currency + Fact_ExchangeRate', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
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

  test('Load_Dim_Currency loads the base currency with the correct BS code, not VES', async () => {
    await pool.request().execute('dwh.Load_Dim_Currency');

    const baseCurrency = await pool.request().query(`
      SELECT CurrencyCode, IsBaseCurrency FROM dim.Dim_Currency WHERE IsBaseCurrency = 1
    `);
    expect(baseCurrency.recordset.length).toBe(1);
    expect(baseCurrency.recordset[0].CurrencyCode.trim()).toBe('BS');
  });

  test('Load_Dim_Currency row count matches saMoneda row count', async () => {
    await pool.request().execute('dwh.Load_Dim_Currency');

    const erpCount = await erpPool.request().query(`SELECT COUNT(*) AS total FROM saMoneda`);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Currency`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('Load_Fact_ExchangeRate loads USD rate history matching saTasa', async () => {
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Fact_ExchangeRate');

    const erpUsdCount = await erpPool.request().query(`SELECT COUNT(*) AS total FROM saTasa WHERE RTRIM(co_mone) = 'USD'`);
    const dwhUsdCount = await pool.request().query(`
      SELECT COUNT(*) AS total
      FROM fact.Fact_ExchangeRate f
      INNER JOIN dim.Dim_Currency c ON c.CurrencyKey = f.CurrencyKey
      WHERE RTRIM(c.CurrencyCode) = 'USD'
    `);
    expect(dwhUsdCount.recordset[0].total).toBe(erpUsdCount.recordset[0].total);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/dim-currency-fact-exchangerate.test.ts`
Expected: FAIL — `dim.Dim_Currency`/`dwh.Load_Dim_Currency` don't exist yet.

- [ ] **Step 4: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/dim-currency-fact-exchangerate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0004_dim_currency_and_fact_exchangerate.sql scripts/dwh/__tests__/dim-currency-fact-exchangerate.test.ts
git commit -m "feat: add Dim_Currency and Fact_ExchangeRate to DWH"
```

---

## Task 4: Dim_Customer (SCD Type 2)

**Files:**
- Create: `dwh-migrations/0005_dim_customer.sql`
- Test: `scripts/dwh/__tests__/dim-customer.test.ts`

**Interfaces:**
- Consumes: `Ncake_a.dbo.saCliente` (co_cli, cli_des, rif, contrib, mont_cre, co_mone, co_zon, co_seg, co_ven, juridico, inactivo, validador)
- Produces: `dim.Dim_Customer` (`CustomerKey int IDENTITY PRIMARY KEY`, `CustomerCode char(16)` natural key, `CustomerName varchar(120)`, `TaxId varchar(20)`, `IsSpecialTaxpayer bit`, `CreditLimit decimal(18,2)`, `CreditLimitCurrencyCode char(6)`, `ZoneCode char(6)`, `SegmentCode char(6)`, `DefaultSalesRepCode char(6)`, `IsLegalEntity bit`, `IsInactive bit`, `ValidFrom datetime2(3)`, `ValidTo datetime2(3) NULL`, `IsCurrent bit`). Produces stored procedure `dwh.Load_Dim_Customer` (no parameters), which any later fact-load task's dimension-key lookup joins against via `CustomerCode` + effective-dated `ValidFrom`/`ValidTo`.

- [ ] **Step 1: Write `dwh-migrations/0005_dim_customer.sql`**

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Customer' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Customer (
        CustomerKey             int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CustomerCode            char(16)      NOT NULL,
        CustomerName            varchar(120)  NULL,
        TaxId                   varchar(20)   NULL,
        IsSpecialTaxpayer       bit           NOT NULL,
        CreditLimit             decimal(18,2) NULL,
        CreditLimitCurrencyCode char(6)       NULL,
        ZoneCode                char(6)       NULL,
        SegmentCode             char(6)       NULL,
        DefaultSalesRepCode     char(6)       NULL,
        IsLegalEntity           bit           NOT NULL,
        IsInactive              bit           NOT NULL,
        ValidFrom               datetime2(3)  NOT NULL,
        ValidTo                 datetime2(3)  NULL,
        IsCurrent               bit           NOT NULL,
        LoadedAtUtc              datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Dim_Customer_CustomerCode_Current ON dim.Dim_Customer (CustomerCode, IsCurrent);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saCliente')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saCliente', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Customer
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCliente');
    DECLARE @NewWatermark binary(8);
    DECLARE @Now datetime2(3) = SYSUTCDATETIME();
    DECLARE @RowCount int;

    -- Close out current versions whose source row changed
    UPDATE tgt
    SET tgt.ValidTo = @Now, tgt.IsCurrent = 0
    FROM dim.Dim_Customer tgt
    INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) = RTRIM(tgt.CustomerCode)
    WHERE tgt.IsCurrent = 1
      AND src.validador > @Watermark
      AND (
            ISNULL(tgt.CustomerName, '') <> ISNULL(src.cli_des, '')
         OR ISNULL(tgt.TaxId, '') <> ISNULL(src.rif, '')
         OR ISNULL(tgt.IsSpecialTaxpayer, 0) <> ISNULL(src.contrib, 0)
         OR ISNULL(tgt.CreditLimit, -1) <> ISNULL(src.mont_cre, -1)
         OR ISNULL(RTRIM(tgt.CreditLimitCurrencyCode), '') <> ISNULL(RTRIM(src.co_mone), '')
         OR ISNULL(RTRIM(tgt.ZoneCode), '') <> ISNULL(RTRIM(src.co_zon), '')
         OR ISNULL(RTRIM(tgt.SegmentCode), '') <> ISNULL(RTRIM(src.co_seg), '')
         OR ISNULL(RTRIM(tgt.DefaultSalesRepCode), '') <> ISNULL(RTRIM(src.co_ven), '')
         OR ISNULL(tgt.IsLegalEntity, 0) <> ISNULL(src.juridico, 0)
         OR ISNULL(tgt.IsInactive, 0) <> ISNULL(src.inactivo, 0)
      );

    -- Insert new versions: brand-new customers, and customers just closed out above
    INSERT INTO dim.Dim_Customer (
        CustomerCode, CustomerName, TaxId, IsSpecialTaxpayer, CreditLimit, CreditLimitCurrencyCode,
        ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity, IsInactive, ValidFrom, ValidTo, IsCurrent
    )
    SELECT
        RTRIM(src.co_cli), src.cli_des, src.rif, ISNULL(src.contrib, 0), src.mont_cre, src.co_mone,
        src.co_zon, src.co_seg, src.co_ven, ISNULL(src.juridico, 0), ISNULL(src.inactivo, 0), @Now, NULL, 1
    FROM Ncake_a.dbo.saCliente src
    WHERE src.validador > @Watermark
      AND NOT EXISTS (
          SELECT 1 FROM dim.Dim_Customer tgt
          WHERE RTRIM(tgt.CustomerCode) = RTRIM(src.co_cli) AND tgt.IsCurrent = 1
      );

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saCliente;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCliente';
END
```

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/dwh/__tests__/dim-customer.test.ts
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

describe('Dim_Customer', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
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

  test('initial load creates one current row per ERP customer', async () => {
    await pool.request().execute('dwh.Load_Dim_Customer');

    const erpCount = await erpPool.request().query(`SELECT COUNT(*) AS total FROM saCliente`);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Customer WHERE IsCurrent = 1`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('a known active customer loads with trimmed natural key and correct attributes', async () => {
    await pool.request().execute('dwh.Load_Dim_Customer');

    const sample = await erpPool.request().query(`SELECT TOP 1 co_cli, cli_des, contrib FROM saCliente WHERE inactivo = 0`);
    const co_cli = sample.recordset[0].co_cli.trim();

    const dwhRow = await pool.request()
      .input('code', sql.Char(16), co_cli)
      .query(`SELECT CustomerCode, CustomerName, IsSpecialTaxpayer, IsCurrent FROM dim.Dim_Customer WHERE RTRIM(CustomerCode) = @code AND IsCurrent = 1`);

    expect(dwhRow.recordset.length).toBe(1);
    expect(dwhRow.recordset[0].CustomerCode.trim()).toBe(co_cli);
    expect(dwhRow.recordset[0].IsCurrent).toBe(true);
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Dim_Customer');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Customer`);

    await pool.request().execute('dwh.Load_Dim_Customer');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Customer`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/dim-customer.test.ts`
Expected: FAIL — `dim.Dim_Customer`/`dwh.Load_Dim_Customer` don't exist yet.

- [ ] **Step 4: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/dim-customer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0005_dim_customer.sql scripts/dwh/__tests__/dim-customer.test.ts
git commit -m "feat: add Dim_Customer (SCD Type 2) to DWH"
```

---

## Task 5: Dim_Product (SCD Type 2, denormalized category hierarchy)

**Files:**
- Create: `dwh-migrations/0006_dim_product.sql`
- Test: `scripts/dwh/__tests__/dim-product.test.ts`

**Interfaces:**
- Consumes: `Ncake_a.dbo.saArticulo` (co_art, art_des, tipo, tipo_cos, co_lin, co_subl, co_cat, margen_min, margen_max, anulado, validador), `Ncake_a.dbo.saCatArticulo` (co_cat, cat_des), `Ncake_a.dbo.saLineaArticulo` (co_lin, lin_des), `Ncake_a.dbo.saSubLinea` (co_lin, co_subl, subl_des)
- Produces: `dim.Dim_Product` (`ProductKey int IDENTITY PRIMARY KEY`, `ProductCode char(30)` natural key, `ProductName varchar(120)`, `ProductTypeCode char(1)`, `CostingMethodCode char(4)`, `LineCode char(6)`, `LineName varchar(60)`, `SubLineCode char(6)`, `SubLineName varchar(60)`, `CategoryCode char(6)`, `CategoryName varchar(60)`, `MarginMinPercent decimal(18,2)`, `MarginMaxPercent decimal(18,2)`, `IsInactive bit`, `ValidFrom datetime2(3)`, `ValidTo datetime2(3) NULL`, `IsCurrent bit`). Produces stored procedure `dwh.Load_Dim_Product` (no parameters).

- [ ] **Step 1: Write `dwh-migrations/0006_dim_product.sql`**

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Product' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Product (
        ProductKey        int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ProductCode       char(30)      NOT NULL,
        ProductName       varchar(120)  NULL,
        ProductTypeCode   char(1)       NULL,
        CostingMethodCode char(4)       NULL,
        LineCode          char(6)       NULL,
        LineName          varchar(60)   NULL,
        SubLineCode       char(6)       NULL,
        SubLineName       varchar(60)   NULL,
        CategoryCode      char(6)       NULL,
        CategoryName      varchar(60)   NULL,
        MarginMinPercent  decimal(18,2) NULL,
        MarginMaxPercent  decimal(18,2) NULL,
        IsInactive        bit           NOT NULL,
        ValidFrom         datetime2(3)  NOT NULL,
        ValidTo           datetime2(3)  NULL,
        IsCurrent         bit           NOT NULL,
        LoadedAtUtc        datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Dim_Product_ProductCode_Current ON dim.Dim_Product (ProductCode, IsCurrent);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saArticulo')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saArticulo', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Product
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saArticulo');
    DECLARE @NewWatermark binary(8);
    DECLARE @Now datetime2(3) = SYSUTCDATETIME();
    DECLARE @RowCount int;

    ;WITH SourceProducts AS (
        SELECT
            a.co_art, a.art_des, a.tipo, a.tipo_cos, a.co_lin, l.lin_des,
            a.co_subl, sl.subl_des, a.co_cat, c.cat_des,
            a.margen_min, a.margen_max, a.anulado, a.validador
        FROM Ncake_a.dbo.saArticulo a
        LEFT JOIN Ncake_a.dbo.saLineaArticulo l ON RTRIM(l.co_lin) = RTRIM(a.co_lin)
        LEFT JOIN Ncake_a.dbo.saSubLinea sl ON RTRIM(sl.co_lin) = RTRIM(a.co_lin) AND RTRIM(sl.co_subl) = RTRIM(a.co_subl)
        LEFT JOIN Ncake_a.dbo.saCatArticulo c ON RTRIM(c.co_cat) = RTRIM(a.co_cat)
    )
    UPDATE tgt
    SET tgt.ValidTo = @Now, tgt.IsCurrent = 0
    FROM dim.Dim_Product tgt
    INNER JOIN SourceProducts src ON RTRIM(src.co_art) = RTRIM(tgt.ProductCode)
    WHERE tgt.IsCurrent = 1
      AND src.validador > @Watermark
      AND (
            ISNULL(tgt.ProductName, '') <> ISNULL(src.art_des, '')
         OR ISNULL(tgt.CategoryCode, '') <> ISNULL(RTRIM(src.co_cat), '')
         OR ISNULL(tgt.LineCode, '') <> ISNULL(RTRIM(src.co_lin), '')
         OR ISNULL(tgt.SubLineCode, '') <> ISNULL(RTRIM(src.co_subl), '')
         OR ISNULL(tgt.MarginMinPercent, -1) <> ISNULL(src.margen_min, -1)
         OR ISNULL(tgt.MarginMaxPercent, -1) <> ISNULL(src.margen_max, -1)
         OR ISNULL(tgt.IsInactive, 0) <> ISNULL(src.anulado, 0)
      );

    ;WITH SourceProducts AS (
        SELECT
            a.co_art, a.art_des, a.tipo, a.tipo_cos, a.co_lin, l.lin_des,
            a.co_subl, sl.subl_des, a.co_cat, c.cat_des,
            a.margen_min, a.margen_max, a.anulado, a.validador
        FROM Ncake_a.dbo.saArticulo a
        LEFT JOIN Ncake_a.dbo.saLineaArticulo l ON RTRIM(l.co_lin) = RTRIM(a.co_lin)
        LEFT JOIN Ncake_a.dbo.saSubLinea sl ON RTRIM(sl.co_lin) = RTRIM(a.co_lin) AND RTRIM(sl.co_subl) = RTRIM(a.co_subl)
        LEFT JOIN Ncake_a.dbo.saCatArticulo c ON RTRIM(c.co_cat) = RTRIM(a.co_cat)
    )
    INSERT INTO dim.Dim_Product (
        ProductCode, ProductName, ProductTypeCode, CostingMethodCode, LineCode, LineName,
        SubLineCode, SubLineName, CategoryCode, CategoryName, MarginMinPercent, MarginMaxPercent,
        IsInactive, ValidFrom, ValidTo, IsCurrent
    )
    SELECT
        RTRIM(src.co_art), src.art_des, src.tipo, src.tipo_cos, src.co_lin, src.lin_des,
        src.co_subl, src.subl_des, src.co_cat, src.cat_des, src.margen_min, src.margen_max,
        ISNULL(src.anulado, 0), @Now, NULL, 1
    FROM SourceProducts src
    WHERE src.validador > @Watermark
      AND NOT EXISTS (
          SELECT 1 FROM dim.Dim_Product tgt
          WHERE RTRIM(tgt.ProductCode) = RTRIM(src.co_art) AND tgt.IsCurrent = 1
      );

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saArticulo;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saArticulo';
END
```

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/dwh/__tests__/dim-product.test.ts
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

describe('Dim_Product', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
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

  test('initial load creates one current row per ERP article, category denormalized in', async () => {
    await pool.request().execute('dwh.Load_Dim_Product');

    const erpCount = await erpPool.request().query(`SELECT COUNT(*) AS total FROM saArticulo`);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Product WHERE IsCurrent = 1`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('a finished-goods article (tipo=V) carries its category/line names denormalized', async () => {
    await pool.request().execute('dwh.Load_Dim_Product');

    const sample = await erpPool.request().query(`SELECT TOP 1 co_art FROM saArticulo WHERE tipo = 'V' AND anulado = 0`);
    const co_art = sample.recordset[0].co_art.trim();

    const dwhRow = await pool.request()
      .input('code', sql.Char(30), co_art)
      .query(`SELECT ProductCode, ProductTypeCode, CategoryName, LineName FROM dim.Dim_Product WHERE RTRIM(ProductCode) = @code AND IsCurrent = 1`);

    expect(dwhRow.recordset.length).toBe(1);
    expect(dwhRow.recordset[0].ProductTypeCode.trim()).toBe('V');
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Dim_Product');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Product`);

    await pool.request().execute('dwh.Load_Dim_Product');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Product`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/dim-product.test.ts`
Expected: FAIL — `dim.Dim_Product`/`dwh.Load_Dim_Product` don't exist yet.

- [ ] **Step 4: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/dim-product.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0006_dim_product.sql scripts/dwh/__tests__/dim-product.test.ts
git commit -m "feat: add Dim_Product (SCD Type 2, denormalized category hierarchy) to DWH"
```

---

## Task 6: Dim_SalesRep, Dim_Warehouse, Dim_DocumentType (Type 1 / static)

**Files:**
- Create: `dwh-migrations/0007_dim_salesrep_warehouse_documenttype.sql`
- Test: `scripts/dwh/__tests__/dim-salesrep-warehouse-documenttype.test.ts`

**Interfaces:**
- Consumes: `Ncake_a.dbo.saVendedor` (co_ven, ven_des, tipo, fun_ven, fun_cob, comision, co_zon, inactivo, validador), `Ncake_a.dbo.saAlmacen` (co_alma, des_alma, noventa, nocompra, materiales, produccion — no `validador` column on this table, see Step 1 note), `Ncake_a.dbo.saStockAlmacen` (co_alma, stock — for the derived `HasRealStock` flag)
- Produces: `dim.Dim_SalesRep` (`SalesRepKey int IDENTITY PRIMARY KEY`, `SalesRepCode char(6)` natural key, `SalesRepName varchar(60)`, `RoleTypeCode char(1)`, `IsSalesperson bit`, `IsCollector bit`, `CommissionPercent decimal(18,2)`, `ZoneCode char(6)`, `IsInactive bit`), `dim.Dim_Warehouse` (`WarehouseKey int IDENTITY PRIMARY KEY`, `WarehouseCode char(6)` natural key, `WarehouseName varchar(60)`, `AllowsSales bit`, `AllowsPurchases bit`, `IsMaterialsWarehouse bit`, `IsProductionWarehouse bit`, `HasRealStock bit`), `dim.Dim_DocumentType` (`DocumentTypeKey int IDENTITY PRIMARY KEY`, `DocumentTypeCode char(6)` natural key, `DocumentTypeName varchar(40)`, `IsCredit bit`, `AffectsAR bit` — seeded with static data, not loaded from any ERP table since it's a fixed known domain). Produces stored procedures `dwh.Load_Dim_SalesRep` and `dwh.Load_Dim_Warehouse` (`dwh.Load_Dim_DocumentType` is not needed — seeded once by the migration itself).

- [ ] **Step 1: Write `dwh-migrations/0007_dim_salesrep_warehouse_documenttype.sql`**

Note: per `erp-knowledge-base/docs/tables/saAlmacen.md`, no `validador` column is documented on `saAlmacen`. Since only 52 rows exist and warehouses change essentially never in this installation, `Load_Dim_Warehouse` does a full truncate-and-reload rather than watermark-based incremental — same reasoning as `saTasa` in Task 3.

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_SalesRep' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_SalesRep (
        SalesRepKey       int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SalesRepCode      char(6)       NOT NULL UNIQUE,
        SalesRepName      varchar(60)   NULL,
        RoleTypeCode      char(1)       NULL,
        IsSalesperson     bit           NOT NULL,
        IsCollector       bit           NOT NULL,
        CommissionPercent decimal(18,2) NULL,
        ZoneCode          char(6)       NULL,
        IsInactive        bit           NOT NULL,
        LoadedAtUtc        datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Warehouse' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Warehouse (
        WarehouseKey          int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        WarehouseCode         char(6)       NOT NULL UNIQUE,
        WarehouseName         varchar(60)   NULL,
        AllowsSales           bit           NOT NULL,
        AllowsPurchases       bit           NOT NULL,
        IsMaterialsWarehouse  bit           NOT NULL,
        IsProductionWarehouse bit           NOT NULL,
        HasRealStock          bit           NOT NULL,
        LoadedAtUtc             datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_DocumentType' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_DocumentType (
        DocumentTypeKey  int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DocumentTypeCode char(6)      NOT NULL UNIQUE,
        DocumentTypeName varchar(40)  NOT NULL,
        IsCredit         bit          NOT NULL,
        AffectsAR        bit          NOT NULL
    );

    INSERT INTO dim.Dim_DocumentType (DocumentTypeCode, DocumentTypeName, IsCredit, AffectsAR) VALUES
        ('FACT  ', 'Factura de Venta',   0, 1),
        ('N/CR  ', 'Nota de Credito',    1, 1),
        ('NCR   ', 'Nota de Credito',    1, 1),
        ('N/DB  ', 'Nota de Debito',     0, 1),
        ('COBR  ', 'Cobro',              0, 0),
        ('ANT   ', 'Anticipo',           0, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saVendedor')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saVendedor', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_SalesRep
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saVendedor');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    MERGE dim.Dim_SalesRep AS tgt
    USING (
        SELECT
            RTRIM(co_ven) AS SalesRepCode, ven_des, tipo,
            ISNULL(fun_ven, 0) AS IsSalesperson, ISNULL(fun_cob, 0) AS IsCollector,
            comision, co_zon, ISNULL(inactivo, 0) AS IsInactive, validador
        FROM Ncake_a.dbo.saVendedor
    ) AS src
        ON tgt.SalesRepCode = src.SalesRepCode
    WHEN MATCHED AND src.validador > @Watermark THEN UPDATE SET
        tgt.SalesRepName = src.ven_des,
        tgt.RoleTypeCode = src.tipo,
        tgt.IsSalesperson = src.IsSalesperson,
        tgt.IsCollector = src.IsCollector,
        tgt.CommissionPercent = src.comision,
        tgt.ZoneCode = src.co_zon,
        tgt.IsInactive = src.IsInactive
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (SalesRepCode, SalesRepName, RoleTypeCode, IsSalesperson, IsCollector, CommissionPercent, ZoneCode, IsInactive)
        VALUES (src.SalesRepCode, src.ven_des, src.tipo, src.IsSalesperson, src.IsCollector, src.comision, src.co_zon, src.IsInactive);

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saVendedor;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saVendedor';
END
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Warehouse
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dim.Dim_Warehouse AS tgt
    USING (
        SELECT
            RTRIM(a.co_alma) AS WarehouseCode, a.des_alma,
            CASE WHEN ISNULL(a.noventa, 0) = 0 THEN 1 ELSE 0 END AS AllowsSales,
            CASE WHEN ISNULL(a.nocompra, 0) = 0 THEN 1 ELSE 0 END AS AllowsPurchases,
            ISNULL(a.materiales, 0) AS IsMaterialsWarehouse,
            ISNULL(a.produccion, 0) AS IsProductionWarehouse,
            CASE WHEN EXISTS (
                SELECT 1 FROM Ncake_a.dbo.saStockAlmacen s
                WHERE RTRIM(s.co_alma) = RTRIM(a.co_alma) AND s.stock <> 0
            ) THEN 1 ELSE 0 END AS HasRealStock
        FROM Ncake_a.dbo.saAlmacen a
    ) AS src
        ON tgt.WarehouseCode = src.WarehouseCode
    WHEN MATCHED THEN UPDATE SET
        tgt.WarehouseName = src.des_alma,
        tgt.AllowsSales = src.AllowsSales,
        tgt.AllowsPurchases = src.AllowsPurchases,
        tgt.IsMaterialsWarehouse = src.IsMaterialsWarehouse,
        tgt.IsProductionWarehouse = src.IsProductionWarehouse,
        tgt.HasRealStock = src.HasRealStock
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (WarehouseCode, WarehouseName, AllowsSales, AllowsPurchases, IsMaterialsWarehouse, IsProductionWarehouse, HasRealStock)
        VALUES (src.WarehouseCode, src.des_alma, src.AllowsSales, src.AllowsPurchases, src.IsMaterialsWarehouse, src.IsProductionWarehouse, src.HasRealStock);
END
```

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/dwh/__tests__/dim-salesrep-warehouse-documenttype.test.ts
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

describe('Dim_SalesRep, Dim_Warehouse, Dim_DocumentType', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
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

  test('Dim_DocumentType is pre-seeded with the known Profit Plus document type domain', async () => {
    const result = await pool.request().query(`SELECT DocumentTypeCode, IsCredit, AffectsAR FROM dim.Dim_DocumentType`);
    expect(result.recordset.length).toBe(6);
    const fact = result.recordset.find(r => r.DocumentTypeCode.trim() === 'FACT');
    expect(fact.IsCredit).toBe(false);
    expect(fact.AffectsAR).toBe(true);
  });

  test('Load_Dim_SalesRep row count matches saVendedor', async () => {
    await pool.request().execute('dwh.Load_Dim_SalesRep');

    const erpCount = await erpPool.request().query(`SELECT COUNT(*) AS total FROM saVendedor`);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_SalesRep`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('Load_Dim_Warehouse flags HasRealStock correctly, matching only warehouses 13/14 per documented finding', async () => {
    await pool.request().execute('dwh.Load_Dim_Warehouse');

    const realStockWarehouses = await pool.request().query(`
      SELECT WarehouseCode FROM dim.Dim_Warehouse WHERE HasRealStock = 1
    `);
    const codes = realStockWarehouses.recordset.map(r => r.WarehouseCode.trim());
    expect(codes.length).toBeGreaterThan(0);
    // per erp-knowledge-base/docs/tables/saAlmacen.md, only 13 and 14 carry real stock today
    expect(codes.every(c => ['13', '14'].includes(c))).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/dim-salesrep-warehouse-documenttype.test.ts`
Expected: FAIL — none of these tables/procs exist yet.

- [ ] **Step 4: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/dim-salesrep-warehouse-documenttype.test.ts`
Expected: PASS. If the `HasRealStock` assertion fails because the live data has since changed from the documented 13/14 pattern, treat that as new information — update the test to match current reality rather than forcing the old expectation, and note the drift.

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0007_dim_salesrep_warehouse_documenttype.sql scripts/dwh/__tests__/dim-salesrep-warehouse-documenttype.test.ts
git commit -m "feat: add Dim_SalesRep, Dim_Warehouse, Dim_DocumentType to DWH"
```

---

## Task 7: Fact_Sales

**Files:**
- Create: `dwh-migrations/0008_fact_sales.sql`
- Test: `scripts/dwh/__tests__/fact-sales.test.ts`

**Interfaces:**
- Consumes: `Ncake_a.dbo.saFacturaVenta` (doc_num, co_cli, co_ven, co_mone, tasa, fec_emis, anulado, validador), `Ncake_a.dbo.saFacturaVentaReng` (reng_num, doc_num, co_art, co_alma, total_art, prec_vta, monto_desc, monto_desc_glob, monto_imp, monto_imp2, monto_imp3, reng_neto, validador), `dim.Dim_Date` (Task 2), `dim.Dim_Customer` (Task 4), `dim.Dim_Product` (Task 5), `dim.Dim_SalesRep` (Task 6), `dim.Dim_Warehouse` (Task 6), `dim.Dim_Currency` (Task 3), `dim.Dim_DocumentType` (Task 6)
- Produces: `fact.Fact_Sales` table and `dwh.Load_Fact_Sales` stored procedure (no parameters). Every column listed in spec §3.2's Fact_Sales table, with `UnitCost`/`COGSAmount`/`GrossProfitAmount` always `NULL` and `CostSourceFlag` always `'NO_COST_DATA'` in this phase (Global Constraints).

- [ ] **Step 1: Write `dwh-migrations/0008_fact_sales.sql`**

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Sales' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_Sales (
        FactSalesKey        bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey              int             NOT NULL,
        CustomerKey          int             NOT NULL,
        ProductKey           int             NOT NULL,
        SalesRepKey          int             NULL,
        WarehouseKey         int             NULL,
        CurrencyKey          int             NULL,
        DocumentTypeKey      int             NOT NULL,
        InvoiceNumber        char(20)        NOT NULL,
        LineNumber           int             NOT NULL,
        QuantitySold          decimal(18,5)   NOT NULL,
        GrossAmount           decimal(18,2)   NOT NULL,
        DiscountAmount        decimal(18,2)   NOT NULL,
        TaxAmount             decimal(18,2)   NOT NULL,
        NetAmount             decimal(18,2)   NOT NULL,
        UnitCost              decimal(18,5)   NULL,
        COGSAmount            decimal(18,2)   NULL,
        GrossProfitAmount     decimal(18,2)   NULL,
        CostSourceFlag        varchar(20)     NOT NULL,
        DocumentExchangeRate  decimal(21,8)   NULL,
        IsVoided              bit             NOT NULL,
        LoadedAtUtc            datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_Sales_Invoice_Line UNIQUE (InvoiceNumber, LineNumber),
        CONSTRAINT FK_Fact_Sales_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_Sales_Dim_Customer FOREIGN KEY (CustomerKey) REFERENCES dim.Dim_Customer(CustomerKey),
        CONSTRAINT FK_Fact_Sales_Dim_Product FOREIGN KEY (ProductKey) REFERENCES dim.Dim_Product(ProductKey),
        CONSTRAINT FK_Fact_Sales_Dim_SalesRep FOREIGN KEY (SalesRepKey) REFERENCES dim.Dim_SalesRep(SalesRepKey),
        CONSTRAINT FK_Fact_Sales_Dim_Warehouse FOREIGN KEY (WarehouseKey) REFERENCES dim.Dim_Warehouse(WarehouseKey),
        CONSTRAINT FK_Fact_Sales_Dim_Currency FOREIGN KEY (CurrencyKey) REFERENCES dim.Dim_Currency(CurrencyKey),
        CONSTRAINT FK_Fact_Sales_Dim_DocumentType FOREIGN KEY (DocumentTypeKey) REFERENCES dim.Dim_DocumentType(DocumentTypeKey)
    );
    CREATE INDEX IX_Fact_Sales_DateKey ON fact.Fact_Sales (DateKey);
    CREATE INDEX IX_Fact_Sales_CustomerKey ON fact.Fact_Sales (CustomerKey);
    CREATE INDEX IX_Fact_Sales_ProductKey ON fact.Fact_Sales (ProductKey);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaVentaReng')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saFacturaVentaReng', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_Sales
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaVentaReng');
    DECLARE @NewWatermark binary(8);
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
        WHERE r.validador > @Watermark OR f.validador > @Watermark
    )
    MERGE fact.Fact_Sales AS tgt
    USING (
        SELECT
            c.DateKey, c.reng_num, c.doc_num,
            cust.CustomerKey, prod.ProductKey, rep.SalesRepKey, wh.WarehouseKey, cur.CurrencyKey,
            c.total_art AS QuantitySold,
            (c.total_art * c.prec_vta) AS GrossAmount,
            c.DiscountAmount, c.TaxAmount, c.reng_neto AS NetAmount,
            c.tasa AS DocumentExchangeRate, c.anulado AS IsVoided
        FROM Changed c
        LEFT JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(c.co_cli) AND cust.IsCurrent = 1
        LEFT JOIN dim.Dim_Product prod ON RTRIM(prod.ProductCode) = RTRIM(c.co_art) AND prod.IsCurrent = 1
        LEFT JOIN dim.Dim_SalesRep rep ON RTRIM(rep.SalesRepCode) = RTRIM(c.co_ven)
        LEFT JOIN dim.Dim_Warehouse wh ON RTRIM(wh.WarehouseCode) = RTRIM(c.co_alma)
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(c.co_mone)
        CROSS APPLY (SELECT CONVERT(int, FORMAT(c.fec_emis, 'yyyyMMdd')) AS DateKey) dk
        WHERE cust.CustomerKey IS NOT NULL AND prod.ProductKey IS NOT NULL
    ) AS src
        ON tgt.InvoiceNumber = src.doc_num AND tgt.LineNumber = src.reng_num
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
            NULL, NULL, NULL, 'NO_COST_DATA', src.DocumentExchangeRate, src.IsVoided
        );

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(v), @Watermark) FROM (
        SELECT MAX(validador) AS v FROM Ncake_a.dbo.saFacturaVentaReng
        UNION ALL
        SELECT MAX(validador) FROM Ncake_a.dbo.saFacturaVenta
    ) x;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saFacturaVentaReng';
END
```

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/dwh/__tests__/fact-sales.test.ts
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

async function loadAllDimensions(pool: sql.ConnectionPool) {
  await pool.request().execute('dwh.Load_Dim_Currency');
  await pool.request().execute('dwh.Load_Dim_Customer');
  await pool.request().execute('dwh.Load_Dim_Product');
  await pool.request().execute('dwh.Load_Dim_SalesRep');
  await pool.request().execute('dwh.Load_Dim_Warehouse');
}

describe('Fact_Sales', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await loadAllDimensions(pool);
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

  test('loads a line for every saFacturaVentaReng row whose customer and product exist in dimensions', async () => {
    await pool.request().execute('dwh.Load_Fact_Sales');

    const erpCount = await erpPool.request().query(`
      SELECT COUNT(*) AS total
      FROM saFacturaVentaReng r
      INNER JOIN saFacturaVenta f ON f.doc_num = r.doc_num
      INNER JOIN saCliente c ON RTRIM(c.co_cli) = RTRIM(f.co_cli)
      INNER JOIN saArticulo a ON RTRIM(a.co_art) = RTRIM(r.co_art)
    `);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Sales`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('cost columns are NULL and CostSourceFlag is NO_COST_DATA for every row (margin deferred)', async () => {
    await pool.request().execute('dwh.Load_Fact_Sales');

    const badRows = await pool.request().query(`
      SELECT COUNT(*) AS total FROM fact.Fact_Sales
      WHERE UnitCost IS NOT NULL OR COGSAmount IS NOT NULL OR GrossProfitAmount IS NOT NULL OR CostSourceFlag <> 'NO_COST_DATA'
    `);
    expect(badRows.recordset[0].total).toBe(0);
  });

  test('NetAmount for a known invoice line matches saFacturaVentaReng.reng_neto exactly', async () => {
    await pool.request().execute('dwh.Load_Fact_Sales');

    const sample = await erpPool.request().query(`
      SELECT TOP 1 r.doc_num, r.reng_num, r.reng_neto
      FROM saFacturaVentaReng r INNER JOIN saFacturaVenta f ON f.doc_num = r.doc_num
      WHERE f.anulado = 0 ORDER BY f.fec_emis DESC
    `);
    const { doc_num, reng_num, reng_neto } = sample.recordset[0];

    const dwhRow = await pool.request()
      .input('inv', sql.Char(20), doc_num)
      .input('line', sql.Int, reng_num)
      .query(`SELECT NetAmount FROM fact.Fact_Sales WHERE InvoiceNumber = @inv AND LineNumber = @line`);

    expect(Number(dwhRow.recordset[0].NetAmount)).toBeCloseTo(Number(reng_neto), 2);
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Fact_Sales');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Sales`);

    await pool.request().execute('dwh.Load_Fact_Sales');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Sales`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/fact-sales.test.ts`
Expected: FAIL — `fact.Fact_Sales`/`dwh.Load_Fact_Sales` don't exist yet.

- [ ] **Step 4: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/fact-sales.test.ts`
Expected: PASS. Given the live-verified 3,446,649-row volume of `saFacturaVentaReng`, this test may take noticeably longer than the dimension tests — that's expected, not a bug; if it times out under the default `bun test` timeout, raise the per-test timeout rather than shrinking the query.

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0008_fact_sales.sql scripts/dwh/__tests__/fact-sales.test.ts
git commit -m "feat: add Fact_Sales to DWH (cost columns dormant, margin deferred)"
```

---

## Task 8: Fact_Returns

**Files:**
- Create: `dwh-migrations/0009_fact_returns.sql`
- Test: `scripts/dwh/__tests__/fact-returns.test.ts`

**Interfaces:**
- Consumes: `Ncake_a.dbo.saDevolucionCliente` (doc_num, co_cli, co_ven, co_mone, tasa, fec_emis, anulado, validador), `Ncake_a.dbo.saDevolucionClienteReng` (reng_num, doc_num, co_art, co_alma, total_art, prec_vta, monto_desc, monto_desc_glob, monto_imp, monto_imp2, monto_imp3, reng_neto, validador), same dims as Task 7
- Produces: `fact.Fact_Returns` table (identical shape to `Fact_Sales` minus the cost/margin columns per spec §3.2 "Fact_Returns — mirrors Fact_Sales column shape... No cost/margin columns") and `dwh.Load_Fact_Returns` stored procedure (no parameters).

- [ ] **Step 1: Write `dwh-migrations/0009_fact_returns.sql`**

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Returns' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_Returns (
        FactReturnsKey       bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey              int             NOT NULL,
        CustomerKey          int             NOT NULL,
        ProductKey           int             NOT NULL,
        SalesRepKey          int             NULL,
        WarehouseKey         int             NULL,
        CurrencyKey          int             NULL,
        DocumentTypeKey      int             NOT NULL,
        CreditNoteNumber     char(20)        NOT NULL,
        LineNumber           int             NOT NULL,
        QuantityReturned      decimal(18,5)   NOT NULL,
        GrossAmount           decimal(18,2)   NOT NULL,
        DiscountAmount        decimal(18,2)   NOT NULL,
        TaxAmount             decimal(18,2)   NOT NULL,
        NetAmount             decimal(18,2)   NOT NULL,
        DocumentExchangeRate  decimal(21,8)   NULL,
        IsVoided              bit             NOT NULL,
        LoadedAtUtc            datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_Returns_CreditNote_Line UNIQUE (CreditNoteNumber, LineNumber),
        CONSTRAINT FK_Fact_Returns_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_Returns_Dim_Customer FOREIGN KEY (CustomerKey) REFERENCES dim.Dim_Customer(CustomerKey),
        CONSTRAINT FK_Fact_Returns_Dim_Product FOREIGN KEY (ProductKey) REFERENCES dim.Dim_Product(ProductKey),
        CONSTRAINT FK_Fact_Returns_Dim_SalesRep FOREIGN KEY (SalesRepKey) REFERENCES dim.Dim_SalesRep(SalesRepKey),
        CONSTRAINT FK_Fact_Returns_Dim_Warehouse FOREIGN KEY (WarehouseKey) REFERENCES dim.Dim_Warehouse(WarehouseKey),
        CONSTRAINT FK_Fact_Returns_Dim_Currency FOREIGN KEY (CurrencyKey) REFERENCES dim.Dim_Currency(CurrencyKey),
        CONSTRAINT FK_Fact_Returns_Dim_DocumentType FOREIGN KEY (DocumentTypeKey) REFERENCES dim.Dim_DocumentType(DocumentTypeKey)
    );
    CREATE INDEX IX_Fact_Returns_DateKey ON fact.Fact_Returns (DateKey);
    CREATE INDEX IX_Fact_Returns_CustomerKey ON fact.Fact_Returns (CustomerKey);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saDevolucionClienteReng')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saDevolucionClienteReng', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_Returns
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saDevolucionClienteReng');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;
    DECLARE @DcliDocTypeKey int = (SELECT DocumentTypeKey FROM dim.Dim_DocumentType WHERE RTRIM(DocumentTypeCode) = 'N/CR');

    ;WITH Changed AS (
        SELECT
            r.reng_num, r.doc_num, r.co_art, r.co_alma, r.total_art, r.prec_vta,
            ISNULL(r.monto_desc, 0) + ISNULL(r.monto_desc_glob, 0) AS DiscountAmount,
            ISNULL(r.monto_imp, 0) + ISNULL(r.monto_imp2, 0) + ISNULL(r.monto_imp3, 0) AS TaxAmount,
            r.reng_neto,
            d.co_cli, d.co_ven, d.co_mone, d.tasa, d.fec_emis, ISNULL(d.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saDevolucionClienteReng r
        INNER JOIN Ncake_a.dbo.saDevolucionCliente d ON d.doc_num = r.doc_num
        WHERE r.validador > @Watermark OR d.validador > @Watermark
    )
    MERGE fact.Fact_Returns AS tgt
    USING (
        SELECT
            CONVERT(int, FORMAT(c.fec_emis, 'yyyyMMdd')) AS DateKey,
            c.reng_num, c.doc_num,
            cust.CustomerKey, prod.ProductKey, rep.SalesRepKey, wh.WarehouseKey, cur.CurrencyKey,
            c.total_art AS QuantityReturned,
            (c.total_art * c.prec_vta) AS GrossAmount,
            c.DiscountAmount, c.TaxAmount, c.reng_neto AS NetAmount,
            c.tasa AS DocumentExchangeRate, c.anulado AS IsVoided
        FROM Changed c
        LEFT JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(c.co_cli) AND cust.IsCurrent = 1
        LEFT JOIN dim.Dim_Product prod ON RTRIM(prod.ProductCode) = RTRIM(c.co_art) AND prod.IsCurrent = 1
        LEFT JOIN dim.Dim_SalesRep rep ON RTRIM(rep.SalesRepCode) = RTRIM(c.co_ven)
        LEFT JOIN dim.Dim_Warehouse wh ON RTRIM(wh.WarehouseCode) = RTRIM(c.co_alma)
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(c.co_mone)
        WHERE cust.CustomerKey IS NOT NULL AND prod.ProductKey IS NOT NULL
    ) AS src
        ON tgt.CreditNoteNumber = src.doc_num AND tgt.LineNumber = src.reng_num
    WHEN MATCHED THEN UPDATE SET
        tgt.DateKey = src.DateKey,
        tgt.CustomerKey = src.CustomerKey,
        tgt.ProductKey = src.ProductKey,
        tgt.SalesRepKey = src.SalesRepKey,
        tgt.WarehouseKey = src.WarehouseKey,
        tgt.CurrencyKey = src.CurrencyKey,
        tgt.QuantityReturned = src.QuantityReturned,
        tgt.GrossAmount = src.GrossAmount,
        tgt.DiscountAmount = src.DiscountAmount,
        tgt.TaxAmount = src.TaxAmount,
        tgt.NetAmount = src.NetAmount,
        tgt.DocumentExchangeRate = src.DocumentExchangeRate,
        tgt.IsVoided = src.IsVoided,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (
            DateKey, CustomerKey, ProductKey, SalesRepKey, WarehouseKey, CurrencyKey, DocumentTypeKey,
            CreditNoteNumber, LineNumber, QuantityReturned, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
            DocumentExchangeRate, IsVoided
        )
        VALUES (
            src.DateKey, src.CustomerKey, src.ProductKey, src.SalesRepKey, src.WarehouseKey, src.CurrencyKey, @DcliDocTypeKey,
            src.doc_num, src.reng_num, src.QuantityReturned, src.GrossAmount, src.DiscountAmount, src.TaxAmount, src.NetAmount,
            src.DocumentExchangeRate, src.IsVoided
        );

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(v), @Watermark) FROM (
        SELECT MAX(validador) AS v FROM Ncake_a.dbo.saDevolucionClienteReng
        UNION ALL
        SELECT MAX(validador) FROM Ncake_a.dbo.saDevolucionCliente
    ) x;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saDevolucionClienteReng';
END
```

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/dwh/__tests__/fact-returns.test.ts
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

describe('Fact_Returns', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_Product');
    await pool.request().execute('dwh.Load_Dim_SalesRep');
    await pool.request().execute('dwh.Load_Dim_Warehouse');
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

  test('loads a line for every saDevolucionClienteReng row whose customer and product exist in dimensions', async () => {
    await pool.request().execute('dwh.Load_Fact_Returns');

    const erpCount = await erpPool.request().query(`
      SELECT COUNT(*) AS total
      FROM saDevolucionClienteReng r
      INNER JOIN saDevolucionCliente d ON d.doc_num = r.doc_num
      INNER JOIN saCliente c ON RTRIM(c.co_cli) = RTRIM(d.co_cli)
      INNER JOIN saArticulo a ON RTRIM(a.co_art) = RTRIM(r.co_art)
    `);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Returns`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('Fact_Returns has no cost/margin columns (schema check)', async () => {
    const columns = await pool.request().query(`
      SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_Returns')
    `);
    const names = columns.recordset.map((c: { name: string }) => c.name);
    expect(names).not.toContain('UnitCost');
    expect(names).not.toContain('COGSAmount');
    expect(names).not.toContain('GrossProfitAmount');
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Fact_Returns');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Returns`);

    await pool.request().execute('dwh.Load_Fact_Returns');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Returns`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/fact-returns.test.ts`
Expected: FAIL — `fact.Fact_Returns`/`dwh.Load_Fact_Returns` don't exist yet.

- [ ] **Step 4: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/fact-returns.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0009_fact_returns.sql scripts/dwh/__tests__/fact-returns.test.ts
git commit -m "feat: add Fact_Returns to DWH"
```

---

## Task 9: Fact_Collections

**Files:**
- Create: `dwh-migrations/0010_fact_collections.sql`
- Test: `scripts/dwh/__tests__/fact-collections.test.ts`

**Interfaces:**
- Consumes: `Ncake_a.dbo.saCobro` (cob_num, co_cli, co_ven, co_mone, tasa, fecha, anulado, validador), `Ncake_a.dbo.saCobroDocReng` (reng_num, cob_num, co_tipo_doc, nro_doc, mont_cob, monto_retencion_iva, monto_retencion, dpcobro_monto, validador), `dim.Dim_Date`, `dim.Dim_Customer`, `dim.Dim_SalesRep`, `dim.Dim_Currency`, `dim.Dim_DocumentType`
- Produces: `fact.Fact_Collections` table and `dwh.Load_Fact_Collections` stored procedure (no parameters).

- [ ] **Step 1: Write `dwh-migrations/0010_fact_collections.sql`**

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Collections' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_Collections (
        FactCollectionsKey        bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey                   int             NOT NULL,
        CustomerKey               int             NOT NULL,
        SalesRepKey               int             NULL,
        CurrencyKey               int             NULL,
        InvoiceDocumentTypeKey    int             NULL,
        ReceiptNumber             char(20)        NOT NULL,
        InvoiceNumber             char(20)        NULL,
        LineNumber                int             NOT NULL,
        AmountCollected             decimal(18,2)   NOT NULL,
        RetentionIVAAmount          decimal(18,2)   NOT NULL,
        RetentionISLRAmount         decimal(18,2)   NOT NULL,
        EarlyPaymentDiscountAmount  decimal(18,2)   NOT NULL,
        DocumentExchangeRate       decimal(21,8)   NULL,
        IsVoided                  bit             NOT NULL,
        LoadedAtUtc                 datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_Collections_Receipt_Line UNIQUE (ReceiptNumber, LineNumber),
        CONSTRAINT FK_Fact_Collections_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_Collections_Dim_Customer FOREIGN KEY (CustomerKey) REFERENCES dim.Dim_Customer(CustomerKey),
        CONSTRAINT FK_Fact_Collections_Dim_SalesRep FOREIGN KEY (SalesRepKey) REFERENCES dim.Dim_SalesRep(SalesRepKey),
        CONSTRAINT FK_Fact_Collections_Dim_Currency FOREIGN KEY (CurrencyKey) REFERENCES dim.Dim_Currency(CurrencyKey),
        CONSTRAINT FK_Fact_Collections_Dim_DocumentType FOREIGN KEY (InvoiceDocumentTypeKey) REFERENCES dim.Dim_DocumentType(DocumentTypeKey)
    );
    CREATE INDEX IX_Fact_Collections_DateKey ON fact.Fact_Collections (DateKey);
    CREATE INDEX IX_Fact_Collections_CustomerKey ON fact.Fact_Collections (CustomerKey);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saCobroDocReng')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saCobroDocReng', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_Collections
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCobroDocReng');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    ;WITH Changed AS (
        SELECT
            r.reng_num, r.cob_num, r.co_tipo_doc, r.nro_doc,
            ISNULL(r.mont_cob, 0) AS mont_cob,
            ISNULL(r.monto_retencion_iva, 0) AS monto_retencion_iva,
            ISNULL(r.monto_retencion, 0) AS monto_retencion,
            ISNULL(r.dpcobro_monto, 0) AS dpcobro_monto,
            c.co_cli, c.co_ven, c.co_mone, c.tasa, c.fecha, ISNULL(c.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saCobroDocReng r
        INNER JOIN Ncake_a.dbo.saCobro c ON c.cob_num = r.cob_num
        WHERE r.validador > @Watermark OR c.validador > @Watermark
    )
    MERGE fact.Fact_Collections AS tgt
    USING (
        SELECT
            CONVERT(int, FORMAT(ch.fecha, 'yyyyMMdd')) AS DateKey,
            ch.reng_num, ch.cob_num, ch.nro_doc,
            cust.CustomerKey, rep.SalesRepKey, cur.CurrencyKey, dt.DocumentTypeKey,
            ch.mont_cob AS AmountCollected, ch.monto_retencion_iva AS RetentionIVAAmount,
            ch.monto_retencion AS RetentionISLRAmount, ch.dpcobro_monto AS EarlyPaymentDiscountAmount,
            ch.tasa AS DocumentExchangeRate, ch.anulado AS IsVoided
        FROM Changed ch
        LEFT JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(ch.co_cli) AND cust.IsCurrent = 1
        LEFT JOIN dim.Dim_SalesRep rep ON RTRIM(rep.SalesRepCode) = RTRIM(ch.co_ven)
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(ch.co_mone)
        LEFT JOIN dim.Dim_DocumentType dt ON RTRIM(dt.DocumentTypeCode) = RTRIM(ch.co_tipo_doc)
        WHERE cust.CustomerKey IS NOT NULL
    ) AS src
        ON tgt.ReceiptNumber = src.cob_num AND tgt.LineNumber = src.reng_num
    WHEN MATCHED THEN UPDATE SET
        tgt.DateKey = src.DateKey,
        tgt.CustomerKey = src.CustomerKey,
        tgt.SalesRepKey = src.SalesRepKey,
        tgt.CurrencyKey = src.CurrencyKey,
        tgt.InvoiceDocumentTypeKey = src.DocumentTypeKey,
        tgt.InvoiceNumber = src.nro_doc,
        tgt.AmountCollected = src.AmountCollected,
        tgt.RetentionIVAAmount = src.RetentionIVAAmount,
        tgt.RetentionISLRAmount = src.RetentionISLRAmount,
        tgt.EarlyPaymentDiscountAmount = src.EarlyPaymentDiscountAmount,
        tgt.DocumentExchangeRate = src.DocumentExchangeRate,
        tgt.IsVoided = src.IsVoided,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (
            DateKey, CustomerKey, SalesRepKey, CurrencyKey, InvoiceDocumentTypeKey,
            ReceiptNumber, InvoiceNumber, LineNumber, AmountCollected, RetentionIVAAmount,
            RetentionISLRAmount, EarlyPaymentDiscountAmount, DocumentExchangeRate, IsVoided
        )
        VALUES (
            src.DateKey, src.CustomerKey, src.SalesRepKey, src.CurrencyKey, src.DocumentTypeKey,
            src.cob_num, src.nro_doc, src.reng_num, src.AmountCollected, src.RetentionIVAAmount,
            src.RetentionISLRAmount, src.EarlyPaymentDiscountAmount, src.DocumentExchangeRate, src.IsVoided
        );

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(v), @Watermark) FROM (
        SELECT MAX(validador) AS v FROM Ncake_a.dbo.saCobroDocReng
        UNION ALL
        SELECT MAX(validador) FROM Ncake_a.dbo.saCobro
    ) x;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCobroDocReng';
END
```

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/dwh/__tests__/fact-collections.test.ts
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

describe('Fact_Collections', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_SalesRep');
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

  test('loads a line for every saCobroDocReng row whose customer exists in dimensions', async () => {
    await pool.request().execute('dwh.Load_Fact_Collections');

    const erpCount = await erpPool.request().query(`
      SELECT COUNT(*) AS total
      FROM saCobroDocReng r
      INNER JOIN saCobro c ON c.cob_num = r.cob_num
      INNER JOIN saCliente cl ON RTRIM(cl.co_cli) = RTRIM(c.co_cli)
    `);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Collections`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('retention amounts for a known collection line match saCobroDocReng exactly', async () => {
    await pool.request().execute('dwh.Load_Fact_Collections');

    const sample = await erpPool.request().query(`
      SELECT TOP 1 r.cob_num, r.reng_num, r.mont_cob, r.monto_retencion_iva
      FROM saCobroDocReng r INNER JOIN saCobro c ON c.cob_num = r.cob_num
      WHERE c.anulado = 0 AND r.monto_retencion_iva > 0
    `);
    if (sample.recordset.length === 0) return; // no IVA-retention collections in this dataset — skip assertion

    const { cob_num, reng_num, mont_cob, monto_retencion_iva } = sample.recordset[0];
    const dwhRow = await pool.request()
      .input('receipt', sql.Char(20), cob_num)
      .input('line', sql.Int, reng_num)
      .query(`SELECT AmountCollected, RetentionIVAAmount FROM fact.Fact_Collections WHERE ReceiptNumber = @receipt AND LineNumber = @line`);

    expect(Number(dwhRow.recordset[0].AmountCollected)).toBeCloseTo(Number(mont_cob), 2);
    expect(Number(dwhRow.recordset[0].RetentionIVAAmount)).toBeCloseTo(Number(monto_retencion_iva), 2);
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Fact_Collections');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Collections`);

    await pool.request().execute('dwh.Load_Fact_Collections');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Collections`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/fact-collections.test.ts`
Expected: FAIL — `fact.Fact_Collections`/`dwh.Load_Fact_Collections` don't exist yet.

- [ ] **Step 4: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/fact-collections.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0010_fact_collections.sql scripts/dwh/__tests__/fact-collections.test.ts
git commit -m "feat: add Fact_Collections to DWH"
```

---

## Task 10: Fact_AR_Snapshot + daily snapshot procedure

**Files:**
- Create: `dwh-migrations/0011_fact_ar_snapshot.sql`
- Test: `scripts/dwh/__tests__/fact-ar-snapshot.test.ts`

**Interfaces:**
- Consumes: `Ncake_a.dbo.saDocumentoVenta` (co_tipo_doc, nro_doc, co_cli, co_mone, tasa, fec_venc, saldo, anulado), `dim.Dim_Date`, `dim.Dim_Customer`, `dim.Dim_Currency`, `dim.Dim_DocumentType`
- Produces: `fact.Fact_AR_Snapshot` table and `dwh.Snapshot_Fact_AR` stored procedure, taking one optional parameter `@SnapshotDate date = NULL` (defaults to `CAST(SYSUTCDATETIME() AS date)` when not supplied — lets a test pass an explicit historical date without waiting for real time to pass, while the SQL Agent job in Task 12 calls it with no argument for "today").

- [ ] **Step 1: Write `dwh-migrations/0011_fact_ar_snapshot.sql`**

```sql
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_AR_Snapshot' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_AR_Snapshot (
        FactARSnapshotKey    bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SnapshotDateKey      int             NOT NULL,
        CustomerKey          int             NOT NULL,
        DocumentTypeKey      int             NULL,
        InvoiceNumber        char(20)        NOT NULL,
        CurrencyKey          int             NULL,
        OutstandingBalance    decimal(18,2)   NOT NULL,
        DocumentExchangeRate  decimal(21,8)   NULL,
        DueDate               date            NULL,
        DaysPastDue           int             NULL,
        AgingBucket           varchar(10)     NOT NULL,
        IsCreditNote          bit             NOT NULL,
        LoadedAtUtc            datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_AR_Snapshot_Date_Invoice UNIQUE (SnapshotDateKey, InvoiceNumber),
        CONSTRAINT FK_Fact_AR_Snapshot_Dim_Date FOREIGN KEY (SnapshotDateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_AR_Snapshot_Dim_Customer FOREIGN KEY (CustomerKey) REFERENCES dim.Dim_Customer(CustomerKey),
        CONSTRAINT FK_Fact_AR_Snapshot_Dim_DocumentType FOREIGN KEY (DocumentTypeKey) REFERENCES dim.Dim_DocumentType(DocumentTypeKey),
        CONSTRAINT FK_Fact_AR_Snapshot_Dim_Currency FOREIGN KEY (CurrencyKey) REFERENCES dim.Dim_Currency(CurrencyKey)
    );
    CREATE INDEX IX_Fact_AR_Snapshot_SnapshotDateKey ON fact.Fact_AR_Snapshot (SnapshotDateKey);
    CREATE INDEX IX_Fact_AR_Snapshot_CustomerKey ON fact.Fact_AR_Snapshot (CustomerKey);
END
GO

CREATE OR ALTER PROCEDURE dwh.Snapshot_Fact_AR
    @SnapshotDate date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @SnapshotDate IS NULL SET @SnapshotDate = CAST(SYSUTCDATETIME() AS date);
    DECLARE @SnapshotDateKey int = CONVERT(int, FORMAT(@SnapshotDate, 'yyyyMMdd'));

    IF NOT EXISTS (SELECT 1 FROM dim.Dim_Date WHERE DateKey = @SnapshotDateKey)
    BEGIN
        RAISERROR('Snapshot date %s (key %d) is outside the Dim_Date calendar range. Extend Dim_Date before snapshotting.', 16, 1, @SnapshotDate, @SnapshotDateKey);
        RETURN;
    END

    DELETE FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = @SnapshotDateKey;

    INSERT INTO fact.Fact_AR_Snapshot (
        SnapshotDateKey, CustomerKey, DocumentTypeKey, InvoiceNumber, CurrencyKey,
        OutstandingBalance, DocumentExchangeRate, DueDate, DaysPastDue, AgingBucket, IsCreditNote
    )
    SELECT
        @SnapshotDateKey,
        cust.CustomerKey,
        dt.DocumentTypeKey,
        RTRIM(d.nro_doc),
        cur.CurrencyKey,
        d.saldo,
        d.tasa,
        CAST(d.fec_venc AS date),
        DATEDIFF(day, d.fec_venc, @SnapshotDate),
        CASE
            WHEN RTRIM(d.co_tipo_doc) IN ('N/CR', 'NCR') THEN 'N/A'
            WHEN DATEDIFF(day, d.fec_venc, @SnapshotDate) <= 0 THEN 'Current'
            WHEN DATEDIFF(day, d.fec_venc, @SnapshotDate) BETWEEN 1 AND 30 THEN '1-30'
            WHEN DATEDIFF(day, d.fec_venc, @SnapshotDate) BETWEEN 31 AND 60 THEN '31-60'
            WHEN DATEDIFF(day, d.fec_venc, @SnapshotDate) BETWEEN 61 AND 90 THEN '61-90'
            ELSE '>90'
        END,
        CASE WHEN RTRIM(d.co_tipo_doc) IN ('N/CR', 'NCR') THEN 1 ELSE 0 END
    FROM Ncake_a.dbo.saDocumentoVenta d
    INNER JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(d.co_cli) AND cust.IsCurrent = 1
    LEFT JOIN dim.Dim_DocumentType dt ON RTRIM(dt.DocumentTypeCode) = RTRIM(d.co_tipo_doc)
    LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(d.co_mone)
    WHERE ISNULL(d.anulado, 0) = 0 AND d.saldo <> 0;
END
```

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/dwh/__tests__/fact-ar-snapshot.test.ts
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

describe('Fact_AR_Snapshot', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Dim_Customer');
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

  test('snapshots every open, non-voided document whose customer exists in dimensions', async () => {
    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-25')).execute('dwh.Snapshot_Fact_AR');

    const erpCount = await erpPool.request().query(`
      SELECT COUNT(*) AS total
      FROM saDocumentoVenta d
      INNER JOIN saCliente c ON RTRIM(c.co_cli) = RTRIM(d.co_cli)
      WHERE ISNULL(d.anulado, 0) = 0 AND d.saldo <> 0
    `);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = 20260825`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('credit notes are flagged IsCreditNote=1 and excluded from normal aging buckets', async () => {
    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-25')).execute('dwh.Snapshot_Fact_AR');

    const creditNoteRows = await pool.request().query(`
      SELECT AgingBucket, IsCreditNote FROM fact.Fact_AR_Snapshot
      WHERE SnapshotDateKey = 20260825 AND IsCreditNote = 1
    `);
    for (const row of creditNoteRows.recordset) {
      expect(row.AgingBucket).toBe('N/A');
    }
  });

  test('re-snapshotting the same date replaces rather than duplicates', async () => {
    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-25')).execute('dwh.Snapshot_Fact_AR');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = 20260825`);

    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-25')).execute('dwh.Snapshot_Fact_AR');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = 20260825`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });

  test('two different snapshot dates coexist independently', async () => {
    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-24')).execute('dwh.Snapshot_Fact_AR');
    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-25')).execute('dwh.Snapshot_Fact_AR');

    const bothDates = await pool.request().query(`
      SELECT DISTINCT SnapshotDateKey FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey IN (20260824, 20260825)
    `);
    expect(bothDates.recordset.length).toBe(2);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/fact-ar-snapshot.test.ts`
Expected: FAIL — `fact.Fact_AR_Snapshot`/`dwh.Snapshot_Fact_AR` don't exist yet.

- [ ] **Step 4: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/fact-ar-snapshot.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0011_fact_ar_snapshot.sql scripts/dwh/__tests__/fact-ar-snapshot.test.ts
git commit -m "feat: add Fact_AR_Snapshot and daily aging snapshot procedure"
```

---

## Task 11: SQL Agent jobs for scheduled loading

**Files:**
- Create: `dwh-migrations/0012_sql_agent_jobs.sql`
- Test: `scripts/dwh/__tests__/sql-agent-jobs.test.ts`

**Interfaces:**
- Consumes: every `dwh.Load_*` and `dwh.Snapshot_Fact_AR` procedure from Tasks 3–10
- Produces: two SQL Agent jobs — `DWH - Incremental Load` (runs `Load_Dim_Currency`, `Load_Fact_ExchangeRate`, `Load_Dim_Customer`, `Load_Dim_Product`, `Load_Dim_SalesRep`, `Load_Dim_Warehouse`, `Load_Fact_Sales`, `Load_Fact_Returns`, `Load_Fact_Collections` as sequential job steps in that dependency order, per spec §5.1) and `DWH - Daily AR Snapshot` (runs `Snapshot_Fact_AR` with no parameter). Both created disabled (`@enabled = 0`) — spec §5.1 flags load frequency as an open business decision, not a technical one; this task provides the mechanism, not a live schedule. Enabling them and picking a cadence is a follow-up action for whoever owns the SQL Server instance, not part of this plan's automated test coverage (SQL Agent job *execution* isn't something `bun test` can practically assert on in a short-lived test database).

- [ ] **Step 1: Write `dwh-migrations/0012_sql_agent_jobs.sql`**

```sql
USE msdb;
GO

IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = 'DWH - Incremental Load')
BEGIN
    EXEC msdb.dbo.sp_add_job
        @job_name = N'DWH - Incremental Load',
        @enabled = 0,
        @description = N'Loads all DWH_AlimentosNY dimensions and transaction facts from the Ncake_a ERP, in dependency order. Disabled by default — enable and set a schedule once the business has decided a load cadence (spec 2026-08-25-sales-margin-collections-dwh-design.md, section 5.1).';

    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 1, @step_name = N'Load_Dim_Currency', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Dim_Currency;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 2, @step_name = N'Load_Fact_ExchangeRate', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Fact_ExchangeRate;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 3, @step_name = N'Load_Dim_Customer', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Dim_Customer;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 4, @step_name = N'Load_Dim_Product', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Dim_Product;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 5, @step_name = N'Load_Dim_SalesRep', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Dim_SalesRep;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 6, @step_name = N'Load_Dim_Warehouse', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Dim_Warehouse;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 7, @step_name = N'Load_Fact_Sales', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Fact_Sales;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 8, @step_name = N'Load_Fact_Returns', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Fact_Returns;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 9, @step_name = N'Load_Fact_Collections', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Fact_Collections;';

    EXEC msdb.dbo.sp_add_jobserver @job_name = N'DWH - Incremental Load', @server_name = N'(local)';
END
GO

IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = 'DWH - Daily AR Snapshot')
BEGIN
    EXEC msdb.dbo.sp_add_job
        @job_name = N'DWH - Daily AR Snapshot',
        @enabled = 0,
        @description = N'Takes one daily snapshot of open AR balances into Fact_AR_Snapshot. Disabled by default — enable and schedule for after business close once ready (spec 2026-08-25-sales-margin-collections-dwh-design.md, section 3.2/5.1).';

    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Daily AR Snapshot', @step_id = 1, @step_name = N'Snapshot_Fact_AR', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Snapshot_Fact_AR;';

    EXEC msdb.dbo.sp_add_jobserver @job_name = N'DWH - Daily AR Snapshot', @server_name = N'(local)';
END
GO
```

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/dwh/__tests__/sql-agent-jobs.test.ts
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

describe('SQL Agent jobs', () => {
  let msdbPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    msdbPool = await new sql.ConnectionPool(testConfig('msdb')).connect();
  });

  afterAll(async () => {
    await msdbPool.request().query(`
      IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = 'DWH - Incremental Load')
          EXEC msdb.dbo.sp_delete_job @job_name = N'DWH - Incremental Load';
      IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = 'DWH - Daily AR Snapshot')
          EXEC msdb.dbo.sp_delete_job @job_name = N'DWH - Daily AR Snapshot';
    `);
    await msdbPool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('both jobs exist, disabled, with the correct step count', async () => {
    const jobs = await msdbPool.request().query(`
      SELECT name, enabled FROM msdb.dbo.sysjobs
      WHERE name IN ('DWH - Incremental Load', 'DWH - Daily AR Snapshot')
    `);
    expect(jobs.recordset.length).toBe(2);
    for (const job of jobs.recordset) {
      expect(job.enabled).toBe(0);
    }

    const incrementalSteps = await msdbPool.request().query(`
      SELECT COUNT(*) AS total FROM msdb.dbo.sysjobsteps s
      INNER JOIN msdb.dbo.sysjobs j ON j.job_id = s.job_id
      WHERE j.name = 'DWH - Incremental Load'
    `);
    expect(incrementalSteps.recordset[0].total).toBe(9);

    const snapshotSteps = await msdbPool.request().query(`
      SELECT COUNT(*) AS total FROM msdb.dbo.sysjobsteps s
      INNER JOIN msdb.dbo.sysjobs j ON j.job_id = s.job_id
      WHERE j.name = 'DWH - Daily AR Snapshot'
    `);
    expect(snapshotSteps.recordset[0].total).toBe(1);
  });

  test('Incremental Load job steps run in the documented dependency order', async () => {
    const steps = await msdbPool.request().query(`
      SELECT s.step_id, s.step_name FROM msdb.dbo.sysjobsteps s
      INNER JOIN msdb.dbo.sysjobs j ON j.job_id = s.job_id
      WHERE j.name = 'DWH - Incremental Load'
      ORDER BY s.step_id
    `);
    const names = steps.recordset.map((s: { step_name: string }) => s.step_name);
    expect(names).toEqual([
      'Load_Dim_Currency', 'Load_Fact_ExchangeRate', 'Load_Dim_Customer', 'Load_Dim_Product',
      'Load_Dim_SalesRep', 'Load_Dim_Warehouse', 'Load_Fact_Sales', 'Load_Fact_Returns', 'Load_Fact_Collections',
    ]);
  });
});
```

**Note**: this test requires SQL Server Agent to be running on the target instance and the connecting login to have rights over `msdb`. If the test environment's SQL Server doesn't have Agent enabled (common on some managed/restricted instances), this test will fail with a permissions or "Agent XPs disabled" error unrelated to the migration itself — that's an environment gap to flag to the user, not a bug in the migration SQL, and this task's `.sql` file is still correct T-SQL to run manually via SSMS if Agent is unavailable to `bun test`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/sql-agent-jobs.test.ts`
Expected: FAIL — the jobs don't exist yet (or, per the note above, may fail with an Agent-availability error — resolve that with the user before treating this task as blocked).

- [ ] **Step 4: Run the test to verify it passes**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/sql-agent-jobs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0012_sql_agent_jobs.sql scripts/dwh/__tests__/sql-agent-jobs.test.ts
git commit -m "feat: add disabled SQL Agent jobs for DWH incremental load and AR snapshot"
```

---

## Task 12: Full-pipeline smoke test + README

**Files:**
- Create: `scripts/dwh/__tests__/full-pipeline-smoke.test.ts`
- Create: `dwh-migrations/README.md`

**Interfaces:**
- Consumes: every `dwh.Load_*`/`dwh.Snapshot_Fact_AR` procedure from Tasks 3–10, run in the same order as the `DWH - Incremental Load` job from Task 11.
- Produces: no new schema — this task is a final end-to-end confidence check plus operator documentation, run once all prior tasks are individually green.

- [ ] **Step 1: Write the full-pipeline smoke test**

```typescript
// scripts/dwh/__tests__/full-pipeline-smoke.test.ts
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

describe('Full DWH pipeline smoke test', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
  });

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('running every load procedure in dependency order succeeds end-to-end with no orphaned FK references', async () => {
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Fact_ExchangeRate');
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_Product');
    await pool.request().execute('dwh.Load_Dim_SalesRep');
    await pool.request().execute('dwh.Load_Dim_Warehouse');
    await pool.request().execute('dwh.Load_Fact_Sales');
    await pool.request().execute('dwh.Load_Fact_Returns');
    await pool.request().execute('dwh.Load_Fact_Collections');
    await pool.request().input('SnapshotDate', sql.Date, new Date()).execute('dwh.Snapshot_Fact_AR');

    const counts = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dim.Dim_Date) AS dates,
        (SELECT COUNT(*) FROM dim.Dim_Currency) AS currencies,
        (SELECT COUNT(*) FROM dim.Dim_Customer WHERE IsCurrent = 1) AS customers,
        (SELECT COUNT(*) FROM dim.Dim_Product WHERE IsCurrent = 1) AS products,
        (SELECT COUNT(*) FROM fact.Fact_Sales) AS sales,
        (SELECT COUNT(*) FROM fact.Fact_Returns) AS returns,
        (SELECT COUNT(*) FROM fact.Fact_Collections) AS collections,
        (SELECT COUNT(*) FROM fact.Fact_AR_Snapshot) AS ar_snapshot
    `);
    const row = counts.recordset[0];
    expect(row.dates).toBeGreaterThan(0);
    expect(row.currencies).toBeGreaterThan(0);
    expect(row.customers).toBeGreaterThan(0);
    expect(row.products).toBeGreaterThan(0);
    expect(row.sales).toBeGreaterThan(0);
    // returns/collections/ar_snapshot may legitimately be 0 in a sparse dataset — no lower-bound assertion beyond "query succeeded"
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/__tests__/full-pipeline-smoke.test.ts`
Expected: this should already PASS if Tasks 1-11 were completed correctly — there's no new SQL in this task, only an integration check. If it fails, the failure points at a real integration bug between two previously-"passing" tasks (e.g. a dimension key type mismatch) that the per-task tests missed; fix that bug in its owning task's migration file, not here.

- [ ] **Step 3: Write `dwh-migrations/README.md`**

```markdown
# DWH Migrations — DWH_AlimentosNY

Numbered `.sql` files applied in order by `scripts/migrate-dwh.ts` (`bun run migrate:dwh`), tracked in `dwh.__dwh_migrations`.

## Running

    bun run migrate:dwh

Reads `DW_SERVER`/`DW_PORT`/`DW_NAME`/`DW_USER`/`DW_PASSWORD`/`DW_ENCRYPT`/`DW_TRUST_SERVER_CERT` from the environment, falling back to the corresponding `DB_*` value (same instance, different database) when a `DW_*` var is unset. `DW_NAME` defaults to `DWH_AlimentosNY` if neither is set.

The runner connects to `master` first to create the database if it doesn't exist yet, then reconnects to the DWH database for every subsequent migration.

## Layout

- `dwh` schema — control tables (`EtlWatermark`, `__dwh_migrations`) and every `Load_*`/`Snapshot_*` stored procedure
- `dim` schema — dimension tables
- `fact` schema — fact tables

## Adding a new migration

1. Create the next-numbered `.sql` file (e.g. `0013_...sql`)
2. Wrap `CREATE TABLE`/`CREATE PROCEDURE` in existence checks (`IF NOT EXISTS` / `CREATE OR ALTER`) so re-running is always safe
3. Separate multi-batch DDL (anything needing more than one `CREATE`/`ALTER` in sequence) with a line containing only `GO`
4. Run `bun run migrate:dwh` locally against a test database before committing

## Margin/cost data — deferred

`Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount` are wired into the schema but always `NULL` (`CostSourceFlag = 'NO_COST_DATA'`) as of this plan. See `docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md` §1/§2/§8 — no finished-goods production cost has ever been recorded in Profit Plus for this installation. Do not build a margin dashboard against these columns until that upstream gap is resolved and this note is removed.

## Enabling the SQL Agent jobs

`DWH - Incremental Load` and `DWH - Daily AR Snapshot` (from `0012_sql_agent_jobs.sql`) are created **disabled**. Load frequency is an open business decision (spec §5.1) — pick a schedule, then:

```sql
EXEC msdb.dbo.sp_update_job @job_name = N'DWH - Incremental Load', @enabled = 1;
EXEC msdb.dbo.sp_add_jobschedule @job_name = N'DWH - Incremental Load', @name = N'Every 30 min', @freq_type = 4, @freq_interval = 1, @freq_subday_type = 4, @freq_subday_interval = 30;

EXEC msdb.dbo.sp_update_job @job_name = N'DWH - Daily AR Snapshot', @enabled = 1;
EXEC msdb.dbo.sp_add_jobschedule @job_name = N'DWH - Daily AR Snapshot', @name = N'Daily after close', @freq_type = 4, @freq_interval = 1, @freq_subday_type = 1, @active_start_time = 220000;
```
```

- [ ] **Step 4: Run the full test suite one more time to confirm nothing regressed**

Run: `DW_NAME=DWH_AlimentosNY_Test bun test scripts/dwh/`
Expected: PASS for every test file from Tasks 1-12.

- [ ] **Step 5: Commit**

```bash
git add scripts/dwh/__tests__/full-pipeline-smoke.test.ts dwh-migrations/README.md
git commit -m "test: add full-pipeline smoke test and DWH migrations README"
```
