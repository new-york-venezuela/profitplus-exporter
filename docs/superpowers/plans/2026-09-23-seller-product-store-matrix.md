# Seller × Product × Store Matrix ("Matriz Vendedor-Producto") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Matriz Vendedor-Producto" Analítica tab (seller leaderboard, searchable seller picker, per-seller product×store pivot with line/subline/category metadata) and a flat XLSX export for arbitrary Excel pivoting, plus a reusable searchable-select component.

**Architecture:** A new `dim.Dim_Date` migration adds `WeekStartDate`/`YearWeek` columns. A new `app/api/dwh/matriz-vendedor/route.ts` serves three sections (`summary`, `matrix`, `format=xlsx`) scoped to one seller at a time (bounded joins, never a full cross product), reusing `usdConversionJoin`/`dualAmountExpr` from `query-builder.ts` for historical USD conversion in the export. A new `lib/components/searchable-select.tsx` client component (in-memory filter, no server search) replaces the existing native Tienda `<select>` in `tab-productos.tsx` and powers the new seller picker.

**Tech Stack:** Next.js 16 App Router, `mssql`, Bun test runner, TypeScript, React, `xlsx` (via `lib/xlsx.ts`).

**Spec:** `docs/superpowers/specs/2026-09-23-seller-product-store-matrix-design.md`

**Sequence:** 2nd of 4 planned changes, in this order: (1) `2026-09-23-historical-usd-conversion.md` (this plan's hard blocker — see below), (2) **this plan**, (3) a `migrations/` directory reorg (`dwh-migrations/` → `migrations/dwh/`, etc. — bounded, no written plan doc; not yet executed; runs AFTER this plan so it picks up this plan's Task 1 migration file (`dwh-migrations/0033_dim_date_add_week.sql`) via a plain `git mv` — no path edits needed in this plan for that reorg to work correctly), (4) a not-yet-written "Histórico 2025" legacy-ERP-import spec/plan.

## Global Constraints

- **HARD BLOCKER: this plan cannot be executed until `docs/superpowers/plans/2026-09-23-historical-usd-conversion.md` is fully implemented and merged.** Task 4 of this plan calls `usdConversionJoin(factAlias, dateColumn?)` and `dualAmountExpr(factAlias, column, bsAlias, usdAlias)` from `app/api/dwh/lib/query-builder.ts` — these functions do not exist yet; they are added by that other plan's Task 1. Do not start Task 4 (or anything after it) until `query-builder.ts` exports them. Tasks 1–3 (migration, summary section, matrix section) have no such dependency and may be executed independently first if useful.
- Exact signatures this plan depends on (from the other plan's Task 1, copied here verbatim so this plan is self-contained once that dependency lands):
  - `export function usdConversionJoin(factAlias: string, dateColumn: string = 'DateKey'): string` → `` `LEFT JOIN fact.Fact_ExchangeRate fx ON fx.DateKey = ${factAlias}.${dateColumn} AND fx.CurrencyKey = (SELECT CurrencyKey FROM dim.Dim_Currency WHERE RTRIM(CurrencyCode) = 'USD')` ``
  - `export function dualAmountExpr(factAlias: string, column: string, bsAlias: string, usdAlias: string): string` → returns `` `SUM(${factAlias}.${column}) AS ${bsAlias}, SUM(${factAlias}.${column} / NULLIF(COALESCE(${factAlias}.DocumentExchangeRate, fx.RateSell), 0)) AS ${usdAlias}` ``
  - `export interface DualAmount { bs: number; usd: number | null }` in `app/(app)/analitica/types.ts`
- No new `user_modules` module — gated by the existing `'dwh'` module via `requireDwhAccess` (API) and the page-level `hasDwhAccess` gate `/analitica` already has (Server Component, unchanged by this plan).
- No zero-filled cross join anywhere — both the matrix JSON and the XLSX export only ever emit rows/cells for `(product, store[, week])` combinations with actual non-zero sales or returns in the selected range.
- No margin/cost data — `Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount` are unwired (`NO_COST_DATA`); this feature never reads them.
- Current highest `dwh-migrations/` file is `0032_backfill_legalentitykey_noncurrent.sql` (confirmed via `ls dwh-migrations/`) — the new migration is `0033_dim_date_add_week.sql`.
- Route tests in this repo are auth-smoke-tests only (assert 401 for an unauthenticated `GET`) — confirmed by reading `app/api/dwh/clientes/__tests__/route.test.ts`. This repo has no live-DB integration tests at the `app/api/dwh/*` route level. Follow this exact pattern for the new route's auth tests; the matrix/summary SQL logic itself is tested via a pure-string-assertion unit test the same way `query-builder.test.ts` tests its own helpers, and the XLSX export's row-shaping logic is tested by extracting it into a pure function and unit-testing that directly (see Task 4).
- Run tests with `bun test <path>` for pure-TS/React files — no `--env-file`/`--timeout`/DB needed. `--isolate --env-file=.env.local --timeout 30000` is only for `scripts/dwh/` tests that provision a real disposable database, which this plan does not touch.
- Every commit ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## Task 1: `dim.Dim_Date` week columns migration

**Files:**
- Create: `dwh-migrations/0033_dim_date_add_week.sql`
- Test: `scripts/dwh/__tests__/0033-dim-date-week.test.ts`

**Interfaces:**
- Produces: `dim.Dim_Date.WeekStartDate` (`date NOT NULL` — the Monday of the ISO week containing `FullDate`), `dim.Dim_Date.YearWeek` (`char(7) NOT NULL` — `'YYYY-Www'`, using the ISO week-year, which can differ from `YEAR(FullDate)` at year boundaries).
- Consumes: nothing new — reads only the existing `dim.Dim_Date.FullDate` column populated by `0003_dim_date.sql`.

**Design notes:**

Adding a `NOT NULL` column to an existing non-empty table needs either a `DEFAULT` or a three-step add-nullable/backfill/alter-to-not-null sequence. `Dim_Date` already has ~5840 rows (2020-01-01 through 2035-12-31 daily), so this migration adds both columns as nullable, backfills via one `UPDATE`, then `ALTER COLUMN` each to `NOT NULL`. Follows the existing `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(...) AND name = ...)` guard idiom from `dwh-migrations/0014_dim_legal_entity.sql:3-9`, with `GO` separating each batch (this repo's multi-batch DDL convention per `dwh-migrations/README.md`).

Monday-anchoring: `DATEPART(weekday, FullDate)` is `DATEFIRST`-dependent (returns 1-7 for whatever day `SET DATEFIRST` currently points at), so it cannot be used directly to always mean "1=Monday." Instead, anchor off `DATEPART(iso_week, ...)`/`DATEPART(weekday, ...)` combined with `@@DATEFIRST`-independent arithmetic: `DATEADD(day, 1 - ((DATEPART(weekday, FullDate) + @@DATEFIRST - 2) % 7 + 1), FullDate)` normalizes the weekday number to an ISO Monday=1 basis regardless of session `DATEFIRST`, then subtracts back to Monday. `YearWeek`'s ISO week-year uses `DATEPART(iso_week, ...)` combined with the year of the Thursday of that same ISO week (`DATEADD(day, 3, WeekStartDate)`), since the ISO week-year is defined as the year containing that week's Thursday — this correctly handles both the late-December (week 1 of next year can start in December) and early-January (last week of prior year can extend into January) boundary cases without a special-case branch.

- [ ] **Step 1: Write the failing test**

Create `scripts/dwh/__tests__/0033-dim-date-week.test.ts`:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runMigrations } from '../../migrate-dwh';
import { getTestDwhConfig, dropTestDatabase } from '../test-helpers';

describe('0033_dim_date_add_week migration', () => {
  let pool: sql.ConnectionPool;
  const config = getTestDwhConfig('test_0033_dim_date_week');

  beforeAll(async () => {
    await runMigrations(config);
    pool = await sql.connect(config);
  }, 30000);

  afterAll(async () => {
    await pool.close();
    await dropTestDatabase(config);
  }, 30000);

  test('WeekStartDate is always a Monday', async () => {
    const result = await pool.request().query(`
      SELECT TOP 20 FullDate, WeekStartDate, DATENAME(weekday, WeekStartDate) AS WeekdayName
      FROM dim.Dim_Date
      WHERE FullDate BETWEEN '2026-01-01' AND '2026-12-31'
      ORDER BY FullDate
    `);
    for (const row of result.recordset) {
      // DATENAME is locale/collation dependent for spelling, but every SQL
      // Server collation spells English day names starting with "Mon" for
      // Monday — safe to assert on the prefix rather than the full word.
      expect(String(row.WeekdayName).toLowerCase().startsWith('mon')).toBe(true);
    }
  });

  test('WeekStartDate is on or before FullDate, within 6 days', async () => {
    const result = await pool.request().query(`
      SELECT FullDate, WeekStartDate, DATEDIFF(day, WeekStartDate, FullDate) AS DiffDays
      FROM dim.Dim_Date
      WHERE FullDate = '2026-09-23'
    `);
    expect(result.recordset).toHaveLength(1);
    const diff = Number(result.recordset[0].DiffDays);
    expect(diff).toBeGreaterThanOrEqual(0);
    expect(diff).toBeLessThanOrEqual(6);
  });

  test('handles the December-into-January ISO week-year boundary as a single week', async () => {
    // 2025-12-29 (Mon) through 2026-01-04 (Sun) is ISO week 1 of 2026 in its
    // entirety, even though 2025-12-29..31 fall in calendar year 2025.
    const result = await pool.request().query(`
      SELECT FullDate, WeekStartDate, YearWeek
      FROM dim.Dim_Date
      WHERE FullDate BETWEEN '2025-12-29' AND '2026-01-04'
      ORDER BY FullDate
    `);
    expect(result.recordset).toHaveLength(7);
    const yearWeeks = new Set(result.recordset.map(r => String(r.YearWeek)));
    expect(yearWeeks.size).toBe(1);
    expect(yearWeeks.has('2026-W01')).toBe(true);
    const weekStarts = new Set(result.recordset.map(r => String(r.WeekStartDate).slice(0, 10)));
    expect(weekStarts.size).toBe(1);
    expect(weekStarts.has('2025-12-29')).toBe(true);
  });

  test('WeekStartDate/YearWeek are NOT NULL', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS NullCount FROM dim.Dim_Date WHERE WeekStartDate IS NULL OR YearWeek IS NULL
    `);
    expect(Number(result.recordset[0].NullCount)).toBe(0);
  });
});
```

This follows the same `beforeAll` provision/migrate/`afterAll` drop pattern AGENTS.md's "Testing Notes" describes for `scripts/dwh/` tests (create a disposable database, migrate, assert, drop). If `scripts/dwh/test-helpers.ts` (`getTestDwhConfig`/`dropTestDatabase`) or `scripts/migrate-dwh.ts`'s exported `runMigrations` do not exist under exactly these names, grep `scripts/dwh/__tests__/` for an existing test file (e.g. one testing `0032` or an earlier fact-table migration) and match its actual helper import names/signatures exactly — do not guess; this plan's author has not personally re-verified those two helper names against a live existing test file in this session, so confirm them against a real neighboring test before writing this file for real.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/0033-dim-date-week.test.ts`
Expected: FAIL — migration `0033` doesn't exist yet, so `WeekStartDate`/`YearWeek` columns don't exist.

- [ ] **Step 3: Write the migration**

Create `dwh-migrations/0033_dim_date_add_week.sql`:

```sql
-- WeekStartDate/YearWeek let the seller x product x store matrix export
-- (docs/superpowers/specs/2026-09-23-seller-product-store-matrix-design.md)
-- roll sales/returns up to week grain in Excel — no other tab in this
-- dashboard needed a week concept before now (everything else uses
-- YearMonth or raw DateKey window filtering).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Date') AND name = 'WeekStartDate')
    ALTER TABLE dim.Dim_Date ADD WeekStartDate date NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Date') AND name = 'YearWeek')
    ALTER TABLE dim.Dim_Date ADD YearWeek char(7) NULL;
GO

-- Backfill: Monday-anchor independent of session DATEFIRST by normalizing
-- DATEPART(weekday, ...) (which IS DATEFIRST-dependent) against @@DATEFIRST
-- itself, so this produces the same Monday regardless of the connecting
-- session's DATEFIRST setting. YearWeek's year component is the year of
-- that week's Thursday (DATEADD(day, 3, WeekStartDate)) -- the ISO 8601
-- definition of which year a week "belongs to" -- not YEAR(FullDate),
-- which would be wrong for the last days of December / first days of
-- January whenever the ISO week crosses the calendar year boundary.
UPDATE dim.Dim_Date
SET
    WeekStartDate = DATEADD(day, 1 - ((DATEPART(weekday, FullDate) + @@DATEFIRST - 2) % 7 + 1), FullDate),
    YearWeek = CONCAT(
        YEAR(DATEADD(day, 3, DATEADD(day, 1 - ((DATEPART(weekday, FullDate) + @@DATEFIRST - 2) % 7 + 1), FullDate))),
        '-W',
        RIGHT('0' + CAST(DATEPART(iso_week, FullDate) AS varchar(2)), 2)
    )
WHERE WeekStartDate IS NULL OR YearWeek IS NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Date') AND name = 'WeekStartDate' AND is_nullable = 1)
    ALTER TABLE dim.Dim_Date ALTER COLUMN WeekStartDate date NOT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Date') AND name = 'YearWeek' AND is_nullable = 1)
    ALTER TABLE dim.Dim_Date ALTER COLUMN YearWeek char(7) NOT NULL;
GO
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/0033-dim-date-week.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Run `bun run migrate:dwh` against your local dev DWH to confirm the migration applies cleanly outside the test harness too**

Run: `bun run migrate:dwh`
Expected: migration `0033` recorded in `dwh.__dwh_migrations`, no errors. Spot-check with `SELECT TOP 5 FullDate, WeekStartDate, YearWeek FROM dim.Dim_Date ORDER BY FullDate` in a SQL client if you want to eyeball it.

- [ ] **Step 6: Commit**

```bash
git add dwh-migrations/0033_dim_date_add_week.sql scripts/dwh/__tests__/0033-dim-date-week.test.ts
git commit -m "$(cat <<'EOF'
feat: add WeekStartDate/YearWeek columns to Dim_Date

No tab in this dashboard needed a week-grain concept before now --
everything rolls up to month (YearMonth) or filters a raw DateKey
window. The seller x product x store matrix export needs to let users
pivot by week or month in Excel, so this backfills every existing
Dim_Date row with its ISO week's Monday and YYYY-Www label.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `matriz-vendedor` route — `section=summary`

**Files:**
- Create: `app/api/dwh/matriz-vendedor/route.ts`
- Create: `app/api/dwh/matriz-vendedor/__tests__/route.test.ts`
- Modify: `app/(app)/analitica/types.ts`

**Interfaces:**
- Produces: `GET /api/dwh/matriz-vendedor?section=summary&dateRange=...` → `SellerSummaryResponse`.
- Produces (in `types.ts`): 
  ```typescript
  export interface SellerSummaryRow {
    salesRepKey: string;
    salesRepName: string;
    netSales: number;
    netReturns: number;
    entitiesServed: number;
  }
  export interface SellerSummaryResponse {
    rows: SellerSummaryRow[];
  }
  ```
- Consumes: `requireDwhAccess(request)` from `@/lib/dwh/access` (returns `{ok: true, session} | {ok: false, response: NextResponse}`), `buildDateWhereClause(dateRange, alias)` and `jsonWithCache(body)` from `@/app/api/dwh/lib/query-builder` — both already exist, unchanged by this plan.

**Design notes:**

`netSales`/`netReturns` here are plain BS numbers (`number`, not yet `DualAmount`) — this section only powers the leaderboard table and the seller-picker's option list, neither of which needs a currency toggle per the spec (the spec's `SellerMatrixResponse` cells are the ones that need USD, via Task 4's export; the summary section was never specified to carry a currency toggle). Follows the same `section=leaderboard`-style dispatch as `app/api/dwh/profundidad-linea/route.ts:360-362` (`const section = searchParams.get('section'); if (section === 'summary') {...}`).

- [ ] **Step 1: Write the failing test**

Create `app/api/dwh/matriz-vendedor/__tests__/route.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/matriz-vendedor', () => {
  test('rejects unauthenticated summary requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?section=summary');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/api/dwh/matriz-vendedor/__tests__/route.test.ts`
Expected: FAIL — `app/api/dwh/matriz-vendedor/route.ts` doesn't exist yet (module not found).

- [ ] **Step 3: Add `SellerSummaryRow`/`SellerSummaryResponse` to `types.ts`**

Add to `app/(app)/analitica/types.ts`, after the `CadenceResponse` interface at the end of the file (this is a new, independent tab section, same convention as every other tab's types being appended at the end in the order tabs were added):

```typescript

// Matriz Vendedor-Producto tab — seller x product x store depth-of-line
// coaching matrix. See docs/superpowers/specs/
// 2026-09-23-seller-product-store-matrix-design.md.
export interface SellerSummaryRow {
  salesRepKey: string;
  salesRepName: string;
  netSales: number;
  netReturns: number;
  entitiesServed: number;
}

export interface SellerSummaryResponse {
  rows: SellerSummaryRow[];
}
```

- [ ] **Step 4: Implement the route's `summary` section**

Create `app/api/dwh/matriz-vendedor/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { buildDateWhereClause, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import type { SellerSummaryRow, SellerSummaryResponse } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM
// gymnastics needed here, that already happened at load time. See
// docs/superpowers/specs/2026-09-23-seller-product-store-matrix-design.md.
//
// This is a seller-first drill-down, distinct from the existing Profundidad
// de Línea tab (app/api/dwh/profundidad-linea/route.ts, unchanged by this
// feature): that tab shows product-line-tier penetration by customer
// segment; this one shows one seller's own product x store matrix.

function summaryQuery(salesDateWhere: string, returnsDateWhere: string): string {
  return `
    SELECT
      CAST(fs.SalesRepKey AS varchar(20)) AS SalesRepKey,
      ISNULL(r.SalesRepName, r.SalesRepCode) AS SalesRepName,
      SUM(fs.NetAmount) AS NetSales,
      COUNT(DISTINCT le.LegalEntityKey) AS EntitiesServed,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}) AS NetReturns
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
    ORDER BY NetSales DESC
  `;
}

async function handleSummary(salesDateWhere: string, returnsDateWhere: string): Promise<NextResponse> {
  const pool = await getDwhPool();
  const result = await pool.request().query(summaryQuery(salesDateWhere, returnsDateWhere));

  const rows: SellerSummaryRow[] = result.recordset.map(r => ({
    salesRepKey: String(r.SalesRepKey),
    salesRepName: String(r.SalesRepName),
    netSales: Number(r.NetSales),
    netReturns: Number(r.NetReturns),
    entitiesServed: Number(r.EntitiesServed),
  }));

  const response: SellerSummaryResponse = { rows };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const section = searchParams.get('section');

  try {
    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');

    if (section === 'summary') {
      return await handleSummary(salesDateWhere, returnsDateWhere);
    }

    return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test app/api/dwh/matriz-vendedor/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/dwh/matriz-vendedor/route.ts app/api/dwh/matriz-vendedor/__tests__/route.test.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
feat: add matriz-vendedor route with seller summary section

First section of the new seller x product x store matrix API: one row
per seller with net sales/returns and distinct entities served in
range, powering both the new tab's leaderboard and its searchable
seller picker. Matrix (per-seller pivot) and XLSX export sections
follow in later commits.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `matriz-vendedor` route — `section=matrix`

**Files:**
- Modify: `app/api/dwh/matriz-vendedor/route.ts`
- Modify: `app/api/dwh/matriz-vendedor/__tests__/route.test.ts`
- Modify: `app/(app)/analitica/types.ts`

**Interfaces:**
- Produces: `GET /api/dwh/matriz-vendedor?section=matrix&salesRepKey=<key>&dateRange=...` → `SellerMatrixResponse`.
- Produces (in `types.ts`, exact shape from the spec's own TypeScript block):
  ```typescript
  export interface SellerMatrixProduct {
    productKey: number;
    productName: string;
    lineName: string | null;
    subLineName: string | null;
    categoryName: string | null;
  }
  export interface SellerMatrixStore {
    customerKey: number;
    customerName: string;
    legalEntityName: string;
  }
  export interface SellerMatrixCell {
    productKey: number;
    customerKey: number;
    netSales: number;
    units: number;
    returnRateUsd: number | null;
    returnRateUnits: number | null;
  }
  export interface SellerMatrixResponse {
    products: SellerMatrixProduct[];
    stores: SellerMatrixStore[];
    cells: SellerMatrixCell[];
  }
  ```
- Consumes: same `requireDwhAccess`/`buildDateWhereClause`/`jsonWithCache` as Task 2; `handleSummary` from Task 2 (unchanged).

**Design notes:**

The spec names this per-cell field `returnRateUsd` but defines it as a ratio (`returns / sales`), not a currency amount — despite the name, this is dimensionless (a fraction), so it stays a plain `number | null`, never `DualAmount`. `netSales`/`units` in this section are also plain BS/unit totals, matching the spec's own TypeScript block exactly (the spec does not ask for a currency toggle on the matrix view — only the XLSX export in Task 4 needs dual-currency, since that's the artifact meant to travel outside the dashboard's own BS/USD toggle). Bounded by construction: every query in this section filters `WHERE fs.SalesRepKey = @salesRepKey`, so it only ever touches one seller's actual rows, never a full seller×product×store cross join.

- [ ] **Step 1: Write the failing test**

Add to `app/api/dwh/matriz-vendedor/__tests__/route.test.ts`:

```typescript
  test('rejects unauthenticated matrix requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?section=matrix&salesRepKey=1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('returns 400 when section=matrix is missing salesRepKey', async () => {
    // This request has no session cookie either, so per the route's own
    // ordering (auth check runs before the salesRepKey validation) this
    // still resolves as a 401, not a 400 -- the route always checks auth
    // FIRST, unconditionally, before looking at any other param. This test
    // documents and locks in that ordering rather than exercising the 400
    // branch directly (which needs a valid session, out of scope for these
    // auth-smoke-only route tests -- see this plan's Global Constraints).
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?section=matrix');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/api/dwh/matriz-vendedor/__tests__/route.test.ts`
Expected: PASS already for both (auth check runs first regardless of section, same as every other route in this codebase) — this step is a sanity check that the ordering is right, not a red-to-green transition. If either test unexpectedly fails, fix `GET`'s ordering before proceeding (auth must be checked before any `section`/`salesRepKey` branching).

- [ ] **Step 3: Add the matrix types to `types.ts`**

Add to `app/(app)/analitica/types.ts`, right after `SellerSummaryResponse`:

```typescript

export interface SellerMatrixProduct {
  productKey: number;
  productName: string;
  lineName: string | null;
  subLineName: string | null;
  categoryName: string | null;
}

export interface SellerMatrixStore {
  customerKey: number;
  customerName: string;
  legalEntityName: string;
}

export interface SellerMatrixCell {
  productKey: number;
  customerKey: number;
  netSales: number;
  units: number;
  returnRateUsd: number | null; // a RATIO (returns/sales), not a currency amount -- plain number despite the name
  returnRateUnits: number | null;
}

export interface SellerMatrixResponse {
  products: SellerMatrixProduct[];
  stores: SellerMatrixStore[];
  cells: SellerMatrixCell[];
}
```

- [ ] **Step 4: Implement the route's `matrix` section**

Modify `app/api/dwh/matriz-vendedor/route.ts` — add these query builders and handler above `export async function GET`:

```typescript
function matrixSalesQuery(dateWhere: string): string {
  return `
    SELECT
      fs.ProductKey,
      p.ProductName, p.LineName, p.SubLineName, p.CategoryName,
      fs.CustomerKey,
      ISNULL(c.CustomerName, c.CustomerCode) AS CustomerName,
      le.LegalEntityName,
      SUM(fs.NetAmount) AS NetSales,
      SUM(fs.QuantitySold) AS Units
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${dateWhere}
    GROUP BY fs.ProductKey, p.ProductName, p.LineName, p.SubLineName, p.CategoryName,
             fs.CustomerKey, ISNULL(c.CustomerName, c.CustomerCode), le.LegalEntityName
  `;
}

function matrixReturnsQuery(dateWhere: string): string {
  return `
    SELECT fr.ProductKey, fr.CustomerKey, SUM(fr.NetAmount) AS ReturnsNet, SUM(fr.QuantityReturned) AS ReturnsUnits
    FROM fact.Fact_Returns fr
    WHERE fr.IsVoided = 0 AND fr.SalesRepKey = @salesRepKey ${dateWhere}
    GROUP BY fr.ProductKey, fr.CustomerKey
  `;
}

async function handleMatrix(salesDateWhere: string, returnsDateWhere: string, salesRepKey: number): Promise<NextResponse> {
  const pool = await getDwhPool();

  const [salesResult, returnsResult] = await Promise.all([
    pool.request().input('salesRepKey', salesRepKey).query(matrixSalesQuery(salesDateWhere)),
    pool.request().input('salesRepKey', salesRepKey).query(matrixReturnsQuery(returnsDateWhere)),
  ]);

  const returnsByKey = new Map<string, { net: number; units: number }>();
  for (const r of returnsResult.recordset) {
    returnsByKey.set(`${r.ProductKey}|${r.CustomerKey}`, { net: Number(r.ReturnsNet), units: Number(r.ReturnsUnits) });
  }

  const productsByKey = new Map<number, SellerMatrixProduct>();
  const storesByKey = new Map<number, SellerMatrixStore>();
  const cells: SellerMatrixCell[] = [];

  for (const r of salesResult.recordset) {
    const productKey = Number(r.ProductKey);
    const customerKey = Number(r.CustomerKey);
    const netSales = Number(r.NetSales);
    const units = Number(r.Units);

    if (!productsByKey.has(productKey)) {
      productsByKey.set(productKey, {
        productKey,
        productName: String(r.ProductName),
        lineName: r.LineName === null ? null : String(r.LineName),
        subLineName: r.SubLineName === null ? null : String(r.SubLineName),
        categoryName: r.CategoryName === null ? null : String(r.CategoryName),
      });
    }
    if (!storesByKey.has(customerKey)) {
      storesByKey.set(customerKey, {
        customerKey,
        customerName: String(r.CustomerName),
        legalEntityName: String(r.LegalEntityName),
      });
    }

    const returns = returnsByKey.get(`${productKey}|${customerKey}`);
    cells.push({
      productKey,
      customerKey,
      netSales,
      units,
      returnRateUsd: returns && netSales > 0 ? returns.net / netSales : null,
      returnRateUnits: returns && units > 0 ? returns.units / units : null,
    });
  }

  const response: SellerMatrixResponse = {
    products: Array.from(productsByKey.values()),
    stores: Array.from(storesByKey.values()),
    cells,
  };
  return jsonWithCache(response);
}
```

Add the required import at the top: `import type { SellerSummaryRow, SellerSummaryResponse, SellerMatrixProduct, SellerMatrixStore, SellerMatrixResponse } from '@/app/(app)/analitica/types';` (replace the Task 2 import line entirely with this one).

In `GET`, add `salesRepKey` parsing and the new branch, right after the existing `section === 'summary'` branch:

```typescript
    const salesRepKeyParam = searchParams.get('salesRepKey');
    const salesRepKey = salesRepKeyParam && /^\d+$/.test(salesRepKeyParam) ? Number(salesRepKeyParam) : null;

    if (section === 'summary') {
      return await handleSummary(salesDateWhere, returnsDateWhere);
    }

    if (section === 'matrix') {
      if (salesRepKey === null) {
        return NextResponse.json({ error: 'Falta salesRepKey' }, { status: 400 });
      }
      return await handleMatrix(salesDateWhere, returnsDateWhere, salesRepKey);
    }
```

(This replaces the old `if (section === 'summary') { return await handleSummary(...); }` block with the version above, which now also declares `salesRepKeyParam`/`salesRepKey` before it and adds the `matrix` branch after it.)

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test app/api/dwh/matriz-vendedor/__tests__/route.test.ts`
Expected: PASS, all 4 tests (2 from Task 2, 2 new).

- [ ] **Step 6: Commit**

```bash
git add app/api/dwh/matriz-vendedor/route.ts app/api/dwh/matriz-vendedor/__tests__/route.test.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
feat: add matriz-vendedor matrix section for one seller's pivot

section=matrix&salesRepKey=X returns a sparse product x store pivot
scoped to that seller's own sales -- bounded by construction (every
query filters on SalesRepKey), never a full cross join. Each cell
carries its own return-rate ratio; product rows carry Line/SubLine/
Category metadata for line-level target checks (e.g. "Fresco" coverage).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `matriz-vendedor` route — `format=xlsx` export

**Files:**
- Modify: `app/api/dwh/matriz-vendedor/route.ts`
- Create: `app/api/dwh/matriz-vendedor/export-rows.ts`
- Create: `app/api/dwh/matriz-vendedor/__tests__/export-rows.test.ts`
- Modify: `app/api/dwh/matriz-vendedor/__tests__/route.test.ts`

**Interfaces:**
- Produces: `GET /api/dwh/matriz-vendedor?format=xlsx&dateRange=...[&salesRepKey=<key>]` → an `.xlsx` file download (single seller when `salesRepKey` given, all sellers when omitted).
- Produces (in `export-rows.ts`): `MATRIZ_EXPORT_COLUMNS: ColumnDef[]` and `buildMatrizExportRows(salesRows: MatrizExportSalesRow[], returnsRows: MatrizExportReturnsRow[]): Record<string, unknown>[]` — pure row-shaping logic, unit-testable without a live DB (see Design notes).
- Consumes: `usdConversionJoin`, `dualAmountExpr` from `@/app/api/dwh/lib/query-builder` (added by `docs/superpowers/plans/2026-09-23-historical-usd-conversion.md`'s Task 1 — **do not start this task until that plan's Task 1 is merged**), `buildXlsx` from `@/lib/xlsx`, `ColumnDef` from `@/lib/reports/registry`.

**Design notes:**

Per the spec's column table, the export is one row per `(SalesRepKey, ProductKey, CustomerKey, WeekStartDate)` with non-zero sales or returns. `Ingreso USD`/`Devolución USD` must convert each underlying invoice/credit-note line at its OWN historical rate before summing into that week bucket (not sum-BS-then-divide) — this is exactly what `dualAmountExpr` does when grouped at the target grain, so the SQL query groups directly by `(SalesRepKey, ProductKey, CustomerKey, WeekStartDate)` and uses `dualAmountExpr('fs', 'NetAmount', 'IngresoBs', 'IngresoUsd')` in the `SELECT`/uses the matching `usdConversionJoin('fs')` in the `FROM` clause — no separate application-layer conversion step.

The row-shaping (joining sales+returns by key, computing the two return-rate columns, mapping DB column names to the spec's Spanish `ColumnDef` labels) is extracted into a pure function (`buildMatrizExportRows`) in its own file specifically so it can be unit-tested with plain in-memory fixtures, without needing a live DWH connection — this repo's route tests are auth-smoke-only (see Global Constraints), so the actual SQL-to-rows logic needs its own testable seam. This mirrors how `lib/xlsx.test.ts` tests `buildXlsx` itself: pure input/output, no DB.

`buildXlsx` needs `ColumnDef[]` (from `lib/reports/registry.ts`) — reuse that exact type (`{key, label, defaultVisible, defaultOrder, alwaysVisible?, type?}`), do not invent a parallel column-definition shape.

- [ ] **Step 1: Write the failing test for `buildMatrizExportRows`**

Create `app/api/dwh/matriz-vendedor/__tests__/export-rows.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { buildMatrizExportRows, MATRIZ_EXPORT_COLUMNS } from '../export-rows';

describe('buildMatrizExportRows', () => {
  test('joins a sales row with its matching returns row and computes both return rates', () => {
    const salesRows = [{
      SalesRepName: 'Juan Pérez', LegalEntityName: 'Plazas', CustomerName: 'Plazas San Bernardino',
      ProductName: 'Queso Fresco 1kg', LineName: 'Fresco', SubLineName: 'Quesos', CategoryName: 'Lácteos',
      WeekStartDate: '2026-09-21', YearMonth: '2026-09',
      IngresoBs: 15000, IngresoUsd: 125, Unidades: 40,
    }];
    const returnsRows = [{
      SalesRepName: 'Juan Pérez', LegalEntityName: 'Plazas', CustomerName: 'Plazas San Bernardino',
      ProductName: 'Queso Fresco 1kg', WeekStartDate: '2026-09-21',
      DevolucionBs: 1500, DevolucionUsd: 12.5, DevolucionUnidades: 4,
    }];

    const rows = buildMatrizExportRows(salesRows, returnsRows);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Vendedor: 'Juan Pérez', Entidad: 'Plazas', Tienda: 'Plazas San Bernardino',
      Producto: 'Queso Fresco 1kg', Línea: 'Fresco', Sublínea: 'Quesos', Categoría: 'Lácteos',
      Semana: '2026-09-21', Mes: '2026-09',
      'Ingreso USD': 125, Unidades: 40,
      'Devolución USD': 12.5, 'Devolución Unidades': 4,
      'Tasa Devolución USD': 0.1, 'Tasa Devolución Unidades': 0.1,
    });
  });

  test('a sales row with no matching returns gets null/blank return-rate columns, not a crash', () => {
    const salesRows = [{
      SalesRepName: 'Ana Gómez', LegalEntityName: 'Excelsior', CustomerName: 'Excelsior Centro',
      ProductName: 'Jamón 500g', LineName: 'Fresco', SubLineName: 'Embutidos', CategoryName: 'Charcutería',
      WeekStartDate: '2026-09-14', YearMonth: '2026-09',
      IngresoBs: 8000, IngresoUsd: 66.67, Unidades: 20,
    }];

    const rows = buildMatrizExportRows(salesRows, []);

    expect(rows).toHaveLength(1);
    expect(rows[0]['Devolución USD']).toBe(0);
    expect(rows[0]['Devolución Unidades']).toBe(0);
    expect(rows[0]['Tasa Devolución USD']).toBe(null);
    expect(rows[0]['Tasa Devolución Unidades']).toBe(null);
  });

  test('MATRIZ_EXPORT_COLUMNS matches every key buildMatrizExportRows produces', () => {
    const salesRows = [{
      SalesRepName: 'X', LegalEntityName: 'X', CustomerName: 'X',
      ProductName: 'X', LineName: null, SubLineName: null, CategoryName: null,
      WeekStartDate: '2026-01-05', YearMonth: '2026-01',
      IngresoBs: 100, IngresoUsd: 1, Unidades: 1,
    }];
    const rows = buildMatrizExportRows(salesRows, []);
    const columnKeys = new Set(MATRIZ_EXPORT_COLUMNS.map(c => c.key));
    for (const key of Object.keys(rows[0])) {
      expect(columnKeys.has(key)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/api/dwh/matriz-vendedor/__tests__/export-rows.test.ts`
Expected: FAIL — `../export-rows` doesn't exist yet.

- [ ] **Step 3: Implement `buildMatrizExportRows`**

Create `app/api/dwh/matriz-vendedor/export-rows.ts`:

```typescript
import type { ColumnDef } from '@/lib/reports/registry';

// Raw shape of one grouped row from the export's SALES query (grouped by
// SalesRepKey, ProductKey, CustomerKey, WeekStartDate -- see route.ts's
// matrizExportSalesQuery). IngresoBs/IngresoUsd come from dualAmountExpr
// aliased to these names.
export interface MatrizExportSalesRow {
  SalesRepName: string;
  LegalEntityName: string;
  CustomerName: string;
  ProductName: string;
  LineName: string | null;
  SubLineName: string | null;
  CategoryName: string | null;
  WeekStartDate: string; // 'YYYY-MM-DD'
  YearMonth: string;
  IngresoBs: number;
  IngresoUsd: number | null;
  Unidades: number;
}

// Same grain (SalesRepKey, ProductKey, CustomerKey, WeekStartDate), from the
// export's RETURNS query -- keyed for the join in buildMatrizExportRows by
// (SalesRepName, ProductName, CustomerName, WeekStartDate) via a composite
// string key, since these are already the resolved display names by the
// time they reach this pure function (the join key doesn't need the
// underlying surrogate keys -- see route.ts for why: the SQL query groups
// by the surrogate keys, but this function receives the already-resolved
// display-name rows, matching how the rest of this route's non-export
// sections also resolve names before mapping into response rows).
export interface MatrizExportReturnsRow {
  SalesRepName: string;
  LegalEntityName: string;
  CustomerName: string;
  ProductName: string;
  WeekStartDate: string;
  DevolucionBs: number;
  DevolucionUsd: number | null;
  DevolucionUnidades: number;
}

export const MATRIZ_EXPORT_COLUMNS: ColumnDef[] = [
  { key: 'Vendedor', label: 'Vendedor', defaultVisible: true, defaultOrder: 0, alwaysVisible: true },
  { key: 'Entidad', label: 'Entidad', defaultVisible: true, defaultOrder: 1, alwaysVisible: true },
  { key: 'Tienda', label: 'Tienda', defaultVisible: true, defaultOrder: 2, alwaysVisible: true },
  { key: 'Producto', label: 'Producto', defaultVisible: true, defaultOrder: 3, alwaysVisible: true },
  { key: 'Línea', label: 'Línea', defaultVisible: true, defaultOrder: 4 },
  { key: 'Sublínea', label: 'Sublínea', defaultVisible: true, defaultOrder: 5 },
  { key: 'Categoría', label: 'Categoría', defaultVisible: true, defaultOrder: 6 },
  { key: 'Semana', label: 'Semana', defaultVisible: true, defaultOrder: 7, type: 'date' },
  { key: 'Mes', label: 'Mes', defaultVisible: true, defaultOrder: 8 },
  { key: 'Ingreso USD', label: 'Ingreso USD', defaultVisible: true, defaultOrder: 9, type: 'number' },
  { key: 'Unidades', label: 'Unidades', defaultVisible: true, defaultOrder: 10, type: 'number' },
  { key: 'Devolución USD', label: 'Devolución USD', defaultVisible: true, defaultOrder: 11, type: 'number' },
  { key: 'Devolución Unidades', label: 'Devolución Unidades', defaultVisible: true, defaultOrder: 12, type: 'number' },
  { key: 'Tasa Devolución USD', label: 'Tasa Devolución USD', defaultVisible: true, defaultOrder: 13, type: 'number' },
  { key: 'Tasa Devolución Unidades', label: 'Tasa Devolución Unidades', defaultVisible: true, defaultOrder: 14, type: 'number' },
];

function key(salesRepName: string, productName: string, customerName: string, weekStartDate: string): string {
  return `${salesRepName}|${productName}|${customerName}|${weekStartDate}`;
}

// Pure row-shaping: join sales+returns at (seller, product, store, week)
// grain and compute per-row return rates -- kept separate from route.ts's
// SQL/HTTP glue so it's unit-testable without a live DWH connection (this
// repo's route tests are auth-smoke-only, see this plan's Global
// Constraints). Per-row rates (not a separate returns sheet) so the user's
// own Excel pivot tables can re-roll-up the ratio at any grain without a
// manual join -- confirmed with user during brainstorming.
export function buildMatrizExportRows(
  salesRows: MatrizExportSalesRow[],
  returnsRows: MatrizExportReturnsRow[],
): Record<string, unknown>[] {
  const returnsByKey = new Map<string, MatrizExportReturnsRow>();
  for (const r of returnsRows) {
    returnsByKey.set(key(r.SalesRepName, r.ProductName, r.CustomerName, r.WeekStartDate), r);
  }

  return salesRows.map(s => {
    const returns = returnsByKey.get(key(s.SalesRepName, s.ProductName, s.CustomerName, s.WeekStartDate));
    const devolucionUsd = returns?.DevolucionUsd ?? 0;
    const devolucionBs = returns?.DevolucionBs ?? 0;
    const devolucionUnidades = returns?.DevolucionUnidades ?? 0;
    const ingresoUsd = s.IngresoUsd ?? 0;

    return {
      Vendedor: s.SalesRepName,
      Entidad: s.LegalEntityName,
      Tienda: s.CustomerName,
      Producto: s.ProductName,
      Línea: s.LineName ?? '',
      Sublínea: s.SubLineName ?? '',
      Categoría: s.CategoryName ?? '',
      Semana: s.WeekStartDate,
      Mes: s.YearMonth,
      'Ingreso USD': ingresoUsd,
      Unidades: s.Unidades,
      'Devolución USD': devolucionUsd,
      'Devolución Unidades': devolucionUnidades,
      'Tasa Devolución USD': ingresoUsd > 0 ? devolucionUsd / ingresoUsd : null,
      'Tasa Devolución Unidades': s.Unidades > 0 ? devolucionUnidades / s.Unidades : null,
    };
  });
}
```

Note: this drops `devolucionBs`/`IngresoBs` from the exported columns entirely — the spec's column table only lists USD amounts for Ingreso/Devolución (no "Ingreso BS" column), so the BS figures are computed by the SQL query (via `dualAmountExpr`, which always produces both) but only the `.usd` side is threaded into the export row. `IngresoBs`/`DevolucionBs` stay in the raw query-result interfaces above for documentation/debugging clarity even though the mapped row never uses them, since `dualAmountExpr` always returns both aliases together — there's no way to ask it for USD only.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/api/dwh/matriz-vendedor/__tests__/export-rows.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Write the failing route-level test for the export endpoint**

Add to `app/api/dwh/matriz-vendedor/__tests__/route.test.ts`:

```typescript
  test('rejects unauthenticated xlsx export requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?format=xlsx');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('rejects unauthenticated xlsx export requests scoped to one seller with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?format=xlsx&salesRepKey=1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun test app/api/dwh/matriz-vendedor/__tests__/route.test.ts`
Expected: FAIL — `format=xlsx` isn't handled yet, so `GET` currently falls through to the `404 Sección no encontrada` branch (since `format` isn't `section`) — actually, since these are unauthenticated requests, `requireDwhAccess` still short-circuits BEFORE that branch is reached, so both new tests should already PASS for the same reason Task 3's ordering-check test passed. This step is another ordering sanity check, not a real red bar — if it fails, something broke the auth-first ordering; fix that before proceeding.

- [ ] **Step 7: Implement the route's `format=xlsx` handling**

Modify `app/api/dwh/matriz-vendedor/route.ts`:

Add to the imports:
```typescript
import { buildDateWhereClause, jsonWithCache, usdConversionJoin, dualAmountExpr } from '@/app/api/dwh/lib/query-builder';
import { buildXlsx } from '@/lib/xlsx';
import { buildMatrizExportRows, MATRIZ_EXPORT_COLUMNS, type MatrizExportSalesRow, type MatrizExportReturnsRow } from './export-rows';
```
(replace the existing `buildDateWhereClause, jsonWithCache` import line with this expanded one).

Add these query builders and handler, after `matrixReturnsQuery`:

```typescript
// Grouped at (SalesRepKey, ProductKey, CustomerKey, WeekStartDate) grain --
// dualAmountExpr converts each underlying invoice LINE at its own historical
// DocumentExchangeRate before this SUM aggregates it, so a week bucket
// spanning invoices issued on different days (at different rates) is
// correct, unlike summing raw BS first and dividing by one rate. When
// salesRepKey is null, every seller is included (the "export all" variant);
// when provided, the query is additionally scoped to that one seller.
function exportSalesQuery(dateWhere: string, salesRepFilter: string): string {
  return `
    SELECT
      ISNULL(rep.SalesRepName, rep.SalesRepCode) AS SalesRepName,
      le.LegalEntityName,
      ISNULL(c.CustomerName, c.CustomerCode) AS CustomerName,
      ISNULL(p.ProductName, p.ProductCode) AS ProductName,
      p.LineName, p.SubLineName, p.CategoryName,
      CONVERT(varchar(10), d.WeekStartDate, 120) AS WeekStartDate,
      d.YearMonth,
      ${dualAmountExpr('fs', 'NetAmount', 'IngresoBs', 'IngresoUsd')},
      SUM(fs.QuantitySold) AS Unidades
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep rep ON rep.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    ${usdConversionJoin('fs')}
    WHERE fs.IsVoided = 0 ${dateWhere} ${salesRepFilter}
    GROUP BY
      ISNULL(rep.SalesRepName, rep.SalesRepCode), le.LegalEntityName, ISNULL(c.CustomerName, c.CustomerCode),
      ISNULL(p.ProductName, p.ProductCode), p.LineName, p.SubLineName, p.CategoryName,
      d.WeekStartDate, d.YearMonth
  `;
}

function exportReturnsQuery(dateWhere: string, salesRepFilter: string): string {
  return `
    SELECT
      ISNULL(rep.SalesRepName, rep.SalesRepCode) AS SalesRepName,
      le.LegalEntityName,
      ISNULL(c.CustomerName, c.CustomerCode) AS CustomerName,
      ISNULL(p.ProductName, p.ProductCode) AS ProductName,
      CONVERT(varchar(10), d.WeekStartDate, 120) AS WeekStartDate,
      ${dualAmountExpr('fr', 'NetAmount', 'DevolucionBs', 'DevolucionUsd')},
      SUM(fr.QuantityReturned) AS DevolucionUnidades
    FROM fact.Fact_Returns fr
    JOIN dim.Dim_SalesRep rep ON rep.SalesRepKey = fr.SalesRepKey
    JOIN dim.Dim_Product p ON p.ProductKey = fr.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fr.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fr.DateKey
    ${usdConversionJoin('fr')}
    WHERE fr.IsVoided = 0 ${dateWhere} ${salesRepFilter}
    GROUP BY
      ISNULL(rep.SalesRepName, rep.SalesRepCode), le.LegalEntityName, ISNULL(c.CustomerName, c.CustomerCode),
      ISNULL(p.ProductName, p.ProductCode), d.WeekStartDate
  `;
}

async function handleXlsxExport(
  salesDateWhere: string, returnsDateWhere: string, salesRepKey: number | null,
): Promise<NextResponse> {
  const pool = await getDwhPool();
  const salesRepFilter = salesRepKey !== null ? 'AND fs.SalesRepKey = @salesRepKey' : '';
  const returnsSalesRepFilter = salesRepKey !== null ? 'AND fr.SalesRepKey = @salesRepKey' : '';

  const salesReq = pool.request();
  const returnsReq = pool.request();
  if (salesRepKey !== null) {
    salesReq.input('salesRepKey', salesRepKey);
    returnsReq.input('salesRepKey', salesRepKey);
  }

  const [salesResult, returnsResult] = await Promise.all([
    salesReq.query(exportSalesQuery(salesDateWhere, salesRepFilter)),
    returnsReq.query(exportReturnsQuery(returnsDateWhere, returnsSalesRepFilter)),
  ]);

  const salesRows = salesResult.recordset as MatrizExportSalesRow[];
  const returnsRows = returnsResult.recordset as MatrizExportReturnsRow[];
  const rows = buildMatrizExportRows(salesRows, returnsRows);

  const buffer = buildXlsx(MATRIZ_EXPORT_COLUMNS, rows);
  const filenameSuffix = salesRepKey !== null ? `vendedor-${salesRepKey}` : 'todos';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="matriz-vendedor-${filenameSuffix}.xlsx"`,
    },
  });
}
```

In `GET`, add the `format=xlsx` branch right after the `if (section === 'matrix') {...}` block:

```typescript
    const format = searchParams.get('format');
    if (format === 'xlsx') {
      return await handleXlsxExport(salesDateWhere, returnsDateWhere, salesRepKey);
    }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun test app/api/dwh/matriz-vendedor/__tests__/route.test.ts app/api/dwh/matriz-vendedor/__tests__/export-rows.test.ts`
Expected: PASS, all tests across both files.

- [ ] **Step 9: Commit**

```bash
git add app/api/dwh/matriz-vendedor/route.ts app/api/dwh/matriz-vendedor/export-rows.ts app/api/dwh/matriz-vendedor/__tests__/route.test.ts app/api/dwh/matriz-vendedor/__tests__/export-rows.test.ts
git commit -m "$(cat <<'EOF'
feat: add matriz-vendedor XLSX export

Flat, one-row-per-(seller,product,store,week) export for the user's
own Excel pivot tables. Ingreso USD/Devolución USD use
usdConversionJoin/dualAmountExpr (historical per-transaction
conversion, not today's rate) grouped directly at week grain, so a
week spanning invoices at different rates converts each line
correctly before summing. Row-shaping is a pure, independently
unit-tested function (export-rows.ts) since this repo's route tests
are auth-smoke-only.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `SearchableSelect` component

**Files:**
- Create: `lib/components/searchable-select.tsx`
- Create: `lib/components/__tests__/searchable-select.test.tsx`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: 
  ```typescript
  export interface SearchableSelectOption {
    value: string;
    label: string;
  }
  export interface SearchableSelectProps {
    value: string | null;
    onChange: (value: string | null) => void;
    options: SearchableSelectOption[];
    placeholder?: string; // shown when value is null, defaults to 'Buscar...'
    allLabel?: string; // if provided, renders a leading "clear selection" option with this label (e.g. 'Todas'); omit to require a selection
    className?: string;
  }
  export default function SearchableSelect(props: SearchableSelectProps): JSX.Element;
  ```
- Consumes: nothing new — plain React state, no data fetching (the option list is passed in fully pre-fetched by the caller, matching the spec's "no server-side search/debounce needed" design).

**Design notes:**

Checked `package.json` and this repo's existing `*.test.tsx` files before writing this task — **verify this yourself before implementing**: if no React component-testing library (`@testing-library/react` or similar) is present and no existing `*.test.tsx` file exists anywhere in the repo, this repo has no component-test infrastructure, and per the spec's own Testing section ("none of the current tabs appear to have component tests... this can stay manual, verified in-browser"), skip Step 1/Step 2's automated test and instead write a short manual verification checklist as Step 1, then implement directly. Do not add a new testing library as a side effect of this task — that's a larger infrastructure decision outside this plan's scope. The steps below assume RTL-style testing IS available; if your verification finds it is not, substitute a manual checklist (typing a query filters the list case-insensitively; selecting an option calls `onChange` with its `value` and closes the list; clicking `allLabel` when present calls `onChange(null)`; clicking outside closes the list without changing `value`) and skip straight to implementation.

Not a generalization of `lib/components/reports/SucursalSelector.tsx` — that component is a fixed single-branch selector (hardcoded one-item `options` array, no filtering, no search), structurally unrelated to a search-as-you-type combobox over a large, data-driven, currently-fetched option list. Building a new component is simpler than retrofitting search behavior onto that one.

- [ ] **Step 1: Write the failing test**

First run `grep -rl "@testing-library/react" package.json` and `find . -name "*.test.tsx" -not -path "*/node_modules/*"` to confirm RTL is set up. If it is, create `lib/components/__tests__/searchable-select.test.tsx`:

```typescript
import { describe, test, expect } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchableSelect from '../searchable-select';

const OPTIONS = [
  { value: '1', label: 'Plazas San Bernardino' },
  { value: '2', label: 'Excelsior Gama Centro' },
  { value: '3', label: 'Plazas Chacao' },
];

describe('SearchableSelect', () => {
  test('typing filters the option list case-insensitively', () => {
    render(<SearchableSelect value={null} onChange={() => {}} options={OPTIONS} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'plaz' } });
    expect(screen.getByText('Plazas San Bernardino')).toBeTruthy();
    expect(screen.getByText('Plazas Chacao')).toBeTruthy();
    expect(screen.queryByText('Excelsior Gama Centro')).toBeNull();
  });

  test('selecting an option calls onChange with its value', () => {
    let selected: string | null = null;
    render(<SearchableSelect value={null} onChange={v => { selected = v; }} options={OPTIONS} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.click(screen.getByText('Excelsior Gama Centro'));
    expect(selected).toBe('2');
  });

  test('renders an "all" option when allLabel is provided, calling onChange(null) when clicked', () => {
    let selected: string | null = '1';
    render(<SearchableSelect value="1" onChange={v => { selected = v; }} options={OPTIONS} allLabel="Todas" />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.click(screen.getByText('Todas'));
    expect(selected).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test lib/components/__tests__/searchable-select.test.tsx`
Expected: FAIL — `../searchable-select` doesn't exist yet.

- [ ] **Step 3: Implement `SearchableSelect`**

Create `lib/components/searchable-select.tsx`:

```tsx
'use client';

import { useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

// Client-only combobox filtering an already-fetched, in-memory option list
// as the user types -- no server-side search/debounce, since every option
// list this is used for today (sellers, tiendas) is small enough to fetch
// once. Drop-in replacement for a native <select> wherever the option list
// is data-driven and can grow past a handful of items -- see AGENTS.md's
// "Code Conventions" for when to reach for this instead of <select>.
export default function SearchableSelect({
  value, onChange, options, placeholder = 'Buscar...', allLabel, className,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => options.find(o => o.value === value)?.label ?? '',
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    // Closing on blur would also fire when focus moves to an option button
    // inside this same container (e.g. via click) before its onClick runs --
    // relatedTarget lets us tell "focus left the whole component" apart from
    // "focus moved to a child inside it."
    if (containerRef.current && e.relatedTarget && containerRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    setOpen(false);
  }

  function selectOption(v: string | null, label: string) {
    onChange(v);
    setQuery('');
    setOpen(false);
    void label;
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`} onBlur={handleBlur}>
      <input
        type="text"
        role="textbox"
        value={open ? query : selectedLabel}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg text-sm">
          {allLabel && (
            <li>
              <button
                type="button"
                onClick={() => selectOption(null, allLabel)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-50 text-gray-500"
              >
                {allLabel}
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-2 py-1 text-gray-400">Sin resultados</li>
          ) : (
            filtered.map(o => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => selectOption(o.value, o.label)}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-50"
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test lib/components/__tests__/searchable-select.test.tsx`
Expected: PASS, all 3 tests. If RTL was found unavailable in Step 1, skip this step and instead verify manually per the checklist in Design notes once this component is wired into a real page in Task 7/Task 8.

- [ ] **Step 5: Add the AGENTS.md guideline**

Modify `AGENTS.md` — add this line under the "Code Conventions" section (insert alphabetically/thematically near other UI-related bullets, e.g. after the "CSV encoding" bullet):

```markdown
- **Dropdown selectors** — any `<select>` whose option list is data-driven and can grow past a handful of
  items (e.g. a picker over `Dim_Customer`, `Dim_SalesRep`, or similar) must use
  `lib/components/searchable-select.tsx`'s `SearchableSelect` instead of a native `<select>`; a fixed, small
  enum (a segment filter, a group-by mode, yes/no) stays a native `<select>`
```

- [ ] **Step 6: Commit**

```bash
git add lib/components/searchable-select.tsx lib/components/__tests__/searchable-select.test.tsx AGENTS.md
git commit -m "$(cat <<'EOF'
feat: add SearchableSelect component

Client-only combobox filtering an already-fetched option list as the
user types -- drop-in replacement for a native <select> wherever the
option list is data-driven and can grow large (sellers, tiendas).
Small fixed enums stay native <select>, per the new AGENTS.md
guideline this commit also adds.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Refactor `tab-productos.tsx`'s Tienda selector to `SearchableSelect`

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-productos.tsx`

**Interfaces:**
- Consumes: `SearchableSelect`, `SearchableSelectOption` from `@/lib/components/searchable-select` (Task 5). Existing `tienda`/`setTienda`/`tiendas` state (unchanged names/types: `tienda: string | null`, `tiendas: {value: string, label: string}[]`).
- Produces: nothing new — this task only swaps the JSX for the existing Tienda filter, no state contract changes visible to the rest of the file.

**Design notes:**

The current markup (confirmed by reading the file) is:

```tsx
<label className="flex items-center gap-2 text-sm text-gray-600">
  Tienda:
  <select
    value={tienda ?? ''}
    onChange={e => setTienda(e.target.value || null)}
    className="border border-gray-200 rounded px-2 py-1 text-sm max-w-[220px]"
  >
    <option value="">Todas</option>
    {tiendas.map(t => (
      <option key={t.value} value={t.value}>{t.label}</option>
    ))}
  </select>
</label>
```

`{value: string, label: string}[]` already matches `SearchableSelectOption[]` exactly — no reshaping needed, just pass `tiendas` straight through.

- [ ] **Step 1: No new automated test** — this is a pure JSX swap of an already-tested component (`SearchableSelect` has its own tests from Task 5) into an existing, already-manually-verified filter; the `tienda`/`setTienda` state and its `useEffect` dependency (`tab-productos.tsx` line 142's dependency array already includes `tienda`) are untouched. Verify manually in-browser per Step 3 below instead of writing a new test file.

- [ ] **Step 2: Replace the Tienda `<select>` with `SearchableSelect`**

Add the import at the top of `app/(app)/analitica/tabs/tab-productos.tsx`:

```typescript
import SearchableSelect from '@/lib/components/searchable-select';
```

Replace the `<label>...</label>` block quoted in Design notes with:

```tsx
<label className="flex items-center gap-2 text-sm text-gray-600">
  Tienda:
  <SearchableSelect
    value={tienda}
    onChange={setTienda}
    options={tiendas}
    allLabel="Todas"
    placeholder="Buscar tienda..."
    className="max-w-[220px]"
  />
</label>
```

- [ ] **Step 3: Manually verify in-browser**

Run: `bun dev`, navigate to `/analitica?tab=productos`, and confirm: the Tienda field shows "Todas" (or a placeholder) initially, typing filters the dropdown list, selecting a tienda re-fetches the Rotación/Profundidad/Por Línea sections scoped to it exactly as before, and clicking "Todas" clears the filter back to the unscoped view.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/analitica/tabs/tab-productos.tsx"
git commit -m "$(cat <<'EOF'
refactor: use SearchableSelect for the Tienda filter in Productos tab

The Tienda picker is a Dim_Customer list that can grow past what a
native <select> handles comfortably -- the one dropdown-of-customers
in the analytics module today, per the searchable-select design spec.
No state-contract change: tienda/setTienda/tiendas are untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `tab-matriz-vendedor.tsx` — new tab

**Files:**
- Create: `app/(app)/analitica/tabs/tab-matriz-vendedor.tsx`

**Interfaces:**
- Consumes: `TabComponentProps` (`{dateRange: DateRange; currency: Currency}`, from `analitica-client.tsx`, unchanged); `SellerSummaryResponse`/`SellerSummaryRow`/`SellerMatrixResponse`/`SellerMatrixProduct`/`SellerMatrixStore`/`SellerMatrixCell` from `../types` (Tasks 2–3); `SearchableSelect` from `@/lib/components/searchable-select` (Task 5); `GET /api/dwh/matriz-vendedor?section=summary&dateRange=...` and `?section=matrix&salesRepKey=...&dateRange=...` (Tasks 2–3); the export URLs from Task 4.
- Produces: `export default function TabMatrizVendedor(props: TabComponentProps): JSX.Element` — consumed by Task 8's `TABS` entry.

**Design notes:**

Follows the same plain-`fetch`-in-`useEffect` pattern every existing tab uses (no data library) — mirrors `tab-profundidad.tsx`'s leaderboard-fetch effect (`app/(app)/analitica/tabs/tab-profundidad.tsx:51-70`) for the summary section, and its general `loading`/`error`/`data` state triple per fetch. The line/subline/category filter is a plain client-side `.filter()` over the already-fetched `data.products` (no server round-trip), same reasoning as `tab-profundidad`'s own `linea`/`sublinea` breadcrumb state being client-driven once the relevant data is in hand — the difference here is this filter narrows visible ROWS within an already-fetched matrix rather than triggering a new fetch, since the whole point (per the spec) is that a single seller's matrix is small enough to hold entirely client-side.

The pivot grid renders `products` as rows and `stores` as columns, looking up each `(productKey, customerKey)` cell from `data.cells` via a `Map` keyed by `` `${productKey}|${customerKey}` `` built once per render with `useMemo`, showing "—" for absent (zero-activity) combinations — this is the "only non-zero cells present" sparsity the spec requires; the grid itself still shows the full product×store cross as a table shape, but the vast majority of cells read "—" for sellers with a partial footprint, which is expected and matches the spec's non-goal of not zero-filling the underlying data (the UI showing empty cells for a small, bounded, single-seller grid is fine — the non-goal is about not generating an enormous cross-joined dataset, not about the rendered table's visual shape).

- [ ] **Step 1: No automated test** — this repo has no component-test infrastructure for tabs (confirmed: none of the 12+ existing tab components have a corresponding test file). Verify manually in-browser per Step 3.

- [ ] **Step 2: Implement the tab**

Create `app/(app)/analitica/tabs/tab-matriz-vendedor.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from '@/lib/components/searchable-select';
import type {
  Currency, DateRange, SellerSummaryResponse, SellerMatrixResponse, SellerMatrixProduct,
} from '../types';

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

function money(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(n);
}

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function cellKey(productKey: number, customerKey: number): string {
  return `${productKey}|${customerKey}`;
}

export default function TabMatrizVendedor({ dateRange }: { dateRange: DateRange; currency: Currency }) {
  const [summary, setSummary] = useState<SellerSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [salesRepKey, setSalesRepKey] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<SellerMatrixResponse | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const [lineFilter, setLineFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSummaryError(null);
      setSummaryLoading(true);
      try {
        const params = new URLSearchParams({ section: 'summary', dateRange });
        const res = await fetch(`/api/dwh/matriz-vendedor?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSummaryError(body.error ?? 'Error desconocido');
          return;
        }
        setSummary(await res.json());
      } catch {
        if (!cancelled) setSummaryError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateRange]);

  useEffect(() => {
    if (salesRepKey === null) {
      setMatrix(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setMatrixError(null);
      setMatrixLoading(true);
      try {
        const params = new URLSearchParams({ section: 'matrix', salesRepKey: salesRepKey as string, dateRange });
        const res = await fetch(`/api/dwh/matriz-vendedor?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setMatrixError(body.error ?? 'Error desconocido');
          return;
        }
        setMatrix(await res.json());
      } catch {
        if (!cancelled) setMatrixError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setMatrixLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [salesRepKey, dateRange]);

  const sellerOptions = useMemo(
    () => (summary?.rows ?? []).map(r => ({ value: r.salesRepKey, label: r.salesRepName })),
    [summary],
  );

  const lineOptions = useMemo(() => {
    if (!matrix) return [];
    const lines = new Set<string>();
    for (const p of matrix.products) if (p.lineName) lines.add(p.lineName);
    return Array.from(lines).sort();
  }, [matrix]);

  const visibleProducts: SellerMatrixProduct[] = useMemo(() => {
    if (!matrix) return [];
    if (!lineFilter) return matrix.products;
    return matrix.products.filter(p => p.lineName === lineFilter);
  }, [matrix, lineFilter]);

  const cellsByKey = useMemo(() => {
    const map = new Map<string, SellerMatrixResponse['cells'][number]>();
    if (matrix) for (const c of matrix.cells) map.set(cellKey(c.productKey, c.customerKey), c);
    return map;
  }, [matrix]);

  const exportParams = new URLSearchParams({ format: 'xlsx', dateRange });
  const exportAllParams = new URLSearchParams({ format: 'xlsx', dateRange });
  if (salesRepKey) exportParams.set('salesRepKey', salesRepKey);

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Cobertura por vendedor</h2>
            <p className="text-xs text-gray-500">Ventas y entidades atendidas por cada vendedor en el rango seleccionado</p>
          </div>
          <a
            href={`/api/dwh/matriz-vendedor?${exportAllParams.toString()}`}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Exportar todos los vendedores
          </a>
        </div>

        {summaryLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : summaryError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{summaryError}</p>
        ) : !summary || summary.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Vendedor</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas netas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Devoluciones</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Entidades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.rows.map(row => (
                  <tr
                    key={row.salesRepKey}
                    className={`cursor-pointer hover:bg-blue-50 ${salesRepKey === row.salesRepKey ? 'bg-blue-50' : ''}`}
                    onClick={() => setSalesRepKey(row.salesRepKey)}
                  >
                    <td className="px-3 py-2 text-gray-800">{row.salesRepName}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-medium">{money(row.netSales)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{money(row.netReturns)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.entitiesServed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Matriz producto × tienda</h2>
            <p className="text-xs text-gray-500">Selecciona un vendedor para ver su cobertura por producto y tienda</p>
          </div>
          <div className="flex items-center gap-2">
            <SearchableSelect
              value={salesRepKey}
              onChange={setSalesRepKey}
              options={sellerOptions}
              placeholder="Buscar vendedor..."
              className="max-w-[240px]"
            />
            {matrix && (
              <a
                href={`/api/dwh/matriz-vendedor?${exportParams.toString()}`}
                className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
              >
                Exportar vendedor
              </a>
            )}
          </div>
        </div>

        {salesRepKey === null ? (
          <EmptyState message="Selecciona un vendedor para ver su matriz." />
        ) : matrixLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
        ) : matrixError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{matrixError}</p>
        ) : !matrix || matrix.products.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {lineOptions.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                Línea:
                <select
                  value={lineFilter ?? ''}
                  onChange={e => setLineFilter(e.target.value || null)}
                  className="border border-gray-200 rounded px-2 py-1 text-sm"
                >
                  <option value="">Todas</option>
                  {lineOptions.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase sticky left-0 bg-white">Producto</th>
                    {matrix.stores.map(s => (
                      <th key={s.customerKey} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                        {s.customerName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleProducts.map(p => (
                    <tr key={p.productKey}>
                      <td className="px-3 py-2 text-gray-800 sticky left-0 bg-white">{p.productName}</td>
                      {matrix.stores.map(s => {
                        const cell = cellsByKey.get(cellKey(p.productKey, s.customerKey));
                        return (
                          <td key={s.customerKey} className="px-3 py-2 text-right text-gray-600">
                            {cell ? (
                              <span title={`Devolución USD: ${pct(cell.returnRateUsd)} · Devolución unidades: ${pct(cell.returnRateUnits)}`}>
                                {money(cell.netSales)}
                              </span>
                            ) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manually verify in-browser**

Run: `bun dev`, navigate to `/analitica` (the new tab isn't wired into `TABS` until Task 8 — temporarily add it to `TABS` locally to preview, or complete Task 8 first and verify both together). Confirm: leaderboard loads and lists sellers; clicking a seller row (or picking one via the searchable select) loads that seller's matrix; the línea filter narrows visible product rows; hovering a populated cell shows its return-rate tooltip; both export links produce a valid `.xlsx` download.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/analitica/tabs/tab-matriz-vendedor.tsx"
git commit -m "$(cat <<'EOF'
feat: add Matriz Vendedor-Producto tab

Seller leaderboard, searchable seller picker, and a per-seller
product x store pivot grid with a client-side línea filter (e.g. to
check Fresco coverage) and both per-seller and all-sellers XLSX
export links. Not yet wired into the tab bar -- next commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wire the new tab into `analitica-client.tsx`

**Files:**
- Modify: `app/(app)/analitica/analitica-client.tsx`

**Interfaces:**
- Consumes: `TabMatrizVendedor` default export from `./tabs/tab-matriz-vendedor` (Task 7).

**Design notes:**

`TabComponentProps` already matches what `TabMatrizVendedor` accepts (`{dateRange, currency}`) — no interface changes needed to `analitica-client.tsx` beyond the import and one new `TABS` entry. Placed after `'profundidad'` in the tab order since this is the closest-related existing tab (both are depth-of-line-coverage views), before `'cadencia'`.

- [ ] **Step 1: No automated test** — `analitica-client.tsx` has no existing test file (confirmed: no `analitica-client.test.tsx` anywhere in the repo); this is a two-line addition to an existing array plus one import, verified manually in Step 3.

- [ ] **Step 2: Add the import and `TABS` entry**

Modify `app/(app)/analitica/analitica-client.tsx` — add the import after `import TabProfundidad from './tabs/tab-profundidad';`:

```typescript
import TabMatrizVendedor from './tabs/tab-matriz-vendedor';
```

Add the `TABS` entry after the `'profundidad'` entry:

```typescript
  { key: 'matriz-vendedor', label: 'Matriz Vendedor-Producto', component: TabMatrizVendedor },
```

So the relevant slice of `TABS` reads:

```typescript
  { key: 'profundidad', label: 'Profundidad de Línea', component: TabProfundidad },
  { key: 'matriz-vendedor', label: 'Matriz Vendedor-Producto', component: TabMatrizVendedor },
  { key: 'cadencia', label: 'Cadencia', component: TabCadencia },
```

- [ ] **Step 3: Manually verify in-browser**

Run: `bun dev`, navigate to `/analitica`, confirm the "Matriz Vendedor-Producto" tab appears in the tab bar between "Profundidad de Línea" and "Cadencia," and clicking it renders Task 7's component end-to-end (this is the full verification deferred from Task 7 Step 3).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/analitica/analitica-client.tsx"
git commit -m "$(cat <<'EOF'
feat: wire Matriz Vendedor-Producto into the Analítica tab bar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Self-Review

**Spec coverage** (re-read against `docs/superpowers/specs/2026-09-23-seller-product-store-matrix-design.md`):

- Schema change (`Dim_Date` week columns) → Task 1. ✓
- `section=summary` → Task 2. ✓
- `section=matrix&salesRepKey=X` → Task 3. ✓
- `format=xlsx` export, both single-seller and all-sellers, exact column table (Vendedor/Entidad/Tienda/Producto/Línea/Sublínea/Categoría/Semana/Mes/Ingreso USD/Unidades/Devolución USD/Devolución Unidades/Tasa Devolución USD/Tasa Devolución Unidades), per-row (not sum-then-divide) historical USD conversion → Task 4. ✓
- New tab (leaderboard, searchable seller picker, matrix pivot grid, línea/sublínea/categoría filter, export buttons) → Task 7. ✓
- Wired into `TABS`, gated by existing `dwh` module (no new module — `requireDwhAccess` reused as-is in Tasks 2–4, page-level gate untouched) → Task 8. ✓
- `SearchableSelect` component, adopted by the new seller picker (Task 7) and the existing Tienda selector (Task 6) → Tasks 5–6. ✓
- AGENTS.md guideline addition → folded into Task 5 (Step 5), per Task Right-Sizing rather than a standalone task. ✓
- Explicitly NOT touching `tab-cadencia.tsx`'s segment filter or `grouped-drilldown-table.tsx`'s enum selects → no task touches either file; confirmed by omission. ✓
- No zero-filled cross join → Task 3's matrix query only emits rows with actual `GROUP BY` results (inherently sparse — SQL `GROUP BY` never invents zero-rows), Task 4's export query is the same. ✓
- No margin/cost data → no task reads `UnitCost`/`COGSAmount`/`GrossProfitAmount`. ✓
- Hard dependency on the historical-USD-conversion plan → stated as the first Global Constraint, and Task 4 explicitly names the exact functions/signatures it depends on. ✓

**Placeholder scan:** no `TBD`/`TODO`/"add appropriate"/"similar to Task N" found. Task 1 Step 1 and Task 5 Step 1 each contain one explicit "verify this yourself before treating as fact" caveat (test-helper names in Task 1, RTL availability in Task 5) rather than a placeholder — both give a concrete fallback path (grep for a neighboring test file; write a manual checklist) rather than leaving the step undefined, and both are pre-existing-infrastructure questions this plan's author could not verify with certainty in this session, not gaps in the design itself.

**Type consistency across tasks:**
- `SellerSummaryRow`/`SellerSummaryResponse` (Task 2) — field names (`salesRepKey`, `salesRepName`, `netSales`, `netReturns`, `entitiesServed`) match exactly what Task 7's `sellerOptions`/leaderboard table read.
- `SellerMatrixProduct`/`SellerMatrixStore`/`SellerMatrixCell`/`SellerMatrixResponse` (Task 3) — field names match the spec's own TypeScript block verbatim, and match what Task 7's `visibleProducts`/`cellsByKey`/table rendering read (`productKey`, `customerKey`, `netSales`, `returnRateUsd`, `returnRateUnits`, `lineName`, `legalEntityName`, `customerName`).
- `usdConversionJoin`/`dualAmountExpr` (Task 4) — called with the exact signature defined in the dependency plan, confirmed against that plan's file directly rather than from memory.
- `MATRIZ_EXPORT_COLUMNS`/`buildMatrizExportRows` (Task 4) — the column `key`s (`'Vendedor'`, `'Ingreso USD'`, etc.) match exactly between `MATRIZ_EXPORT_COLUMNS` and the object keys `buildMatrizExportRows` returns; verified by the third unit test in Task 4 Step 1, which asserts this programmatically rather than just by eyeballing both lists.
- `SearchableSelectOption`/`SearchableSelectProps` (Task 5) — `{value, label}` shape matches the existing `tiendas`/`{value, label}[]` state in `tab-productos.tsx` (Task 6) and the `sellerOptions` built in Task 7 exactly, with no reshaping needed at either call site.

**Judgment calls flagged for the executor:**
- Task 1's test-helper import names (`getTestDwhConfig`, `dropTestDatabase`, `runMigrations`) were not verified against a real existing `scripts/dwh/__tests__/*.test.ts` file in this session — the task explicitly says to confirm against a neighboring test before writing the real file.
- Task 5's RTL availability was not verified in this session — the task explicitly says to check `package.json`/existing `*.test.tsx` files first and gives a manual-verification fallback if it's absent.
- Task 7's pivot grid renders a full product×store table (with "—" for missing cells) rather than hiding empty columns/rows — this is a reasonable reading of the spec's "bounded per-seller matrix" UI decision, but if a seller's own footprint is very wide (many distinct stores), the table could still get visually large; no pagination/virtualization was added since the spec described this as inherently bounded by one seller's real data, not needing that treatment.
