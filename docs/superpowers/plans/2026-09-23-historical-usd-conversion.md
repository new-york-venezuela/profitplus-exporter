# Historical (Per-Transaction) USD Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every DWH route's "sum BS, divide by today's rate" USD conversion with a per-row historical conversion (each row's own `DocumentExchangeRate`, falling back to that date's `Fact_ExchangeRate`), and have every route always return both BS and USD so the client never divides.

**Architecture:** A new shared SQL-fragment builder in `app/api/dwh/lib/query-builder.ts` produces (a) a `LEFT JOIN fact.Fact_ExchangeRate` fragment keyed to a fact table's date column, and (b) a paired `SUM(...) AS XBs, SUM(.../rate) AS XUsd` aggregate expression. Every in-scope route's queries are rewritten to use these two helpers in place of a bare `SUM(NetAmount)`. Every response type's money field changes from `number` to a shared `DualAmount { bs: number; usd: number | null }` shape. The client-side `currency` toggle (`lib/format.ts`, every tab) stops dividing by a rate — it just picks `.bs` or `.usd` off the value it already has.

**Tech Stack:** Next.js 16 App Router, `mssql`, Bun test runner, TypeScript, React.

**Spec:** `docs/superpowers/specs/2026-09-23-historical-usd-conversion-design.md`

**Sequence:** 1st of 4 planned changes, in this order: (1) **this plan**, (2) `2026-09-23-seller-product-store-matrix.md` (depends on this plan's Task 1 — see that plan's Global Constraints), (3) a `migrations/` directory reorg (`dwh-migrations/` → `migrations/dwh/`, etc. — bounded, no written plan doc; not yet executed), (4) a not-yet-written "Histórico 2025" legacy-ERP-import spec/plan. This plan itself has no dependency on any of the other three and can execute standalone.

## Global Constraints

- In scope: routes/queries reading `fact.Fact_Sales`, `fact.Fact_Returns`, `fact.Fact_Collections`, `fact.Fact_AR_Snapshot`, `fact.Fact_Purchases` — these 5 tables have a `DocumentExchangeRate decimal(21,8) NULL` column.
- Out of scope, untouched: `finanzas` and `multimoneda` routes/types (backed by `Fact_Expenses`/`Fact_CashMovements`, which have no rate column at all).
- Conversion formula per row: `NetAmount / NULLIF(COALESCE(DocumentExchangeRate, fx.RateSell), 0)`, where `fx` is `LEFT JOIN fact.Fact_ExchangeRate fx ON fx.DateKey = <fact>.DateKey AND fx.CurrencyKey = @usdCurrencyKey`. Division happens per-row, before `SUM`.
- No `co_mone`/`CurrencyKey` branching needed — every in-scope ERP document is always recorded in BS (confirmed with user).
- Every response type's money fields become `DualAmount = { bs: number; usd: number | null }` (new shared type in `app/(app)/analitica/types.ts`). `usd` is `null` only when no rate (document or fallback) was resolvable for every underlying row summed into that figure.
- `usdRate` fields and `currency` request query params are removed from every in-scope route and response type. Routes keep accepting other params unchanged (`dateRange`, `groupBy`, etc.).
- `app/api/dwh/dashboard/route.ts` is deleted (confirmed dead: zero references to `/api/dwh/dashboard` anywhere under `app/`).
- Existing route tests are auth-smoke-tests only (assert 401 for unauthenticated `GET`) — this repo has no live-DB integration tests at the `app/api/dwh/*` route level (those exist separately under `scripts/dwh/__tests__/` for `Load_*` procedures). New tests for the conversion math itself are unit tests against the pure SQL-string-building helpers in `query-builder.ts`, following `query-builder.test.ts`'s existing string-assertion style — not live queries.
- Run tests with `bun test <path>` for pure-TS files (`query-builder.test.ts`, `format.test.ts`) — no `--env-file`/`--timeout`/DB needed since nothing here hits a live database. AGENTS.md's `--isolate --env-file=.env.local --timeout 30000` convention is for `scripts/dwh/` tests specifically (they provision a real disposable database), which this plan does not touch.

---

## Task 1: Shared conversion SQL builder in `query-builder.ts`

**Files:**
- Modify: `app/api/dwh/lib/query-builder.ts`
- Test: `app/api/dwh/lib/__tests__/query-builder.test.ts`

**Interfaces:**
- Produces: `usdConversionJoin(factAlias: string, dateColumn?: string): string` — returns the `LEFT JOIN fact.Fact_ExchangeRate fx...` fragment. `dateColumn` defaults to `'DateKey'` (every in-scope fact table but `Fact_AR_Snapshot` uses that name; `Fact_AR_Snapshot` uses `SnapshotDateKey` — callers pass it explicitly for that table).
- Produces: `dualAmountExpr(factAlias: string, column: string, bsAlias: string, usdAlias: string): string` — returns the paired `SUM(...) AS <bsAlias>, SUM(...) AS <usdAlias>` SQL text for a given fact-table-qualified column (e.g. `factAlias='fs', column='NetAmount'` → operates on `fs.NetAmount`).
- Produces: `USD_CURRENCY_SUBQUERY: string` — a reusable scalar subquery `(SELECT CurrencyKey FROM dim.Dim_Currency WHERE RTRIM(CurrencyCode) = 'USD')`, inlined into `usdConversionJoin`'s `ON` clause as `@usdCurrencyKey`'s replacement (no query parameter needed — it's a constant lookup, safe to inline as a subquery since it takes no user input).
- Consumes: nothing new — pure string builders, no DB access.

**Design notes:**

`Fact_ExchangeRate` has no direct `CurrencyCode` column (only `CurrencyKey`, FK to `Dim_Currency`) — so the join needs `Dim_Currency` resolved to a `CurrencyKey` for `'USD'`. Rather than adding a second join to `Dim_Currency` into every query, resolve it once via a scalar subquery inlined in the `ON` clause, matching the existing style of inlined scalar subqueries already used throughout these routes (e.g. `AGING_BUCKETS_QUERY`'s `@snapshotDateKey` pattern, or `dashboard/route.ts`'s own `EXCHANGE_RATE_QUERY`).

- [ ] **Step 1: Write the failing test for `usdConversionJoin`**

Add to `app/api/dwh/lib/__tests__/query-builder.test.ts`:

```typescript
import { usdConversionJoin, dualAmountExpr } from '../query-builder';

describe('usdConversionJoin', () => {
  test('joins Fact_ExchangeRate on the fact alias\'s DateKey by default', () => {
    const sql = usdConversionJoin('fs');
    expect(sql).toContain('LEFT JOIN fact.Fact_ExchangeRate fx');
    expect(sql).toContain('fx.DateKey = fs.DateKey');
    expect(sql).toContain("CurrencyCode) = 'USD'");
  });

  test('accepts a custom date column for tables like Fact_AR_Snapshot', () => {
    const sql = usdConversionJoin('a', 'SnapshotDateKey');
    expect(sql).toContain('fx.DateKey = a.SnapshotDateKey');
  });
});

describe('dualAmountExpr', () => {
  test('produces a BS sum and a per-row-converted USD sum, aliased as requested', () => {
    const sql = dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd');
    expect(sql).toContain('SUM(fs.NetAmount) AS SalesNetBs');
    expect(sql).toContain('AS SalesNetUsd');
    expect(sql).toContain('fs.NetAmount /');
    expect(sql).toContain('NULLIF(COALESCE(fs.DocumentExchangeRate, fx.RateSell), 0)');
  });

  test('division happens inside the SUM, not after it', () => {
    const sql = dualAmountExpr('fp', 'NetAmount', 'Bs', 'Usd');
    // The USD aggregate must be SUM(expr / rate), not SUM(expr) / rate —
    // assert the division is INSIDE the SUM(...) parens by checking the
    // rate divisor appears before the aggregate's closing paren that
    // matches the opening SUM(.
    const usdSumStart = sql.indexOf('SUM(fp.NetAmount /');
    expect(usdSumStart).toBeGreaterThan(-1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/api/dwh/lib/__tests__/query-builder.test.ts`
Expected: FAIL — `usdConversionJoin`/`dualAmountExpr` are not exported from `../query-builder`.

- [ ] **Step 3: Implement `usdConversionJoin` and `dualAmountExpr`**

Add to `app/api/dwh/lib/query-builder.ts`, after `getUsdRate` (leave `getUsdRate` in place for now — it's removed in Task 11 once every call site is migrated):

```typescript
/**
 * LEFT JOIN fragment resolving the USD exchange rate for a fact table's own
 * date, keyed to a scalar CurrencyKey lookup for 'USD' rather than a second
 * join to dim.Dim_Currency (Fact_ExchangeRate itself has no CurrencyCode
 * column, only CurrencyKey). Used as a fallback when a row's own
 * DocumentExchangeRate is NULL/0 — see dualAmountExpr.
 *
 * dateColumn defaults to 'DateKey' (Fact_Sales/Fact_Returns/Fact_Collections/
 * Fact_Purchases all use this name); Fact_AR_Snapshot uses 'SnapshotDateKey'
 * instead — pass it explicitly for that table.
 */
export function usdConversionJoin(factAlias: string, dateColumn: string = 'DateKey'): string {
  return `LEFT JOIN fact.Fact_ExchangeRate fx ON fx.DateKey = ${factAlias}.${dateColumn} AND fx.CurrencyKey = (SELECT CurrencyKey FROM dim.Dim_Currency WHERE RTRIM(CurrencyCode) = 'USD')`;
}

/**
 * Paired BS/USD SUM expression for a money column on a fact table already
 * carrying a DocumentExchangeRate column (Fact_Sales, Fact_Returns,
 * Fact_Collections, Fact_AR_Snapshot, Fact_Purchases only — see
 * docs/superpowers/specs/2026-09-23-historical-usd-conversion-design.md).
 * Requires the query to also include usdConversionJoin(factAlias, ...)'s
 * join, aliased `fx`, for the fallback rate lookup.
 *
 * Division happens per-row, inside the SUM — NOT SUM(column) / rate — so a
 * group spanning multiple historical rates converts each row at its own
 * rate before aggregating, rather than distorting the whole group by
 * today's rate. NULLIF(...,0) on the divisor means a row with neither its
 * own DocumentExchangeRate nor a same-day Fact_ExchangeRate row produces
 * NULL for that row's USD contribution (SQL Server's SUM ignores NULLs),
 * rather than a divide-by-zero error.
 */
export function dualAmountExpr(factAlias: string, column: string, bsAlias: string, usdAlias: string): string {
  const col = `${factAlias}.${column}`;
  const rate = `NULLIF(COALESCE(${factAlias}.DocumentExchangeRate, fx.RateSell), 0)`;
  return `SUM(${col}) AS ${bsAlias}, SUM(${col} / ${rate}) AS ${usdAlias}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/api/dwh/lib/__tests__/query-builder.test.ts`
Expected: PASS, all tests including pre-existing ones.

- [ ] **Step 5: Add the shared `DualAmount` type**

**Files:**
- Modify: `app/(app)/analitica/types.ts`

Add near the top, right after `PivotDimension`/`BreakdownRow` (before the "Resumen tab" section comment):

```typescript
// Every money figure sourced from Fact_Sales/Fact_Returns/Fact_Collections/
// Fact_AR_Snapshot/Fact_Purchases (the 5 fact tables with a per-row
// DocumentExchangeRate — see docs/superpowers/specs/
// 2026-09-23-historical-usd-conversion-design.md) is shipped as both
// currencies, computed server-side with each row converted at ITS OWN
// historical rate before summing — never a single current rate applied to
// an already-summed total. `usd` is null only when no rate (the row's own
// DocumentExchangeRate, or that date's Fact_ExchangeRate fallback) was
// resolvable for any of the underlying rows. Finanzas/Multimoneda money
// fields (backed by Fact_Expenses/Fact_CashMovements, which have no rate
// column) are NOT DualAmount — they remain plain `number`, out of scope.
export interface DualAmount {
  bs: number;
  usd: number | null;
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/dwh/lib/query-builder.ts app/api/dwh/lib/__tests__/query-builder.test.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
feat: add shared historical USD conversion SQL builder

Adds usdConversionJoin/dualAmountExpr to query-builder.ts and the
DualAmount type every in-scope response field will migrate to. Every
DWH route currently divides an already-summed BS total by today's
exchange rate; these helpers convert each row at its own historical
DocumentExchangeRate (falling back to that date's Fact_ExchangeRate)
before summing. No route wired up yet — that's every following task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `resumen` route + `ResumenResponse`

**Files:**
- Modify: `app/api/dwh/resumen/route.ts`
- Modify: `app/(app)/analitica/types.ts` (`ResumenKPIs`, `MonthlyTrendRow`, `NamedAmount`, `SalesRepRow`, `AgingBucketRow`, `DebtorRow`, `ResumenResponse`)
- Test: `app/api/dwh/resumen/__tests__/route.test.ts` (new file — none exists today)

**Interfaces:**
- Consumes: `usdConversionJoin`, `dualAmountExpr` from Task 1; `DualAmount` type from Task 1.
- Produces: `ResumenResponse` with every money field as `DualAmount`, no `usdRate` field.

**Design notes:**

Every `SUM(NetAmount)`/`SUM(OutstandingBalance)`/`SUM(AmountCollected)` in this file's 7 queries gets the `dualAmountExpr` treatment, plus a `usdConversionJoin` added to each query's FROM/JOIN chain. `activeCustomersQuery` has no money fields (pure counts) — untouched. The route drops its `currency` query-param parsing and the `getUsdRate()` call entirely.

- [ ] **Step 1: Write the failing test**

Create `app/api/dwh/resumen/__tests__/route.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/resumen', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/resumen');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/api/dwh/resumen/__tests__/route.test.ts`
Expected: FAIL if `requireDwhAccess` doesn't yet 401 without a session — actually this should already PASS since auth-checking is unchanged. This step confirms the test harness runs; the real changes below are verified by type-checking (`tsc`) and manual review of the query text, since no live-DB test exists at this layer for aggregation math (see Global Constraints).

- [ ] **Step 3: Rewrite the 7 queries and response shape**

In `app/api/dwh/resumen/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { buildDateWhereClause, getDimensionSpec, jsonWithCache, usdConversionJoin, dualAmountExpr } from '@/app/api/dwh/lib/query-builder';
import type {
  ResumenResponse,
  MonthlyTrendRow,
  NamedAmount,
  SalesRepRow,
  AgingBucketRow,
  DebtorRow,
} from '@/app/(app)/analitica/types';
```

(Removed `getUsdRate` from the import list.)

```typescript
function monthlyTrendQuery(dateWhere: string): string {
  return `
    SELECT
      d.YearMonth,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         JOIN dim.Dim_Date dr ON dr.DateKey = fr.DateKey
         WHERE dr.YearMonth = d.YearMonth AND fr.IsVoided = 0) AS ReturnsNetBs,
      (SELECT ISNULL(SUM(fr.NetAmount / NULLIF(COALESCE(fr.DocumentExchangeRate, frfx.RateSell), 0)), 0)
         FROM fact.Fact_Returns fr
         ${usdConversionJoin('fr').replace('fx', 'frfx')}
         JOIN dim.Dim_Date dr ON dr.DateKey = fr.DateKey
         WHERE dr.YearMonth = d.YearMonth AND fr.IsVoided = 0) AS ReturnsNetUsd
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY d.YearMonth
    ORDER BY d.YearMonth
  `;
}
```

`usdConversionJoin('fr').replace('fx', 'frfx')` renames the join's `fx` alias to `frfx` inside this one correlated subquery, since the subquery is nested inside a query that already has its own outer `fx` (from `fs`'s join) — SQL Server would otherwise see two `fx` aliases in overlapping scope. Apply this same rename pattern (`fx` → `<shortalias>fx`) to every correlated-subquery `usdConversionJoin` call in this file and every other route in this plan — grep each file's finished query text for a duplicate bare `fx` alias before considering a query done.

```typescript
function topCustomersQuery(dateWhere: string): string {
  const spec = getDimensionSpec('cliente_entidad');
  return `
    SELECT TOP 10
      ${spec.labelExpr} AS Name,
      ${dualAmountExpr('fs', 'NetAmount', 'NetRevenueBs', 'NetRevenueUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY NetRevenueBs DESC
  `;
}

function topProductsQuery(dateWhere: string): string {
  return `
    SELECT TOP 10
      ISNULL(p.ProductName, p.ProductCode) AS Name,
      ${dualAmountExpr('fs', 'NetAmount', 'NetRevenueBs', 'NetRevenueUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.ProductName, p.ProductCode)
    ORDER BY NetRevenueBs DESC
  `;
}

function salesRepQuery(dateWhere: string, returnsDateWhere: string): string {
  return `
    SELECT
      ISNULL(r.SalesRepName, r.SalesRepCode) AS Name,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNetBs,
      (SELECT ISNULL(SUM(fr.NetAmount / NULLIF(COALESCE(fr.DocumentExchangeRate, frfx.RateSell), 0)), 0)
         FROM fact.Fact_Returns fr
         ${usdConversionJoin('fr').replace('fx', 'frfx')}
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNetUsd
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
    ORDER BY SalesNetBs DESC
  `;
}
```

`LATEST_SNAPSHOT_QUERY` unchanged (no money). `AGING_BUCKETS_QUERY` and `topDebtorsQuery` operate on `fact.Fact_AR_Snapshot`, whose date column is `SnapshotDateKey`:

```typescript
const AGING_BUCKETS_QUERY = `
  SELECT AgingBucket, ${dualAmountExpr('a', 'OutstandingBalance', 'AmountBs', 'AmountUsd')}
  FROM fact.Fact_AR_Snapshot a
  ${usdConversionJoin('a', 'SnapshotDateKey')}
  WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
  GROUP BY AgingBucket
`;

function topDebtorsQuery(): string {
  const spec = getDimensionSpec('cliente_entidad');
  return `
    SELECT TOP 10
      ${spec.labelExpr} AS Name,
      ${dualAmountExpr('a', 'OutstandingBalance', 'OutstandingBs', 'OutstandingUsd')}
    FROM fact.Fact_AR_Snapshot a
    ${usdConversionJoin('a', 'SnapshotDateKey')}
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey
    GROUP BY ${spec.groupByColumn}
    HAVING SUM(a.OutstandingBalance) > 0
    ORDER BY OutstandingBs DESC
  `;
}

function totalsQuery(salesDateWhere: string, returnsDateWhere: string, collectionsDateWhere: string): string {
  return `
    SELECT
      (SELECT ISNULL(SUM(NetAmount), 0) FROM fact.Fact_Sales fs
         WHERE fs.IsVoided = 0 ${salesDateWhere}) AS SalesNet12moBs,
      (SELECT ISNULL(SUM(fs.NetAmount / NULLIF(COALESCE(fs.DocumentExchangeRate, sfx.RateSell), 0)), 0)
         FROM fact.Fact_Sales fs ${usdConversionJoin('fs').replace('fx', 'sfx')}
         WHERE fs.IsVoided = 0 ${salesDateWhere}) AS SalesNet12moUsd,
      (SELECT ISNULL(SUM(NetAmount), 0) FROM fact.Fact_Returns fr
         WHERE fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNet12moBs,
      (SELECT ISNULL(SUM(fr.NetAmount / NULLIF(COALESCE(fr.DocumentExchangeRate, rfx.RateSell), 0)), 0)
         FROM fact.Fact_Returns fr ${usdConversionJoin('fr').replace('fx', 'rfx')}
         WHERE fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNet12moUsd,
      (SELECT ISNULL(SUM(AmountCollected), 0) FROM fact.Fact_Collections fc
         WHERE fc.IsVoided = 0 ${collectionsDateWhere}) AS Collected12moBs,
      (SELECT ISNULL(SUM(fc.AmountCollected / NULLIF(COALESCE(fc.DocumentExchangeRate, cfx.RateSell), 0)), 0)
         FROM fact.Fact_Collections fc ${usdConversionJoin('fc').replace('fx', 'cfx')}
         WHERE fc.IsVoided = 0 ${collectionsDateWhere}) AS Collected12moUsd
  `;
}
```

- [ ] **Step 4: Update the GET handler's response assembly**

Remove `const currency = searchParams.get('currency') ?? 'bs';` and the `currency === 'usd' ? getUsdRate() : Promise.resolve(null)` array entry (and its destructured `usdRate` binding) from the `Promise.all` in `GET`. Update every `.map()`/inline construction:

```typescript
const monthlyTrend: MonthlyTrendRow[] = trend.recordset.map(r => ({
  yearMonth: r.YearMonth,
  salesNet: { bs: Number(r.SalesNetBs), usd: r.SalesNetUsd === null ? null : Number(r.SalesNetUsd) },
  returnsNet: { bs: Number(r.ReturnsNetBs), usd: r.ReturnsNetUsd === null ? null : Number(r.ReturnsNetUsd) },
}));

const topCustomersMapped: NamedAmount[] = topCustomers.recordset.map(r => ({
  name: r.Name,
  netRevenue: { bs: Number(r.NetRevenueBs), usd: r.NetRevenueUsd === null ? null : Number(r.NetRevenueUsd) },
}));

const topProductsMapped: NamedAmount[] = topProducts.recordset.map(r => ({
  name: r.Name,
  netRevenue: { bs: Number(r.NetRevenueBs), usd: r.NetRevenueUsd === null ? null : Number(r.NetRevenueUsd) },
}));

const salesRepsMapped: SalesRepRow[] = salesReps.recordset.map(r => ({
  name: r.Name,
  salesNet: { bs: Number(r.SalesNetBs), usd: r.SalesNetUsd === null ? null : Number(r.SalesNetUsd) },
  returnsNet: { bs: Number(r.ReturnsNetBs), usd: r.ReturnsNetUsd === null ? null : Number(r.ReturnsNetUsd) },
}));

const agingBucketsMapped: AgingBucketRow[] = agingBuckets.map(r => ({
  bucket: r.AgingBucket,
  amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) },
}));

const topDebtorsMapped: DebtorRow[] = topDebtors.map(r => ({
  name: r.Name,
  outstanding: { bs: Number(r.OutstandingBs), usd: r.OutstandingUsd === null ? null : Number(r.OutstandingUsd) },
  avgDaysToPay: null,
}));
```

`returnRate: salesNet > 0 ? returnsNet / salesNet : null` in the `kpis` object now reads off `.bs` for the ratio (a ratio is currency-invariant — BS/BS or USD/USD give the same number as long as both sides use the same currency; using `.bs` for both numerator and denominator is simplest and always defined, since `.bs` is never null):

```typescript
const totalsRow = totals.recordset[0] ?? { SalesNet12moBs: 0, SalesNet12moUsd: 0, ReturnsNet12moBs: 0, ReturnsNet12moUsd: 0, Collected12moBs: 0, Collected12moUsd: 0 };
const salesNetBs = Number(totalsRow.SalesNet12moBs);
const salesNetUsd = totalsRow.SalesNet12moUsd === null ? null : Number(totalsRow.SalesNet12moUsd);
const returnsNetBs = Number(totalsRow.ReturnsNet12moBs);
const returnsNetUsd = totalsRow.ReturnsNet12moUsd === null ? null : Number(totalsRow.ReturnsNet12moUsd);

// ... (activeCustomers block unchanged) ...

const response: ResumenResponse = {
  monthlyTrend,
  topCustomers: topCustomersMapped,
  topProducts: topProductsMapped,
  salesReps: salesRepsMapped,
  agingBuckets: agingBucketsMapped,
  topDebtors: topDebtorsMapped,
  snapshotDateKey,
  kpis: {
    salesNet12mo: { bs: salesNetBs, usd: salesNetUsd },
    returnsNet12mo: { bs: returnsNetBs, usd: returnsNetUsd },
    returnRate: salesNetBs > 0 ? returnsNetBs / salesNetBs : null,
    collected12mo: {
      bs: Number(totalsRow.Collected12moBs),
      usd: totalsRow.Collected12moUsd === null ? null : Number(totalsRow.Collected12moUsd),
    },
    activeCustomers,
    activeCustomersPrevPeriod,
    churnRate,
  },
};
```

Also remove the now-unused `activeCustomersResult` position shift — the `Promise.all` array loses one entry (`getUsdRate`'s), so update the destructuring `const [trend, topCustomers, topProducts, salesReps, latestSnapshot, totals, activeCustomersResult] = await Promise.all([...])` (7 entries, not 8) and remove the corresponding array entry.

- [ ] **Step 5: Update `types.ts`**

```typescript
// Resumen tab
export interface ResumenKPIs {
  salesNet12mo: DualAmount;
  returnsNet12mo: DualAmount;
  returnRate: number | null;
  collected12mo: DualAmount;
  activeCustomers: number;
  activeCustomersPrevPeriod: number | null;
  churnRate: number | null;
}

export interface MonthlyTrendRow {
  yearMonth: string;
  salesNet: DualAmount;
  returnsNet: DualAmount;
}

export interface NamedAmount {
  name: string;
  netRevenue: DualAmount;
}

export interface SalesRepRow {
  name: string;
  salesNet: DualAmount;
  returnsNet: DualAmount;
}

export interface AgingBucketRow {
  bucket: string;
  amount: DualAmount;
}

export interface DebtorRow {
  name: string;
  outstanding: DualAmount;
  avgDaysToPay: number | null;
}

export interface ResumenResponse {
  monthlyTrend: MonthlyTrendRow[];
  topCustomers: NamedAmount[];
  topProducts: NamedAmount[];
  salesReps: SalesRepRow[];
  agingBuckets: AgingBucketRow[];
  topDebtors: DebtorRow[];
  snapshotDateKey: number | null;
  kpis: ResumenKPIs;
}
```

(`usdRate: number | null;` line removed from `ResumenResponse`.)

- [ ] **Step 6: Run the test and typecheck**

Run: `bun test app/api/dwh/resumen/__tests__/route.test.ts && bunx tsc --noEmit`
Expected: test PASSes; `tsc` reports no new errors in `resumen/route.ts` or `types.ts` (later tasks will still show errors in files not yet migrated — that's expected until Task 10 completes; re-run the full `tsc --noEmit` again as a final check after Task 10).

- [ ] **Step 7: Commit**

```bash
git add app/api/dwh/resumen/route.ts app/api/dwh/resumen/__tests__/route.test.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
fix: convert resumen route to historical per-row USD conversion

Every SUM(NetAmount)/SUM(OutstandingBalance)/SUM(AmountCollected) in
this route now converts each underlying row at its own
DocumentExchangeRate (falling back to that date's Fact_ExchangeRate)
before summing, instead of dividing an already-summed BS total by
today's rate. Response always carries both currencies now; usdRate
and the currency query param are gone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Delete the dead `dashboard` route

**Files:**
- Delete: `app/api/dwh/dashboard/route.ts` (and its containing `app/api/dwh/dashboard/` directory if nothing else lives there)

**Interfaces:** None — this route is confirmed unreferenced.

- [ ] **Step 1: Confirm zero references**

Run: `grep -rn "/api/dwh/dashboard" app lib`
Expected: no output. (Already confirmed during planning — re-verify here in case something changed since.)

- [ ] **Step 2: Delete the route**

```bash
rm -rf app/api/dwh/dashboard
```

- [ ] **Step 3: Confirm the app still builds**

Run: `bunx tsc --noEmit`
Expected: no new errors referencing `app/api/dwh/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add -A app/api/dwh/dashboard
git commit -m "$(cat <<'EOF'
chore: remove dead dashboard DWH route

Superseded by /api/dwh/resumen; nothing under app/ has referenced
/api/dwh/dashboard since Resumen replaced it. Had the same
current-rate USD conversion bug fixed elsewhere in this branch, but
fixing dead code isn't useful — deleting instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `ventas` route + `VentasResponse`/`VentasKpis`/`VentasComparisonResponse`

**Files:**
- Modify: `app/api/dwh/ventas/route.ts`
- Modify: `app/(app)/analitica/types.ts` (`VentasRow`, `VentasResponse`, `VentasKpis`, `VentasKpisResponse`, `VentasComparisonResponse`, `ComparisonSeriesMonthRow`)
- Test: `app/api/dwh/ventas/__tests__/route.test.ts` (extend existing)

**Interfaces:**
- Consumes: `usdConversionJoin`, `dualAmountExpr`, `DualAmount` from Task 1.
- Produces: `VentasResponse`/`VentasKpisResponse`/`VentasComparisonResponse` with money fields as `DualAmount`, no `usdRate`.

**Design notes:**

This route has 8 query-building functions plus 2 inline ad-hoc breakdown queries in `GET` itself. `ComparisonSeriesMonthRow.values: Record<string, number>` (one salesNet per selected série per month, pivoted for the chart) becomes `Record<string, DualAmount>` — the chart itself (Task 12) picks `.bs`/`.usd` per point.

- [ ] **Step 1: Extend the existing test file (already has an unauthenticated-401 test)** — no new test needed beyond what exists; this route's aggregation math isn't unit-testable without a live DB (see Global Constraints). Verification is via `tsc` and manual read-through of the finished query text against Task 1's helpers.

- [ ] **Step 2: Rewrite `monthlyQuery`**

```typescript
function monthlyQuery(dateWhere: string, returnsDateWhere: string): string {
  return `
    SELECT
      d.YearMonth AS GroupValue,
      d.YearMonth AS GroupLabel,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         JOIN dim.Dim_Date dr ON dr.DateKey = fr.DateKey
         WHERE dr.YearMonth = d.YearMonth AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNetBs,
      (SELECT ISNULL(SUM(fr.NetAmount / NULLIF(COALESCE(fr.DocumentExchangeRate, rfx.RateSell), 0)), 0)
         FROM fact.Fact_Returns fr
         ${usdConversionJoin('fr').replace('fx', 'rfx')}
         JOIN dim.Dim_Date dr ON dr.DateKey = fr.DateKey
         WHERE dr.YearMonth = d.YearMonth AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNetUsd
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY d.YearMonth
    ORDER BY d.YearMonth
  `;
}
```

`GrossAmount`/`DiscountAmount` stay plain `number` (BS-only) — they only feed `avgDiscount`, a ratio (`discountAmount / grossAmount`), never displayed as a standalone money figure in the UI. Confirmed by reading `VentasRow` (`avgDiscount: number | null`, not `DualAmount`) — no change needed there.

- [ ] **Step 3: Rewrite `clienteQuery`**

```typescript
function clienteQuery(dimension: Dimension, dateWhere: string, returnsDateWhere: string, monthFilter: string, salesRepFilter: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fr2');
  return `
    SELECT TOP 15
      ${spec.valueExpr} AS GroupValue,
      ${spec.labelExpr} AS GroupLabel,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr2.NetAmount), 0)
         FROM fact.Fact_Returns fr2
         ${innerJoin}
         WHERE fr2.IsVoided = 0 ${returnsDateWhere} AND ${condition}
      ) AS ReturnsNetBs,
      (SELECT ISNULL(SUM(fr2.NetAmount / NULLIF(COALESCE(fr2.DocumentExchangeRate, r2fx.RateSell), 0)), 0)
         FROM fact.Fact_Returns fr2
         ${innerJoin}
         ${usdConversionJoin('fr2').replace('fx', 'r2fx')}
         WHERE fr2.IsVoided = 0 ${returnsDateWhere} AND ${condition}
      ) AS ReturnsNetUsd
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${monthFilter} ${salesRepFilter}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesNetBs DESC
  `;
}
```

- [ ] **Step 4: Rewrite `lineaQuery`**

```typescript
function lineaQuery(dateWhere: string, returnsDateWhere: string): string {
  return `
    SELECT TOP 15
      ISNULL(p.LineCode, 'SIN_LINEA') AS GroupValue,
      ISNULL(p.LineName, 'Sin línea') AS GroupLabel,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         JOIN dim.Dim_Product pr ON pr.ProductKey = fr.ProductKey
         WHERE ISNULL(pr.LineCode, 'SIN_LINEA') = ISNULL(p.LineCode, 'SIN_LINEA') AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNetBs,
      (SELECT ISNULL(SUM(fr.NetAmount / NULLIF(COALESCE(fr.DocumentExchangeRate, rfx.RateSell), 0)), 0)
         FROM fact.Fact_Returns fr
         ${usdConversionJoin('fr').replace('fx', 'rfx')}
         JOIN dim.Dim_Product pr ON pr.ProductKey = fr.ProductKey
         WHERE ISNULL(pr.LineCode, 'SIN_LINEA') = ISNULL(p.LineCode, 'SIN_LINEA') AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNetUsd
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.LineCode, 'SIN_LINEA'), ISNULL(p.LineName, 'Sin línea')
    ORDER BY SalesNetBs DESC
  `;
}
```

- [ ] **Step 5: Rewrite `lineaProductBreakdownQuery`, `KPIS_QUERY`, `PREV_PERIOD_SALES_QUERY`**

```typescript
function lineaProductBreakdownQuery(salesDateWhere: string): string {
  return `
    SELECT TOP 15
      CAST(p.ProductKey AS varchar(20)) AS GroupValue,
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 AND ISNULL(p.LineCode, 'SIN_LINEA') = @parentValue ${salesDateWhere}
    GROUP BY p.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesNetBs DESC
  `;
}

const KPIS_QUERY = (dateWhere: string) => `
  SELECT
    ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
    SUM(fs.QuantitySold) AS UnitsSold,
    COUNT(DISTINCT le.LegalEntityKey) AS ActiveClients,
    COUNT(DISTINCT fs.InvoiceNumber) AS InvoiceCount
  FROM fact.Fact_Sales fs
  ${usdConversionJoin('fs')}
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
  WHERE fs.IsVoided = 0 ${dateWhere}
`;

const PREV_PERIOD_SALES_QUERY = (dateWhere: string) => `
  SELECT ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
  FROM fact.Fact_Sales fs
  ${usdConversionJoin('fs')}
  WHERE fs.IsVoided = 0 ${dateWhere}
`;
```

- [ ] **Step 6: Rewrite `comparisonByLineaQuery`/`comparisonByClienteQuery`**

```typescript
function comparisonByLineaQuery(dateWhere: string, keyParams: string[]): string {
  return `
    SELECT d.YearMonth, ISNULL(p.LineCode, 'SIN_LINEA') AS SeriesKey, ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} AND ISNULL(p.LineCode, 'SIN_LINEA') IN (${keyParams.join(', ')})
    GROUP BY d.YearMonth, ISNULL(p.LineCode, 'SIN_LINEA')
    ORDER BY d.YearMonth
  `;
}

function comparisonByClienteQuery(dateWhere: string, keyParams: string[]): string {
  return `
    SELECT d.YearMonth, CAST(le.LegalEntityKey AS varchar(20)) AS SeriesKey, ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} AND le.LegalEntityKey IN (${keyParams.join(', ')})
    GROUP BY d.YearMonth, le.LegalEntityKey
    ORDER BY d.YearMonth
  `;
}
```

- [ ] **Step 7: Update `handleKpis`, `handleComparison`, and the two inline breakdown branches in `GET`**

`handleKpis` below constructs `DualAmount` values directly, so add it to this file's type-only import from `types.ts` (`import type { VentasResponse, VentasRow, GroupBy, VentasKpis, VentasKpisResponse, ComparisonOption, ComparisonOptionsResponse, ComparisonSeriesMonthRow, VentasComparisonResponse, DualAmount } from '@/app/(app)/analitica/types';`).

```typescript
async function handleKpis(dateWhere: string, prevDateWhere: string | null): Promise<NextResponse> {
  const pool = await getDwhPool();
  const [kpiResult, prevResult] = await Promise.all([
    pool.request().query(KPIS_QUERY(dateWhere)),
    prevDateWhere !== null ? pool.request().query(PREV_PERIOD_SALES_QUERY(prevDateWhere)) : Promise.resolve(null),
  ]);

  const row = kpiResult.recordset[0] as { SalesNetBs: number | null; SalesNetUsd: number | null; UnitsSold: number | null; ActiveClients: number; InvoiceCount: number };
  const salesNetBs = Number(row.SalesNetBs ?? 0);
  const salesNetUsd = row.SalesNetUsd === null ? null : Number(row.SalesNetUsd);
  const activeClients = Number(row.ActiveClients ?? 0);
  const invoiceCount = Number(row.InvoiceCount ?? 0);
  const prevRow = prevResult?.recordset[0] as { SalesNetBs: number | null; SalesNetUsd: number | null } | undefined;
  const salesNetPrevPeriod: DualAmount | null = prevResult
    ? { bs: Number(prevRow?.SalesNetBs ?? 0), usd: prevRow?.SalesNetUsd === null || prevRow?.SalesNetUsd === undefined ? null : Number(prevRow.SalesNetUsd) }
    : null;

  const kpis: VentasKpis = {
    salesNet: { bs: salesNetBs, usd: salesNetUsd },
    salesNetPrevPeriod,
    activeClients,
    avgTicket: invoiceCount > 0 ? { bs: salesNetBs / invoiceCount, usd: salesNetUsd === null ? null : salesNetUsd / invoiceCount } : null,
    unitsSold: Number(row.UnitsSold ?? 0),
    salesPerActiveClient: activeClients > 0 ? { bs: salesNetBs / activeClients, usd: salesNetUsd === null ? null : salesNetUsd / activeClients } : null,
  };

  const response: VentasKpisResponse = { kpis };
  return jsonWithCache(response);
}
```

(`VentasKpis.salesNetPrevPeriod` changes from `number | null` to `DualAmount | null` — see Step 9.)

```typescript
async function handleComparison(dateWhere: string, keys: string[], mode: 'linea' | 'cliente'): Promise<NextResponse> {
  const pool = await getDwhPool();
  const req = pool.request();
  const keyParams = keys.map((k, i) => {
    req.input(`k${i}`, k);
    return `@k${i}`;
  });
  const query = mode === 'linea' ? comparisonByLineaQuery(dateWhere, keyParams) : comparisonByClienteQuery(dateWhere, keyParams);
  const result = await req.query(query);

  const byMonth = new Map<string, ComparisonSeriesMonthRow>();
  for (const r of result.recordset as { YearMonth: string; SeriesKey: string; SalesNetBs: number; SalesNetUsd: number | null }[]) {
    let entry = byMonth.get(r.YearMonth);
    if (!entry) {
      entry = { yearMonth: formatYearMonth(r.YearMonth), yearMonthValue: r.YearMonth, values: {} };
      byMonth.set(r.YearMonth, entry);
    }
    entry.values[r.SeriesKey] = { bs: Number(r.SalesNetBs), usd: r.SalesNetUsd === null ? null : Number(r.SalesNetUsd) };
  }
  const rows = Array.from(byMonth.values()).sort((a, b) => a.yearMonthValue.localeCompare(b.yearMonthValue));

  const response: VentasComparisonResponse = { rows };
  return jsonWithCache(response);
}
```

Update `GET`'s call sites: `handleKpis(dateWhere, prevDateWhere, currency)` → `handleKpis(dateWhere, prevDateWhere)`; `handleComparison(dateWhere, keys, ..., currency)` → `handleComparison(dateWhere, keys, ...)`. Remove `const currency = searchParams.get('currency') ?? 'bs';` entirely (grep the file for every remaining `currency` reference after this edit — including inside `handleComparisonOptions`, which takes no currency param and needs no change).

The two inline ad-hoc breakdown branches in `GET` (the `breakdownBy && parentValue` blocks) each build a one-off query and map `salesNet: Number(r.SalesNet)` into a plain `{ label, value, salesNet }` breakdown object (typed as `BreakdownRow`, a generic `Record<string, string | number | null>` — NOT `VentasRow`). Per `BreakdownRow`'s own type (`[metricKey: string]: string | number | null`), it cannot hold a nested `DualAmount` object without widening that shared type, which is used by every other route's breakdown, too. Leave `BreakdownRow`'s `salesNet`/`purchasesNet`/`returnsNet` breakdown metrics as plain BS numbers for this plan — this is a pre-existing simplification (breakdown drill-in rows already show fewer columns than their parent table everywhere in this codebase) and is called out as an explicit non-goal in Step 10 below, not a silent omission.

- [ ] **Step 8: Update `VentasRow`/response mapping in `GET`**

```typescript
const rows: VentasRow[] = recordset.map(r => {
  const salesNetBs = Number(r.SalesNetBs);
  const salesNetUsd = r.SalesNetUsd === null ? null : Number(r.SalesNetUsd);
  const grossAmount = Number(r.GrossAmount);
  const discountAmount = Number(r.DiscountAmount);
  const returnsNetBs = Number(r.ReturnsNetBs);
  const label = groupBy === 'mes' ? formatYearMonth(String(r.GroupLabel)) : String(r.GroupLabel);
  return {
    label,
    value: r.GroupValue as string,
    salesNet: { bs: salesNetBs, usd: salesNetUsd },
    returnRate: salesNetBs > 0 ? returnsNetBs / salesNetBs : null,
    avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
  };
});

const response: VentasResponse = { rows, groupBy, breadcrumb };
```

(`usdRate` field removed from the object literal.)

- [ ] **Step 9: Update `types.ts`**

```typescript
export interface VentasRow {
  label: string;
  value: string | number;
  salesNet: DualAmount;
  returnRate: number | null;
  avgDiscount: number | null;
}

export interface VentasResponse {
  rows: VentasRow[];
  groupBy: GroupBy;
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
}

export interface VentasKpis {
  salesNet: DualAmount;
  salesNetPrevPeriod: DualAmount | null;
  activeClients: number;
  avgTicket: DualAmount | null;
  unitsSold: number;
  salesPerActiveClient: DualAmount | null;
}

export interface VentasKpisResponse {
  kpis: VentasKpis;
}

export interface ComparisonSeriesMonthRow {
  yearMonth: string;
  yearMonthValue: string;
  values: Record<string, DualAmount>;
}

export interface VentasComparisonResponse {
  rows: ComparisonSeriesMonthRow[];
}
```

(`ComparisonOption`/`ComparisonOptionsResponse` unchanged — no money fields.)

- [ ] **Step 10: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: no new errors in `ventas/route.ts` or the types just changed (errors will remain in not-yet-migrated tab components until Task 12 — expected).

- [ ] **Step 11: Commit**

```bash
git add app/api/dwh/ventas/route.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
fix: convert ventas route to historical per-row USD conversion

Same treatment as resumen: every SUM(NetAmount) across monthlyQuery,
clienteQuery, lineaQuery, KPIS_QUERY, and the comparison-chart queries
now converts per-row before aggregating. Ad-hoc breakdown rows
(BreakdownRow-typed) keep a plain BS number for now — that generic
type is shared across every route's drill-in breakdown and widening
it is out of scope for this fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `productos` route + `ProductosResponse`/`ProfundidadLineaResponse`/`UnitsByLineaResponse`

**Files:**
- Modify: `app/api/dwh/productos/route.ts`
- Modify: `app/(app)/analitica/types.ts` (`ProductosRow`, `ProductosResponse`, `ProfundidadLineaRow`, `ProfundidadLineaResponse`, `UnitsByLineaMonthRow`, `UnitsByLineaResponse`)
- Test: `app/api/dwh/productos/__tests__/route.test.ts` (new file — none exists today)

**Interfaces:**
- Consumes: `usdConversionJoin`, `dualAmountExpr`, `DualAmount` from Task 1.

**Design notes:**

`margin` (`GrossProfitAmount / NetAmount`) stays a plain ratio — `GrossProfitAmount` is always `NULL` today (`CostSourceFlag = 'NO_COST_DATA'`, per this file's own header comment) and is out of this fix's scope regardless (no `DocumentExchangeRate`-style rate applies to a margin ratio). `avgMonthlyPrice` in `ProfundidadLineaRow` IS a real per-unit money figure and becomes `DualAmount`.

- [ ] **Step 1: Create the test file**

```typescript
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/productos', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/productos');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('rejects unauthenticated requests with 401 for section=profundidad', async () => {
    const req = new NextRequest('http://localhost/api/dwh/productos?section=profundidad');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (auth check unchanged)**

Run: `bun test app/api/dwh/productos/__tests__/route.test.ts`
Expected: PASS immediately (auth logic isn't touched by this fix) — this establishes the smoke-test baseline before the query rewrite.

- [ ] **Step 3: Rewrite `lineaQuery`, `sublineaQuery`, `skuQuery`**

```typescript
function lineaQuery(dateWhere: string, tiendaWhere: string): string {
  return `
    SELECT TOP 30
      ISNULL(p.LineName, '${NO_LINEA}') AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
    GROUP BY ISNULL(p.LineName, '${NO_LINEA}')
    ORDER BY SalesNetBs DESC
  `;
}

function sublineaQuery(dateWhere: string, tiendaWhere: string): string {
  return `
    SELECT TOP 30
      ISNULL(p.SubLineName, '${NO_SUBLINEA}') AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere} AND ISNULL(p.LineName, '${NO_LINEA}') = @linea
    GROUP BY ISNULL(p.SubLineName, '${NO_SUBLINEA}')
    ORDER BY SalesNetBs DESC
  `;
}

function skuQuery(dateWhere: string, tiendaWhere: string): string {
  return `
    SELECT TOP 50
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
      AND ISNULL(p.LineName, '${NO_LINEA}') = @linea
      AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublinea
    GROUP BY ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesNetBs DESC
  `;
}
```

(`tiendasQuery`/`activeTotalsQuery`/`topLineasQuery` unchanged — no money.)

- [ ] **Step 4: Rewrite `profundidadLineaQuery` and `unitsByLineaMonthQuery`**

```typescript
function profundidadLineaQuery(dateWhere: string, returnsDateWhere: string, tiendaWhere: string, returnsTiendaWhere: string): string {
  return `
    SELECT TOP 15
      ISNULL(p.ProductName, p.ProductCode) AS Sku,
      COUNT(DISTINCT le.LegalEntityKey) AS ClientCount,
      COUNT(DISTINCT fs.CustomerKey) AS StoreCount,
      COUNT(DISTINCT d.YearMonth) AS MonthCount,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      SUM(fs.QuantitySold) AS QuantitySold,
      ISNULL((SELECT SUM(fr.NetAmount) FROM fact.Fact_Returns fr
              WHERE fr.ProductKey = p.ProductKey AND fr.IsVoided = 0 ${returnsDateWhere} ${returnsTiendaWhere}), 0) AS ReturnsNetBs,
      ISNULL((SELECT SUM(fr.NetAmount / NULLIF(COALESCE(fr.DocumentExchangeRate, rfx.RateSell), 0))
              FROM fact.Fact_Returns fr ${usdConversionJoin('fr').replace('fx', 'rfx')}
              WHERE fr.ProductKey = p.ProductKey AND fr.IsVoided = 0 ${returnsDateWhere} ${returnsTiendaWhere}), 0) AS ReturnsNetUsd
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
    GROUP BY p.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesNetBs DESC
  `;
}

function unitsByLineaMonthQuery(dateWhere: string, tiendaWhere: string): string {
  return `
    SELECT
      d.YearMonth AS YearMonth,
      ISNULL(p.LineName, '${NO_LINEA}') AS LineName,
      SUM(fs.QuantitySold) AS QuantitySold,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
    GROUP BY d.YearMonth, ISNULL(p.LineName, '${NO_LINEA}')
    ORDER BY d.YearMonth
  `;
}
```

- [ ] **Step 5: Update `handleProfundidad`, `handlePorLineaMes`, and the main `GET` mapping**

```typescript
async function handleProfundidad(dateWhere: string, returnsDateWhere: string, tiendaWhere: string, tiendaKey: number | null): Promise<NextResponse> {
  const pool = await getDwhPool();
  const returnsTiendaWhere = tiendaKey !== null ? 'AND fr.CustomerKey = @tiendaKey' : '';

  const rowsReq = pool.request();
  if (tiendaKey !== null) rowsReq.input('tiendaKey', tiendaKey);
  const rowsResult = await rowsReq.query(profundidadLineaQuery(dateWhere, returnsDateWhere, tiendaWhere, returnsTiendaWhere));

  const totalsReq = pool.request();
  if (tiendaKey !== null) totalsReq.input('tiendaKey', tiendaKey);
  const totalsResult = await totalsReq.query(activeTotalsQuery(dateWhere, tiendaWhere));
  const totalClients = Number(totalsResult.recordset[0]?.TotalClients ?? 0);
  const totalStores = Number(totalsResult.recordset[0]?.TotalStores ?? 0);

  const rows: ProfundidadLineaRow[] = rowsResult.recordset.map(r => {
    const clientCount = Number(r.ClientCount);
    const storeCount = Number(r.StoreCount);
    const monthCount = Number(r.MonthCount) || 1;
    const salesNetBs = Number(r.SalesNetBs);
    const salesNetUsd = r.SalesNetUsd === null ? null : Number(r.SalesNetUsd);
    const quantitySold = Number(r.QuantitySold);
    const returnsNetBs = Number(r.ReturnsNetBs);

    return {
      sku: String(r.Sku),
      clientCount,
      clientShare: totalClients > 0 ? clientCount / totalClients : null,
      storeCount,
      storeShare: totalStores > 0 ? storeCount / totalStores : null,
      avgMonthlyPrice: quantitySold > 0
        ? { bs: salesNetBs / quantitySold, usd: salesNetUsd === null ? null : salesNetUsd / quantitySold }
        : { bs: 0, usd: 0 },
      avgMonthlyUnits: quantitySold / monthCount,
      returnRate: salesNetBs > 0 ? returnsNetBs / salesNetBs : null,
    };
  });

  const response: ProfundidadLineaResponse = { rows };
  return jsonWithCache(response);
}

async function handlePorLineaMes(dateWhere: string, tiendaWhere: string, tiendaKey: number | null): Promise<NextResponse> {
  const pool = await getDwhPool();

  const topReq = pool.request();
  if (tiendaKey !== null) topReq.input('tiendaKey', tiendaKey);
  const topResult = await topReq.query(topLineasQuery(dateWhere, tiendaWhere));
  const topLineas = new Set(topResult.recordset.map(r => String(r.LineName)));

  const monthReq = pool.request();
  if (tiendaKey !== null) monthReq.input('tiendaKey', tiendaKey);
  const monthResult = await monthReq.query(unitsByLineaMonthQuery(dateWhere, tiendaWhere));

  const byMonth = new Map<string, UnitsByLineaMonthRow>();
  const lineasSeen: string[] = [];
  let hasOtras = false;

  for (const r of monthResult.recordset) {
    const yearMonthValue = String(r.YearMonth);
    const rawLinea = String(r.LineName);
    const linea = topLineas.has(rawLinea) ? rawLinea : 'Otras';
    if (linea === 'Otras') hasOtras = true;
    else if (!lineasSeen.includes(linea)) lineasSeen.push(linea);

    let bucket = byMonth.get(yearMonthValue);
    if (!bucket) {
      bucket = { yearMonth: formatYearMonth(yearMonthValue), yearMonthValue, units: {}, salesNet: {}, totalSalesNet: { bs: 0, usd: 0 } };
      byMonth.set(yearMonthValue, bucket);
    }
    const rowSalesNetBs = Number(r.SalesNetBs);
    const rowSalesNetUsd = r.SalesNetUsd === null ? null : Number(r.SalesNetUsd);
    bucket.units[linea] = (bucket.units[linea] ?? 0) + Number(r.QuantitySold);
    const existing = bucket.salesNet[linea] ?? { bs: 0, usd: 0 };
    bucket.salesNet[linea] = {
      bs: existing.bs + rowSalesNetBs,
      usd: existing.usd === null || rowSalesNetUsd === null ? null : existing.usd + rowSalesNetUsd,
    };
    bucket.totalSalesNet = {
      bs: bucket.totalSalesNet.bs + rowSalesNetBs,
      usd: bucket.totalSalesNet.usd === null || rowSalesNetUsd === null ? null : bucket.totalSalesNet.usd + rowSalesNetUsd,
    };
  }

  const rows = Array.from(byMonth.values()).sort((a, b) => a.yearMonthValue.localeCompare(b.yearMonthValue));
  const lineas = hasOtras ? [...lineasSeen, 'Otras'] : lineasSeen;

  const response: UnitsByLineaResponse = { rows, lineas };
  return jsonWithCache(response);
}
```

Note the `usd: null` propagation in the accumulator: once any contributing row has an unresolvable rate (`null`), the running total for that bucket permanently becomes `null` rather than silently treating the missing row as 0 — consistent with `DualAmount`'s documented meaning ("`usd` is null only when no rate was resolvable for **any** of the underlying rows").

Update `GET`'s call sites (`handleProfundidad(dateWhere, returnsDateWhere, tiendaWhere, tiendaKey, currency)` → drop the trailing `currency` arg; same for `handlePorLineaMes`), and the main (non-section) branch's row mapping:

```typescript
const rows: ProductosRow[] = recordset.map(r => {
  const salesNetBs = Number(r.SalesNetBs);
  const salesNetUsd = r.SalesNetUsd === null ? null : Number(r.SalesNetUsd);
  const rotacion = Number(r.QuantitySold);
  const grossProfit = r.GrossProfitAmount === null || r.GrossProfitAmount === undefined
    ? null
    : Number(r.GrossProfitAmount);
  const margin = grossProfit !== null && salesNetBs !== 0 ? grossProfit / salesNetBs : null;
  const salesShare = totalSalesNet > 0 ? salesNetBs / totalSalesNet : null;
  const label = String(r.GroupLabel);

  return {
    sku: groupBy === 'sku' ? label : '',
    linea: groupBy === 'linea' ? label : (lineaParam ?? ''),
    sublinea: groupBy === 'sku' ? (sublineaParam ?? '') : groupBy === 'sublinea' ? label : '',
    rotacion,
    salesShare,
    salesNet: { bs: salesNetBs, usd: salesNetUsd },
    margin,
  };
});

const response: ProductosResponse = { rows, groupBy: groupBy as GroupBy, breadcrumb };
```

`totalSalesNet` (the `reduce` just above this block, used only for `salesShare`) stays a plain BS number — it's a same-currency ratio denominator, never displayed: `const totalSalesNet = recordset.reduce((sum, r) => sum + Number(r.SalesNetBs), 0);` (column name changed from `r.SalesNet` to `r.SalesNetBs`).

Remove `const currency = searchParams.get('currency') ?? 'bs';` and every remaining `getUsdRate()` call in this file.

- [ ] **Step 6: Update `types.ts`**

```typescript
export interface ProductosRow {
  sku: string;
  linea: string;
  sublinea: string;
  rotacion: number;
  salesNet: DualAmount;
  margin: number | null;
  salesShare: number | null;
}

export interface ProductosResponse {
  rows: ProductosRow[];
  groupBy: GroupBy;
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
}

export interface ProfundidadLineaRow {
  sku: string;
  clientCount: number;
  clientShare: number | null;
  storeCount: number;
  storeShare: number | null;
  avgMonthlyPrice: DualAmount;
  avgMonthlyUnits: number;
  returnRate: number | null;
}

export interface ProfundidadLineaResponse {
  rows: ProfundidadLineaRow[];
}

export interface UnitsByLineaMonthRow {
  yearMonth: string;
  yearMonthValue: string;
  units: Record<string, number>;
  salesNet: Record<string, DualAmount>;
  totalSalesNet: DualAmount;
}

export interface UnitsByLineaResponse {
  rows: UnitsByLineaMonthRow[];
  lineas: string[];
}
```

- [ ] **Step 7: Run tests and typecheck**

Run: `bun test app/api/dwh/productos/__tests__/route.test.ts && bunx tsc --noEmit`
Expected: tests PASS; no new errors in `productos/route.ts` or the touched types.

- [ ] **Step 8: Commit**

```bash
git add app/api/dwh/productos/route.ts app/api/dwh/productos/__tests__/route.test.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
fix: convert productos route to historical per-row USD conversion

lineaQuery/sublineaQuery/skuQuery/profundidadLineaQuery/
unitsByLineaMonthQuery now convert per-row before aggregating.
avgMonthlyPrice and the per-línea salesNet maps become DualAmount;
margin stays a plain ratio (GrossProfitAmount has no rate concept and
is unpopulated regardless).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `clientes` route + `ClientesResponse`/`ClientesChurnedResponse`

**Files:**
- Modify: `app/api/dwh/clientes/route.ts`
- Modify: `app/(app)/analitica/types.ts` (`ClientesRow`, `ClientesResponse`, `ClientesChurnedRow`, `ClientesChurnedResponse`)
- Test: `app/api/dwh/clientes/__tests__/route.test.ts` (extend existing)

**Interfaces:**
- Consumes: `usdConversionJoin`, `dualAmountExpr`, `DualAmount` from Task 1.

**Design notes:**

`ClientesTrendRow`/`ClientesTrendResponse` (the `section=trend` branch) has no money fields (`activeCustomers`/`churnRate` only) — untouched. Only `customerQuery` (main list) and `churnedQuery` (`section=churned`) carry money.

- [ ] **Step 1: Confirm existing test still covers auth** — no new test file needed; extend nothing (the existing 401 test already covers `GET`'s default branch; `section=trend`/`section=churned` share the same top-of-handler auth check).

- [ ] **Step 2: Rewrite `churnedQuery`**

```typescript
function churnedQuery(dimension: Dimension, prevDateWhere: string, currentDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fs2');
  return `
    SELECT TOP 200
      ${spec.labelExpr} AS Name,
      MAX(fs.DateKey) AS LastPurchaseDateKey,
      ${dualAmountExpr('fs', 'NetAmount', 'LostRevenueBs', 'LostRevenueUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${prevDateWhere}
      AND NOT EXISTS (
        SELECT 1 FROM fact.Fact_Sales fs2
        ${innerJoin}
        WHERE fs2.IsVoided = 0 ${currentDateWhere} AND ${condition}
      )
    GROUP BY ${spec.groupByColumn}
    ORDER BY LostRevenueBs DESC
  `;
}
```

- [ ] **Step 3: Update `handleChurned`**

```typescript
async function handleChurned(dimension: Dimension, dateRange: string): Promise<NextResponse> {
  const prevSalesDateWhere = buildPrevPeriodDateWhereClause(dateRange, 'fs');
  if (prevSalesDateWhere === null) {
    const response: ClientesChurnedResponse = { rows: [], available: false };
    return jsonWithCache(response);
  }

  const pool = await getDwhPool();
  const currentSalesDateWhere = buildDateWhereClause(dateRange, 'fs2');

  const churned = await pool.request().query(churnedQuery(dimension, prevSalesDateWhere, currentSalesDateWhere));

  const rows: ClientesChurnedRow[] = churned.recordset.map(r => ({
    name: r.Name,
    lastPurchaseDateKey: Number(r.LastPurchaseDateKey),
    lostRevenue: { bs: Number(r.LostRevenueBs), usd: r.LostRevenueUsd === null ? null : Number(r.LostRevenueUsd) },
  }));

  const response: ClientesChurnedResponse = { rows, available: true };
  return jsonWithCache(response);
}
```

Update the call site in `GET`: `handleChurned(clienteDimension, dateRange, currency)` → `handleChurned(clienteDimension, dateRange)`.

- [ ] **Step 4: Rewrite `customerQuery` and its use in `GET`**

```typescript
function customerQuery(dimension: Dimension, salesDateWhere: string, returnsDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fr2');
  return `
    SELECT
      ${spec.labelExpr} AS Name,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      (SELECT ISNULL(SUM(fr2.NetAmount), 0)
         FROM fact.Fact_Returns fr2
         ${innerJoin}
         WHERE fr2.IsVoided = 0 ${returnsDateWhere} AND ${condition}
      ) AS ReturnsNetBs,
      (SELECT ISNULL(SUM(fr2.NetAmount / NULLIF(COALESCE(fr2.DocumentExchangeRate, r2fx.RateSell), 0)), 0)
         FROM fact.Fact_Returns fr2
         ${innerJoin}
         ${usdConversionJoin('fr2').replace('fx', 'r2fx')}
         WHERE fr2.IsVoided = 0 ${returnsDateWhere} AND ${condition}
      ) AS ReturnsNetUsd
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesNetBs DESC
  `;
}
```

In `GET`'s main branch:

```typescript
const customers = await pool.request().query(customerQuery(clienteDimension, salesDateWhere, returnsDateWhere));

const totalSalesNet = customers.recordset.reduce((sum, r) => sum + Number(r.SalesNetBs), 0);

let cumulativeSalesNet = 0;
const rows: ClientesRow[] = customers.recordset.map(r => {
  const salesNetBs = Number(r.SalesNetBs);
  const salesNetUsd = r.SalesNetUsd === null ? null : Number(r.SalesNetUsd);
  const returnsNetBs = Number(r.ReturnsNetBs);
  const returnsNetUsd = r.ReturnsNetUsd === null ? null : Number(r.ReturnsNetUsd);

  cumulativeSalesNet += salesNetBs;
  const cumulativeShare = totalSalesNet > 0 ? cumulativeSalesNet / totalSalesNet : 0;
  const pareto: ClientesRow['pareto'] =
    cumulativeShare <= PARETO_THRESHOLDS.a ? 'A' : cumulativeShare <= PARETO_THRESHOLDS.b ? 'B' : 'C';

  return {
    name: r.Name,
    salesNet: { bs: salesNetBs, usd: salesNetUsd },
    returnsNet: { bs: returnsNetBs, usd: returnsNetUsd },
    returnRate: salesNetBs > 0 ? returnsNetBs / salesNetBs : null,
    pareto,
  };
});

const response: ClientesResponse = { rows, paretoThresholds: PARETO_THRESHOLDS };
```

Remove `const currency = searchParams.get('currency') ?? 'bs';` and every `getUsdRate()` call remaining in this file (note: `currency` was also threaded into `useClientesChurned` — that's client-side, handled in Task 12).

- [ ] **Step 5: Update `types.ts`**

```typescript
export interface ClientesRow {
  name: string;
  salesNet: DualAmount;
  returnsNet: DualAmount;
  returnRate: number | null;
  pareto: 'A' | 'B' | 'C';
}

export interface ClientesResponse {
  rows: ClientesRow[];
  paretoThresholds: { a: number; b: number };
}

export interface ClientesChurnedRow {
  name: string;
  lastPurchaseDateKey: number;
  lostRevenue: DualAmount;
}

export interface ClientesChurnedResponse {
  rows: ClientesChurnedRow[];
  available: boolean;
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `bun test app/api/dwh/clientes/__tests__/route.test.ts && bunx tsc --noEmit`
Expected: PASS; no new errors in `clientes/route.ts` or touched types.

- [ ] **Step 7: Commit**

```bash
git add app/api/dwh/clientes/route.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
fix: convert clientes route to historical per-row USD conversion

customerQuery and churnedQuery now convert per-row before
aggregating. ClientesTrendResponse (activeCustomers/churnRate only)
is untouched — no money fields there.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `vendedores` route + `VendedoresResponse`/`VendedoresExcludedResponse`

**Files:**
- Modify: `app/api/dwh/vendedores/route.ts`
- Modify: `app/(app)/analitica/types.ts` (`VendedoresRow`, `VendedoresResponse`, `VendedoresExcludedInvoice`, `VendedoresExcludedResponse`)
- Test: `app/api/dwh/vendedores/__tests__/route.test.ts` (extend existing)

**Interfaces:**
- Consumes: `usdConversionJoin`, `dualAmountExpr`, `DualAmount` from Task 1.

**Design notes:**

`salesRepQuery` has the most money columns of any query in this plan (`SalesNet`, `ExcludedSalesNet`, `ReturnsNet`, `Collected`, `ExcludedCollected` — each needs a BS/USD pair). `consignmentFlagsQuery` (`SalesOnRoot`/`TotalSales`) feeds `isConsignmentPattern`'s ratio threshold check only — stays plain BS (a ratio of same-currency figures is threshold-invariant regardless of which currency both sides use, so no behavior changes by leaving these BS-only). `excludedInvoicesQuery`'s `NetAmount` becomes `DualAmount`.

- [ ] **Step 1: No new test needed** — extend nothing beyond the existing 401 smoke test; verify via `tsc` and manual read-through, per this plan's established pattern for un-live-testable aggregation math.

- [ ] **Step 2: Rewrite `salesRepQuery`**

Each `CASE WHEN ... THEN fs.NetAmount ELSE 0 END` aggregate needs its BS/USD pair — `dualAmountExpr` assumes a bare column reference, not a `CASE` expression, so these are hand-written inline rather than via the helper (documented here as the one deliberate exception to "always call `dualAmountExpr`" in this plan, since the helper's signature doesn't support wrapping an arbitrary expression):

```typescript
function salesRepQuery(salesDateWhere: string, returnsDateWhere: string, collectionsDateWhere: string, flaggedRootCodes: string[]): string {
  const flaggedCase = flaggedRootCodes.length > 0
    ? `CASE WHEN c.CustomerCode IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')}) THEN 1 ELSE 0 END`
    : '0';
  const salesRate = `NULLIF(COALESCE(fs.DocumentExchangeRate, fx.RateSell), 0)`;
  return `
    SELECT
      CAST(fs.SalesRepKey AS varchar(20)) AS SalesRepKeyValue,
      ISNULL(r.SalesRepName, r.SalesRepCode) AS Name,
      SUM(CASE WHEN ${flaggedCase} = 0 THEN fs.NetAmount ELSE 0 END) AS SalesNetBs,
      SUM(CASE WHEN ${flaggedCase} = 0 THEN fs.NetAmount / ${salesRate} ELSE 0 END) AS SalesNetUsd,
      SUM(CASE WHEN ${flaggedCase} = 1 THEN fs.NetAmount ELSE 0 END) AS ExcludedSalesNetBs,
      SUM(CASE WHEN ${flaggedCase} = 1 THEN fs.NetAmount / ${salesRate} ELSE 0 END) AS ExcludedSalesNetUsd,
      COUNT(DISTINCT CASE WHEN ${flaggedCase} = 1 THEN fs.InvoiceNumber END) AS ExcludedInvoiceCount,
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         JOIN dim.Dim_Customer rc ON rc.CustomerKey = fr.CustomerKey
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `rc.CustomerCode NOT IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 1'}
      ) AS ReturnsNetBs,
      (SELECT ISNULL(SUM(fr.NetAmount / NULLIF(COALESCE(fr.DocumentExchangeRate, rfx.RateSell), 0)), 0)
         FROM fact.Fact_Returns fr
         ${usdConversionJoin('fr').replace('fx', 'rfx')}
         JOIN dim.Dim_Customer rc ON rc.CustomerKey = fr.CustomerKey
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `rc.CustomerCode NOT IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 1'}
      ) AS ReturnsNetUsd,
      (SELECT ISNULL(SUM(fc.AmountCollected), 0)
         FROM fact.Fact_Collections fc
         JOIN dim.Dim_Customer cc ON cc.CustomerKey = fc.CustomerKey
         WHERE fc.SalesRepKey = fs.SalesRepKey AND fc.IsVoided = 0 ${collectionsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `cc.CustomerCode NOT IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 1'}
      ) AS CollectedBs,
      (SELECT ISNULL(SUM(fc.AmountCollected / NULLIF(COALESCE(fc.DocumentExchangeRate, cfx.RateSell), 0)), 0)
         FROM fact.Fact_Collections fc
         ${usdConversionJoin('fc').replace('fx', 'cfx')}
         JOIN dim.Dim_Customer cc ON cc.CustomerKey = fc.CustomerKey
         WHERE fc.SalesRepKey = fs.SalesRepKey AND fc.IsVoided = 0 ${collectionsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `cc.CustomerCode NOT IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 1'}
      ) AS CollectedUsd,
      (SELECT ISNULL(SUM(fc.AmountCollected), 0)
         FROM fact.Fact_Collections fc
         JOIN dim.Dim_Customer cc ON cc.CustomerKey = fc.CustomerKey
         WHERE fc.SalesRepKey = fs.SalesRepKey AND fc.IsVoided = 0 ${collectionsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `cc.CustomerCode IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 0'}
      ) AS ExcludedCollectedBs,
      (SELECT ISNULL(SUM(fc.AmountCollected / NULLIF(COALESCE(fc.DocumentExchangeRate, ecfx.RateSell), 0)), 0)
         FROM fact.Fact_Collections fc
         ${usdConversionJoin('fc').replace('fx', 'ecfx')}
         JOIN dim.Dim_Customer cc ON cc.CustomerKey = fc.CustomerKey
         WHERE fc.SalesRepKey = fs.SalesRepKey AND fc.IsVoided = 0 ${collectionsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `cc.CustomerCode IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 0'}
      ) AS ExcludedCollectedUsd
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
    ORDER BY SalesNetBs DESC
  `;
}
```

- [ ] **Step 3: Rewrite `excludedInvoicesQuery`**

```typescript
function excludedInvoicesQuery(salesDateWhere: string, flaggedRootCodes: string[]): string {
  return `
    SELECT c.CustomerName AS LegalEntityName, fs.InvoiceNumber, d.FullDate AS SalesDate, ${dualAmountExpr('fs', 'NetAmount', 'NetAmountBs', 'NetAmountUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${salesDateWhere}
      AND c.CustomerCode IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})
    GROUP BY c.CustomerName, fs.InvoiceNumber, d.FullDate
    ORDER BY d.FullDate DESC
  `;
}
```

- [ ] **Step 4: Update `GET`'s response assembly**

```typescript
if (searchParams.get('section') === 'excluded' && parentValue && /^\d+$/.test(parentValue)) {
  if (flaggedRootCodes.length === 0) {
    const response: VendedoresExcludedResponse = { invoices: [] };
    return jsonWithCache(response);
  }
  const req = pool.request().input('salesRepKey', Number(parentValue));
  flaggedRootCodes.forEach((code, i) => req.input(`flaggedRoot${i}`, code));
  const result = await req.query(excludedInvoicesQuery(salesDateWhere, flaggedRootCodes));
  const invoices: VendedoresExcludedInvoice[] = result.recordset.map(r => ({
    legalEntityName: String(r.LegalEntityName),
    invoiceNumber: String(r.InvoiceNumber),
    invoiceDate: new Date(r.SalesDate).toISOString().slice(0, 10),
    amountNet: { bs: Number(r.NetAmountBs), usd: r.NetAmountUsd === null ? null : Number(r.NetAmountUsd) },
  }));
  const response: VendedoresExcludedResponse = { invoices };
  return jsonWithCache(response);
}

const salesReq = pool.request();
flaggedRootCodes.forEach((code, i) => salesReq.input(`flaggedRoot${i}`, code));

const salesReps = await salesReq.query(salesRepQuery(salesDateWhere, returnsDateWhere, collectionsDateWhere, flaggedRootCodes));

const rows: VendedoresRow[] = salesReps.recordset.map(r => {
  const salesNetBs = Number(r.SalesNetBs);
  const salesNetUsd = r.SalesNetUsd === null ? null : Number(r.SalesNetUsd);
  const returnsNetBs = Number(r.ReturnsNetBs);
  const returnsNetUsd = r.ReturnsNetUsd === null ? null : Number(r.ReturnsNetUsd);
  const grossAmount = Number(r.GrossAmount);
  const discountAmount = Number(r.DiscountAmount);
  const collectedBs = Number(r.CollectedBs);
  const collectedUsd = r.CollectedUsd === null ? null : Number(r.CollectedUsd);

  return {
    value: String(r.SalesRepKeyValue),
    name: r.Name,
    salesNet: { bs: salesNetBs, usd: salesNetUsd },
    returnsNet: { bs: returnsNetBs, usd: returnsNetUsd },
    returnRate: salesNetBs > 0 ? returnsNetBs / salesNetBs : null,
    collectionRate: salesNetBs > 0 ? collectedBs / salesNetBs : null,
    avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
    excludedSalesNet: { bs: Number(r.ExcludedSalesNetBs), usd: r.ExcludedSalesNetUsd === null ? null : Number(r.ExcludedSalesNetUsd) },
    excludedCollected: { bs: Number(r.ExcludedCollectedBs), usd: r.ExcludedCollectedUsd === null ? null : Number(r.ExcludedCollectedUsd) },
    excludedInvoiceCount: Number(r.ExcludedInvoiceCount),
  };
});

const response: VendedoresResponse = { rows };
```

Remove `const currency = searchParams.get('currency') ?? 'bs';` and the `currency === 'usd' ? getUsdRate() : Promise.resolve(null)` entry from the `Promise.all` (adjust destructuring from `const [salesReps, usdRate] = ...` to just `const salesReps = await salesReq.query(...)`, no longer a `Promise.all` pair).

- [ ] **Step 5: Update `types.ts`**

```typescript
export interface VendedoresRow {
  value: string;
  name: string;
  salesNet: DualAmount;
  returnsNet: DualAmount;
  returnRate: number | null;
  collectionRate: number | null;
  avgDiscount: number | null;
  excludedSalesNet: DualAmount;
  excludedCollected: DualAmount;
  excludedInvoiceCount: number;
}

export interface VendedoresResponse {
  rows: VendedoresRow[];
}

export interface VendedoresExcludedInvoice {
  legalEntityName: string;
  invoiceNumber: string;
  invoiceDate: string;
  amountNet: DualAmount;
}

export interface VendedoresExcludedResponse {
  invoices: VendedoresExcludedInvoice[];
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `bun test app/api/dwh/vendedores/__tests__/route.test.ts && bunx tsc --noEmit`
Expected: PASS; no new errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/dwh/vendedores/route.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
fix: convert vendedores route to historical per-row USD conversion

salesRepQuery's five money aggregates (sales, excluded sales,
returns, collected, excluded collected) and excludedInvoicesQuery
now convert per-row. consignmentFlagsQuery's SalesOnRoot/TotalSales
stay plain BS — they only feed a same-currency threshold ratio.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `devoluciones` route + `DevolucionesResponse`

**Files:**
- Modify: `app/api/dwh/devoluciones/route.ts`
- Modify: `app/(app)/analitica/types.ts` (`DevolucionesMatrixCell`, `DevolucionesResponse`)
- Test: `app/api/dwh/devoluciones/__tests__/route.test.ts` (extend existing)

**Interfaces:**
- Consumes: `usdConversionJoin`, `dualAmountExpr`, `DualAmount` from Task 1.

**Design notes:**

`ratioDevolucion` (returns/sales ratio) stays a plain number — computed from same-currency BS figures, ratio-invariant. `amountNet` (the returns amount actually displayed) becomes `DualAmount`.

- [ ] **Step 1: No new test needed** — existing 401 smoke test covers this; verify via `tsc`.

- [ ] **Step 2: Rewrite `salesRepMatrixQuery`, `productoMatrixQuery`, `clienteMatrixQuery`**

```typescript
function salesRepMatrixQuery(returnsDateWhere: string, salesDateWhere: string): string {
  return `
    SELECT TOP 50
      ISNULL(r.SalesRepName, ISNULL(r.SalesRepCode, 'Sin vendedor')) AS GroupName,
      ${dualAmountExpr('fr', 'NetAmount', 'ReturnsNetBs', 'ReturnsNetUsd')},
      (SELECT ISNULL(SUM(fs.NetAmount), 0)
         FROM fact.Fact_Sales fs
         WHERE fs.SalesRepKey = fr.SalesRepKey AND fs.IsVoided = 0 ${salesDateWhere}) AS SalesNetBs
    FROM fact.Fact_Returns fr
    ${usdConversionJoin('fr')}
    LEFT JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fr.SalesRepKey
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY fr.SalesRepKey, ISNULL(r.SalesRepName, ISNULL(r.SalesRepCode, 'Sin vendedor'))
    ORDER BY ReturnsNetBs DESC
  `;
}

function productoMatrixQuery(returnsDateWhere: string, salesDateWhere: string): string {
  return `
    SELECT TOP 50
      ISNULL(p.ProductName, p.ProductCode) AS GroupName,
      ${dualAmountExpr('fr', 'NetAmount', 'ReturnsNetBs', 'ReturnsNetUsd')},
      (SELECT ISNULL(SUM(fs.NetAmount), 0)
         FROM fact.Fact_Sales fs
         WHERE fs.ProductKey = fr.ProductKey AND fs.IsVoided = 0 ${salesDateWhere}) AS SalesNetBs
    FROM fact.Fact_Returns fr
    ${usdConversionJoin('fr')}
    JOIN dim.Dim_Product p ON p.ProductKey = fr.ProductKey
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY fr.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY ReturnsNetBs DESC
  `;
}

function clienteMatrixQuery(dimension: Dimension, returnsDateWhere: string, salesDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fr', 'fs2');
  return `
    SELECT TOP 50
      ${spec.valueExpr} AS GroupValue,
      ${spec.labelExpr} AS GroupName,
      ${dualAmountExpr('fr', 'NetAmount', 'ReturnsNetBs', 'ReturnsNetUsd')},
      (SELECT ISNULL(SUM(fs2.NetAmount), 0)
         FROM fact.Fact_Sales fs2
         ${innerJoin}
         WHERE fs2.IsVoided = 0 ${salesDateWhere} AND ${condition}
      ) AS SalesNetBs
    FROM fact.Fact_Returns fr
    ${usdConversionJoin('fr')}
    ${spec.joinClause.replace(/\bf\b/g, 'fr')}
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY ReturnsNetBs DESC
  `;
}
```

- [ ] **Step 3: Update `toMatrixCell`**

```typescript
function toMatrixCell(
  groupBy: DevolucionesGroupBy,
  row: { GroupName: string; GroupValue?: unknown; ReturnsNetBs: unknown; ReturnsNetUsd: unknown; SalesNetBs: unknown }
): DevolucionesMatrixCell {
  const returnsNetBs = Number(row.ReturnsNetBs);
  const returnsNetUsd = row.ReturnsNetUsd === null ? null : Number(row.ReturnsNetUsd);
  const salesNetBs = Number(row.SalesNetBs);
  const ratioDevolucion = salesNetBs > 0 ? returnsNetBs / salesNetBs : null;
  const placeholder = 'Todos';

  return {
    salesRep: groupBy === 'salesrep' ? row.GroupName : placeholder,
    producto: groupBy === 'producto' ? row.GroupName : placeholder,
    cliente: groupBy === 'cliente' ? row.GroupName : placeholder,
    clienteValue: groupBy === 'cliente' && row.GroupValue != null ? String(row.GroupValue) : null,
    ratioDevolucion,
    amountNet: { bs: returnsNetBs, usd: returnsNetUsd },
  };
}
```

- [ ] **Step 4: Update `GET`'s breakdown branch and main response**

```typescript
if (breakdownBy && parentValue) {
  const breakdownSpec = getDimensionSpec(breakdownBy);
  const parentSpec = getDimensionSpec(clienteDimension);
  const req = pool.request();
  req.input('parentValue', parentValue);
  const result = await req.query(`
    SELECT TOP 15 ${breakdownSpec.valueExpr} AS GroupValue, ${breakdownSpec.labelExpr} AS GroupLabel, SUM(fr.NetAmount) AS ReturnsNet
    FROM fact.Fact_Returns fr
    ${breakdownSpec.joinClause.replace(/\bf\b/g, 'fr')}
    ${parentSpec.joinClause.replace(/\bf\b/g, 'fr')}
    WHERE fr.IsVoided = 0 AND ${parentSpec.valueExpr.replace(/\bf\b/g, 'fr')} = @parentValue ${returnsDateWhere}
    GROUP BY ${breakdownSpec.groupByColumn}
    ORDER BY ReturnsNet DESC
  `);
  return jsonWithCache({
    breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), returnsNet: Number(r.ReturnsNet) })),
  });
}

const matrix = await pool.request().query(matrixQuery(groupBy, clienteDimension, returnsDateWhere, salesDateWhere));

const rows: DevolucionesMatrixCell[] = matrix.recordset.map(r => toMatrixCell(groupBy, r));

const response: DevolucionesResponse = {
  rows,
  groupBy: groupBy as GroupBy,
  breadcrumb: [{ label: GROUP_LABELS[groupBy], groupBy }],
};
```

(The ad-hoc breakdown query — same `BreakdownRow`-typed generic shape as Task 4's Step 7 — keeps `returnsNet` as a plain BS number, per that same established non-goal.) Remove `const currency = searchParams.get('currency') ?? 'bs';` and the `getUsdRate()` call/`Promise.all` pairing.

- [ ] **Step 5: Update `types.ts`**

```typescript
export interface DevolucionesMatrixCell {
  salesRep: string;
  producto: string;
  cliente: string;
  clienteValue: string | null;
  ratioDevolucion: number | null;
  amountNet: DualAmount;
}

export interface DevolucionesResponse {
  rows: DevolucionesMatrixCell[];
  groupBy: GroupBy;
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `bun test app/api/dwh/devoluciones/__tests__/route.test.ts && bunx tsc --noEmit`
Expected: PASS; no new errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/dwh/devoluciones/route.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
fix: convert devoluciones route to historical per-row USD conversion

salesRepMatrixQuery/productoMatrixQuery/clienteMatrixQuery now
convert returns per-row before aggregating. ratioDevolucion stays a
plain ratio (both sides already same-currency BS).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `compras` route + `ComprasResponse`

**Files:**
- Modify: `app/api/dwh/compras/route.ts`
- Modify: `app/(app)/analitica/types.ts` (`ComprasRow`, `ComprasResponse`)
- Test: `app/api/dwh/compras/__tests__/route.test.ts` (new file — none exists today)

**Interfaces:**
- Consumes: `usdConversionJoin`, `dualAmountExpr`, `DualAmount` from Task 1.

**Design notes:**

Structurally mirrors `ventas/route.ts` (per this file's own header comment) but against `fact.Fact_Purchases` (date column `DateKey`, same as `Fact_Sales`) instead — no returns concept, so simpler: no correlated returns subqueries anywhere.

- [ ] **Step 1: Create the test file**

```typescript
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/compras', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/compras');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test app/api/dwh/compras/__tests__/route.test.ts`
Expected: PASS immediately (auth check unchanged) — baseline before the rewrite.

- [ ] **Step 3: Rewrite `monthlyQuery`, `proveedorQuery`, `lineaQuery`, `lineaProductBreakdownQuery`**

```typescript
function monthlyQuery(dateWhere: string): string {
  return `
    SELECT
      d.YearMonth AS GroupValue,
      d.YearMonth AS GroupLabel,
      ${dualAmountExpr('fp', 'NetAmount', 'PurchasesNetBs', 'PurchasesNetUsd')},
      SUM(fp.GrossAmount) AS GrossAmount,
      SUM(fp.DiscountAmount) AS DiscountAmount
    FROM fact.Fact_Purchases fp
    ${usdConversionJoin('fp')}
    JOIN dim.Dim_Date d ON d.DateKey = fp.DateKey
    WHERE fp.IsVoided = 0 ${dateWhere}
    GROUP BY d.YearMonth
    ORDER BY d.YearMonth
  `;
}

function proveedorQuery(dateWhere: string, monthFilter: string): string {
  const spec = getDimensionSpec('proveedor');
  return `
    SELECT TOP 15
      ${spec.valueExpr} AS GroupValue,
      ${spec.labelExpr} AS GroupLabel,
      ${dualAmountExpr('fp', 'NetAmount', 'PurchasesNetBs', 'PurchasesNetUsd')},
      SUM(fp.GrossAmount) AS GrossAmount,
      SUM(fp.DiscountAmount) AS DiscountAmount
    FROM fact.Fact_Purchases fp
    ${usdConversionJoin('fp')}
    ${spec.joinClause.replace(/\bf\b/g, 'fp')}
    JOIN dim.Dim_Date d ON d.DateKey = fp.DateKey
    WHERE fp.IsVoided = 0 ${dateWhere} ${monthFilter}
    GROUP BY ${spec.groupByColumn}
    ORDER BY PurchasesNetBs DESC
  `;
}

function lineaQuery(dateWhere: string): string {
  return `
    SELECT TOP 15
      ISNULL(p.LineCode, 'SIN_LINEA') AS GroupValue,
      ISNULL(p.LineName, 'Sin línea') AS GroupLabel,
      ${dualAmountExpr('fp', 'NetAmount', 'PurchasesNetBs', 'PurchasesNetUsd')},
      SUM(fp.GrossAmount) AS GrossAmount,
      SUM(fp.DiscountAmount) AS DiscountAmount
    FROM fact.Fact_Purchases fp
    ${usdConversionJoin('fp')}
    JOIN dim.Dim_Product p ON p.ProductKey = fp.ProductKey
    WHERE fp.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.LineCode, 'SIN_LINEA'), ISNULL(p.LineName, 'Sin línea')
    ORDER BY PurchasesNetBs DESC
  `;
}

function lineaProductBreakdownQuery(purchasesDateWhere: string): string {
  return `
    SELECT TOP 15
      CAST(p.ProductKey AS varchar(20)) AS GroupValue,
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      ${dualAmountExpr('fp', 'NetAmount', 'PurchasesNetBs', 'PurchasesNetUsd')}
    FROM fact.Fact_Purchases fp
    ${usdConversionJoin('fp')}
    JOIN dim.Dim_Product p ON p.ProductKey = fp.ProductKey
    WHERE fp.IsVoided = 0 AND ISNULL(p.LineCode, 'SIN_LINEA') = @parentValue ${purchasesDateWhere}
    GROUP BY p.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY PurchasesNetBs DESC
  `;
}
```

- [ ] **Step 4: Update `GET`'s two breakdown branches and main response**

The línea→producto sentinel breakdown (`groupByParam === 'linea'`) and the generic proveedor-parent breakdown both currently map `purchasesNet: Number(r.PurchasesNet)` into a `BreakdownRow` — same established non-goal as Task 4/8 (plain BS for ad-hoc breakdown rows), just rename the column read to `r.PurchasesNetBs`:

```typescript
if (breakdownBy && parentValue && groupByParam === 'linea') {
  const req = pool.request();
  req.input('parentValue', parentValue);
  const result = await req.query(lineaProductBreakdownQuery(purchasesDateWhere));
  return jsonWithCache({ breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), purchasesNet: Number(r.PurchasesNetBs) })) });
}

if (breakdownBy && parentValue && isDimensionForFact(breakdownBy, 'purchases')) {
  const breakdownSpec = getDimensionSpec(breakdownBy);
  const parentSpec = getDimensionSpec('proveedor');
  const req = pool.request();
  req.input('parentValue', parentValue);
  const result = await req.query(`
    SELECT TOP 15 ${breakdownSpec.valueExpr} AS GroupValue, ${breakdownSpec.labelExpr} AS GroupLabel, SUM(fp.NetAmount) AS PurchasesNet
    FROM fact.Fact_Purchases fp
    ${breakdownSpec.joinClause.replace(/\bf\b/g, 'fp')}
    ${parentSpec.joinClause.replace(/\bf\b/g, 'fp')}
    WHERE fp.IsVoided = 0 AND ${parentSpec.valueExpr.replace(/\bf\b/g, 'fp')} = @parentValue ${purchasesDateWhere}
    GROUP BY ${breakdownSpec.groupByColumn}
    ORDER BY PurchasesNet DESC
  `);
  return jsonWithCache({ breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), purchasesNet: Number(r.PurchasesNet) })) });
}
```

(This second breakdown query is left as a bare `SUM(fp.NetAmount)` — it's already the `BreakdownRow` non-goal path, not the main response, so no `dualAmountExpr` needed here either; only its column name stays `PurchasesNet` since it was never renamed.)

Main response:

```typescript
const rows: ComprasRow[] = recordset.map(r => {
  const purchasesNetBs = Number(r.PurchasesNetBs);
  const purchasesNetUsd = r.PurchasesNetUsd === null ? null : Number(r.PurchasesNetUsd);
  const grossAmount = Number(r.GrossAmount);
  const discountAmount = Number(r.DiscountAmount);
  const label = groupBy === 'mes' ? formatYearMonth(String(r.GroupLabel)) : String(r.GroupLabel);
  return {
    label,
    value: String(r.GroupValue),
    purchasesNet: { bs: purchasesNetBs, usd: purchasesNetUsd },
    avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
  };
});

const response: ComprasResponse = { rows, groupBy, breadcrumb };
```

Remove `const currency = searchParams.get('currency') ?? 'bs';` and the `getUsdRate()` call.

- [ ] **Step 5: Update `types.ts`**

```typescript
export interface ComprasRow {
  label: string;
  value: string;
  purchasesNet: DualAmount;
  avgDiscount: number | null;
}

export interface ComprasResponse {
  rows: ComprasRow[];
  groupBy: GroupBy;
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `bun test app/api/dwh/compras/__tests__/route.test.ts && bunx tsc --noEmit`
Expected: PASS; no new errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/dwh/compras/route.ts app/api/dwh/compras/__tests__/route.test.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
fix: convert compras route to historical per-row USD conversion

monthlyQuery/proveedorQuery/lineaQuery/lineaProductBreakdownQuery
now convert per-row before aggregating, mirroring ventas' treatment
against Fact_Purchases instead of Fact_Sales.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `cxc` route + `CxcResponse`/`DebtConcentrationResponse`

**Files:**
- Modify: `app/api/dwh/cxc/route.ts`
- Modify: `app/(app)/analitica/types.ts` (`WeekdayVencimientoRow`, `DebtConcentrationRow`, `DebtConcentrationResponse`, `CxcResponse`; `AgingBucketRow`/`DebtorRow` already converted in Task 2)
- Test: `app/api/dwh/cxc/__tests__/route.test.ts` (extend existing)

**Interfaces:**
- Consumes: `usdConversionJoin`, `dualAmountExpr`, `DualAmount` from Task 1; `AgingBucketRow`/`DebtorRow` (already `DualAmount`-shaped from Task 2).

**Design notes:**

`AGING_BUCKETS_QUERY` and `topDebtorsQuery` here duplicate `resumen/route.ts`'s own copies almost exactly (both against `Fact_AR_Snapshot`, date column `SnapshotDateKey`) — apply the identical `dualAmountExpr`/`usdConversionJoin` treatment Task 2 already applied there. `WEEKDAY_VENCIMIENTO_QUERY` sums `fc.AmountCollected` from `Fact_Collections` into 3 CASE-bucketed columns — same hand-written-CASE pattern as Task 7's `salesRepQuery` (the `dualAmountExpr` helper doesn't wrap arbitrary `CASE` expressions). `dsoForSnapshotQuery`'s `Balance`/`NetSales` only feed a ratio (`DSO = Balance/NetSales * 90`) — **stays plain BS**, since DSO is a day-count metric, not a money amount, and the ratio is currency-invariant as long as both sides use the same currency consistently (documented explicitly, per the spec-writing fork's own flagged design note).

- [ ] **Step 1: No new test needed** — existing 401 tests (both branches) already cover auth; verify via `tsc`.

- [ ] **Step 2: Rewrite `AGING_BUCKETS_QUERY` and `topDebtorsQuery`**

```typescript
const AGING_BUCKETS_QUERY = `
  SELECT AgingBucket, ${dualAmountExpr('a', 'OutstandingBalance', 'AmountBs', 'AmountUsd')}
  FROM fact.Fact_AR_Snapshot a
  ${usdConversionJoin('a', 'SnapshotDateKey')}
  WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
  GROUP BY AgingBucket
`;

function topDebtorsQuery(dimension: Dimension): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('a', 'fc2');
  return `
    SELECT TOP 10
      ${spec.labelExpr} AS Name,
      ${dualAmountExpr('a', 'OutstandingBalance', 'OutstandingBs', 'OutstandingUsd')},
      (
        SELECT AVG(CAST(fc2.DateKey - fc2.DueDateKey AS float))
        FROM fact.Fact_Collections fc2
        ${innerJoin}
        WHERE fc2.IsVoided = 0 AND fc2.DueDateKey IS NOT NULL AND ${condition}
      ) AS AvgDaysToPay
    FROM fact.Fact_AR_Snapshot a
    ${usdConversionJoin('a', 'SnapshotDateKey')}
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
    GROUP BY ${spec.groupByColumn}
    HAVING SUM(a.OutstandingBalance) > 0
    ORDER BY OutstandingBs DESC
  `;
}
```

- [ ] **Step 3: Rewrite `debtConcentrationQuery`**

```typescript
function debtConcentrationQuery(dimension: Dimension): string {
  const spec = getDimensionSpec(dimension);
  return `
    SELECT TOP 15 ${spec.labelExpr} AS Name, a.AgingBucket, ${dualAmountExpr('a', 'OutstandingBalance', 'AmountBs', 'AmountUsd')}
    FROM fact.Fact_AR_Snapshot a
    ${usdConversionJoin('a', 'SnapshotDateKey')}
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
      AND ${spec.groupByColumn.split(',')[0].trim()} IN (
        SELECT TOP 15 ${spec.groupByColumn.split(',')[0].trim()}
        FROM fact.Fact_AR_Snapshot a2
        ${spec.joinClause.replace(/\bf\b/g, 'a2')}
        WHERE a2.SnapshotDateKey = @snapshotDateKey AND a2.IsCreditNote = 0
        GROUP BY ${spec.groupByColumn}
        ORDER BY SUM(a2.OutstandingBalance) DESC
      )
    GROUP BY ${spec.groupByColumn}, a.AgingBucket
    ORDER BY ${spec.groupByColumn.split(',')[0].trim()}
  `;
}
```

- [ ] **Step 4: Update `handleDebtConcentration`**

```typescript
async function handleDebtConcentration(snapshotDateKey: number, clienteDimension: Dimension): Promise<NextResponse> {
  const pool = await getDwhPool();
  const result = await pool.request().input('snapshotDateKey', snapshotDateKey).query(debtConcentrationQuery(clienteDimension));

  const byName = new Map<string, DebtConcentrationRow>();
  for (const r of result.recordset as { Name: string; AgingBucket: string; AmountBs: number; AmountUsd: number | null }[]) {
    let entry = byName.get(r.Name);
    if (!entry) {
      entry = { name: r.Name, buckets: [] };
      byName.set(r.Name, entry);
    }
    entry.buckets.push({ bucket: r.AgingBucket, amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) } });
  }

  const response: DebtConcentrationResponse = { rows: Array.from(byName.values()) };
  return jsonWithCache(response);
}
```

- [ ] **Step 5: Rewrite `WEEKDAY_VENCIMIENTO_QUERY`**

```typescript
const WEEKDAY_VENCIMIENTO_QUERY = `
  SELECT
    dd.DayOfWeek,
    dd.DayName,
    SUM(CASE WHEN fc.DateKey = fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS VenceHoyBs,
    SUM(CASE WHEN fc.DateKey = fc.DueDateKey THEN fc.AmountCollected / NULLIF(COALESCE(fc.DocumentExchangeRate, fx.RateSell), 0) ELSE 0 END) AS VenceHoyUsd,
    SUM(CASE WHEN fc.DateKey > fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS VencidaBs,
    SUM(CASE WHEN fc.DateKey > fc.DueDateKey THEN fc.AmountCollected / NULLIF(COALESCE(fc.DocumentExchangeRate, fx.RateSell), 0) ELSE 0 END) AS VencidaUsd,
    SUM(CASE WHEN fc.DateKey < fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS NoVencidaBs,
    SUM(CASE WHEN fc.DateKey < fc.DueDateKey THEN fc.AmountCollected / NULLIF(COALESCE(fc.DocumentExchangeRate, fx.RateSell), 0) ELSE 0 END) AS NoVencidaUsd
  FROM fact.Fact_Collections fc
  ${usdConversionJoin('fc')}
  JOIN dim.Dim_Date dd ON dd.DateKey = fc.DateKey
  WHERE fc.IsVoided = 0 AND fc.DueDateKey IS NOT NULL
  GROUP BY dd.DayOfWeek, dd.DayName
  ORDER BY dd.DayOfWeek
`;
```

- [ ] **Step 6: Update the main `GET` handler's mapping and `dsoForSnapshotQuery`/`DSO_TREND_QUERY`/`AGING_TREND_QUERY` handling**

`dsoForSnapshotQuery` and `DSO_TREND_QUERY`/`AGING_TREND_QUERY` are unchanged verbatim — no `dualAmountExpr` (DSO ratio stays plain BS per the design note above; `AGING_TREND_QUERY`'s `Amount` needs the same `DualAmount` treatment as `AGING_BUCKETS_QUERY` though, since it feeds `AgingTrendRow.buckets`, which reuses `AgingBucketRow`):

```typescript
const AGING_TREND_QUERY = `
  SELECT a.SnapshotDateKey, a.AgingBucket, ${dualAmountExpr('a', 'OutstandingBalance', 'AmountBs', 'AmountUsd')}
  FROM fact.Fact_AR_Snapshot a
  ${usdConversionJoin('a', 'SnapshotDateKey')}
  WHERE a.IsCreditNote = 0
  GROUP BY a.SnapshotDateKey, a.AgingBucket
  ORDER BY a.SnapshotDateKey
`;
```

Update `GET`:

```typescript
export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const clienteDimensionParam = searchParams.get('clienteDimension');
  const clienteDimension: Dimension = isClienteDimension(clienteDimensionParam) ? clienteDimensionParam : 'cliente_entidad';

  try {
    const pool = await getDwhPool();

    const latestSnapshot = await pool.request().query(LATEST_SNAPSHOT_QUERY);
    const snapshotDateKey: number | null = latestSnapshot.recordset[0]?.SnapshotDateKey ?? null;

    const section = searchParams.get('section');
    if (section === 'debtConcentration') {
      if (snapshotDateKey === null) {
        return jsonWithCache({ rows: [] } satisfies DebtConcentrationResponse);
      }
      return await handleDebtConcentration(snapshotDateKey, clienteDimension);
    }

    let agingBuckets: { AgingBucket: string; AmountBs: number; AmountUsd: number | null }[] = [];
    let topDebtors: { Name: string; OutstandingBs: number; OutstandingUsd: number | null; AvgDaysToPay: number | null }[] = [];
    let weekdayRows: { DayOfWeek: number; DayName: string; VenceHoyBs: number; VenceHoyUsd: number | null; VencidaBs: number; VencidaUsd: number | null; NoVencidaBs: number; NoVencidaUsd: number | null }[] = [];
    let agingTrendRows: { SnapshotDateKey: number; AgingBucket: string; AmountBs: number; AmountUsd: number | null }[] = [];
    let dsoMonths: { YearMonth: string; MonthEndSnapshotDateKey: number }[] = [];

    const [weekdayResult, agingTrendResult] = await Promise.all([
      pool.request().query(WEEKDAY_VENCIMIENTO_QUERY),
      pool.request().query(AGING_TREND_QUERY),
    ]);
    weekdayRows = weekdayResult.recordset;
    agingTrendRows = agingTrendResult.recordset;

    if (snapshotDateKey !== null) {
      const [aging, debtors, dsoMonthsResult] = await Promise.all([
        pool.request().input('snapshotDateKey', snapshotDateKey).query(AGING_BUCKETS_QUERY),
        pool.request().input('snapshotDateKey', snapshotDateKey).query(topDebtorsQuery(clienteDimension)),
        pool.request().query(DSO_TREND_QUERY),
      ]);
      agingBuckets = aging.recordset;
      topDebtors = debtors.recordset;
      dsoMonths = dsoMonthsResult.recordset;
    }

    const dsoTrend: DsoTrendRow[] = await Promise.all(
      dsoMonths.map(async m => {
        const req = pool.request();
        req.input('snapshotDateKey', m.MonthEndSnapshotDateKey);
        const result = await req.query(dsoForSnapshotQuery());
        const recordsets = result.recordsets as unknown as { Balance: number; NetSales: number }[][];
        const row = recordsets[recordsets.length - 1][0] as { Balance: number; NetSales: number } | undefined;
        const balance = Number(row?.Balance ?? 0);
        const netSales = Number(row?.NetSales ?? 0);
        return { yearMonth: m.YearMonth, dso: netSales > 0 ? (balance / netSales) * 90 : null };
      })
    );

    const agingBucketsMapped: AgingBucketRow[] = agingBuckets.map(r => ({
      bucket: r.AgingBucket,
      amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) },
    }));

    const weekdayVencimiento: WeekdayVencimientoRow[] = weekdayRows.map(r => ({
      weekday: WEEKDAY_ES_LABELS[r.DayName] ?? r.DayName,
      venceHoy: { bs: Number(r.VenceHoyBs), usd: r.VenceHoyUsd === null ? null : Number(r.VenceHoyUsd) },
      vencida: { bs: Number(r.VencidaBs), usd: r.VencidaUsd === null ? null : Number(r.VencidaUsd) },
      noVencida: { bs: Number(r.NoVencidaBs), usd: r.NoVencidaUsd === null ? null : Number(r.NoVencidaUsd) },
    }));

    const agingTrendByMonth = new Map<string, AgingBucketRow[]>();
    for (const r of agingTrendRows) {
      const s = String(r.SnapshotDateKey);
      const yearMonth = `${s.slice(0, 4)}-${s.slice(4, 6)}`;
      const existing = agingTrendByMonth.get(yearMonth) ?? [];
      existing.push({ bucket: r.AgingBucket, amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) } });
      agingTrendByMonth.set(yearMonth, existing);
    }
    const agingTrend: AgingTrendRow[] = Array.from(agingTrendByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([yearMonth, buckets]) => ({ yearMonth, buckets }));

    const topDebtorsMapped: DebtorRow[] = topDebtors.map(r => ({
      name: r.Name,
      outstanding: { bs: Number(r.OutstandingBs), usd: r.OutstandingUsd === null ? null : Number(r.OutstandingUsd) },
      avgDaysToPay: r.AvgDaysToPay !== null && r.AvgDaysToPay !== undefined ? Number(r.AvgDaysToPay) : null,
    }));

    const totalOutstanding = agingBucketsMapped.reduce((sum, b) => sum + b.amount.bs, 0);
    const overdueOutstanding = agingBucketsMapped
      .filter(b => b.bucket !== 'Current')
      .reduce((sum, b) => sum + b.amount.bs, 0);
    const overdueShare = totalOutstanding > 0 ? overdueOutstanding / totalOutstanding : null;

    const response: CxcResponse = {
      agingBuckets: agingBucketsMapped,
      topDebtors: topDebtorsMapped,
      overdueShare,
      snapshotDateKey,
      weekdayVencimiento,
      dsoTrend,
      agingTrend,
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```

`overdueShare` now sums `.bs` explicitly (previously summed the bare `number` field) — a same-currency ratio, unaffected by which currency is used as long as both sides match.

Also remove `currency` from this file's import list usage (`getUsdRate` import is dropped) and delete the unused `currency` parameter from `handleDebtConcentration`'s signature (done in Step 4 above) and the `GET` handler (`const currency = searchParams.get('currency') ?? 'bs';` line removed).

- [ ] **Step 7: Update `types.ts`**

```typescript
export interface WeekdayVencimientoRow {
  weekday: string;
  venceHoy: DualAmount;
  vencida: DualAmount;
  noVencida: DualAmount;
}

export interface DsoTrendRow {
  yearMonth: string;
  dso: number | null;
}

export interface AgingTrendRow {
  yearMonth: string;
  buckets: AgingBucketRow[];
}

export interface DebtConcentrationRow {
  name: string;
  buckets: AgingBucketRow[];
}

export interface DebtConcentrationResponse {
  rows: DebtConcentrationRow[];
}

export interface CxcResponse {
  agingBuckets: AgingBucketRow[];
  topDebtors: DebtorRow[];
  overdueShare: number | null;
  snapshotDateKey: number | null;
  weekdayVencimiento: WeekdayVencimientoRow[];
  dsoTrend: DsoTrendRow[];
  agingTrend: AgingTrendRow[];
}
```

(`DsoTrendRow` is listed for completeness — no change from its current shape, since DSO stays a plain ratio.)

- [ ] **Step 8: Run tests and typecheck**

Run: `bun test app/api/dwh/cxc/__tests__/route.test.ts && bunx tsc --noEmit`
Expected: PASS; no new errors.

- [ ] **Step 9: Commit**

```bash
git add app/api/dwh/cxc/route.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
fix: convert cxc route to historical per-row USD conversion

AGING_BUCKETS_QUERY, topDebtorsQuery, debtConcentrationQuery,
WEEKDAY_VENCIMIENTO_QUERY, and AGING_TREND_QUERY now convert per-row.
DSO stays a plain ratio (Balance/NetSales x 90, currency-invariant as
long as both sides use the same currency).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `profundidad-linea` route + `DepthMatrixResponse`/`DepthGapResponse`/`SellerCoverageResponse`

**Files:**
- Modify: `app/api/dwh/profundidad-linea/route.ts`
- Modify: `app/(app)/analitica/types.ts` (`DepthMatrixCell`, `DepthMatrixRow`, `DepthMatrixResponse`, `DepthGapEntity`, `DepthGapResponse`, `SellerCoverageResponse`)
- Test: `app/api/dwh/profundidad-linea/__tests__/route.test.ts` (extend existing)

**Interfaces:**
- Consumes: `usdConversionJoin`, `dualAmountExpr`, `DualAmount` from Task 1.

**Design notes:**

`matrixQuery`/`matrixQueryForSeller` (identical shape, one scoped to a seller) both aggregate `SalesNet` per (label, segment) — becomes `DualAmount`. `gapQuery`'s `TotalSalesNet` (context for the gap list, not a ratio) becomes `DualAmount`. `sellerCoverageQuery`'s counts (`EntitiesServed`/`TieredLinesCovered`) have no money — untouched; `ownPenetration`/`baselinePenetration`/`gapVsBaseline` are ratios, untouched.

- [ ] **Step 1: No new test needed** — existing tests (`route.test.ts`, `seller-coverage.test.ts`, `tier.test.ts`) are unaffected by this fix's logic (`seller-coverage.ts`/`tier.ts` have no money math — confirmed by reading both files in full during planning); verify the route itself via `tsc`.

- [ ] **Step 2: Rewrite `matrixQuery` and `matrixQueryForSeller`**

```typescript
function matrixQuery(groupBy: DepthGroupBy, dateWhere: string, scopeWhere: string): string {
  const labelExpr = labelExprFor(groupBy);
  return `
    SELECT
      ${labelExpr} AS GroupLabel,
      c.SegmentCode AS SegmentCode,
      COUNT(DISTINCT c.LegalEntityKey) AS EntitiesBuying,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND c.SegmentCode IN ('CADENA', 'INDEPENDIENTES') ${dateWhere} ${scopeWhere}
    GROUP BY ${labelExpr}, c.SegmentCode
  `;
}

function matrixQueryForSeller(groupBy: DepthGroupBy, dateWhere: string, scopeWhere: string): string {
  const labelExpr = labelExprFor(groupBy);
  return `
    SELECT
      ${labelExpr} AS GroupLabel,
      c.SegmentCode AS SegmentCode,
      COUNT(DISTINCT c.LegalEntityKey) AS EntitiesBuying,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey AND c.SegmentCode IN ('CADENA', 'INDEPENDIENTES') ${dateWhere} ${scopeWhere}
    GROUP BY ${labelExpr}, c.SegmentCode
  `;
}
```

- [ ] **Step 3: Rewrite `gapQuery`**

```typescript
function gapQuery(dateWhere: string, scopeWhere: string): string {
  return `
    SELECT le.LegalEntityKey, le.LegalEntityName, ${dualAmountExpr('fs', 'NetAmount', 'TotalSalesNetBs', 'TotalSalesNetUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    WHERE fs.IsVoided = 0 AND c.SegmentCode = @segment ${dateWhere}
    GROUP BY le.LegalEntityKey, le.LegalEntityName
    HAVING NOT EXISTS (
      SELECT 1 FROM fact.Fact_Sales fs2
      JOIN dim.Dim_Customer c2 ON c2.CustomerKey = fs2.CustomerKey
      JOIN dim.Dim_Product p2 ON p2.ProductKey = fs2.ProductKey
      WHERE fs2.IsVoided = 0 AND c2.LegalEntityKey = le.LegalEntityKey ${scopeWhere.replace(/\bfs\b/g, 'fs2').replace(/\bp\b/g, 'p2')} ${dateWhere.replace(/\bfs\b/g, 'fs2')}
    )
    ORDER BY TotalSalesNetBs DESC
  `;
}
```

This query's `usdConversionJoin('fs')` join is only referenced by the outer `SELECT`'s `dualAmountExpr` — the `HAVING NOT EXISTS` subquery's `fs2`-aliased rewrite doesn't touch money at all, so it needs no `fx`-alias handling (unlike every correlated-subquery case elsewhere in this plan).

- [ ] **Step 4: Update `handleGap`**

```typescript
async function handleGap(
  dateWhere: string,
  groupBy: DepthGroupBy,
  linea: string | null,
  sublinea: string | null,
  segment: CustomerSegment,
  productLabel: string,
): Promise<NextResponse> {
  const pool = await getDwhPool();
  const req = pool.request().input('segment', segment);

  let scopeWhere = '';
  if (groupBy === 'linea') {
    req.input('lineaScope', productLabel);
    scopeWhere = `AND ISNULL(p.LineName, '${NO_LINEA}') = @lineaScope`;
  } else if (groupBy === 'sublinea') {
    req.input('lineaScope', linea ?? '');
    req.input('sublineaScope', productLabel);
    scopeWhere = `AND ISNULL(p.LineName, '${NO_LINEA}') = @lineaScope AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublineaScope`;
  } else {
    req.input('skuScope', productLabel);
    scopeWhere = `AND ISNULL(p.ProductName, p.ProductCode) = @skuScope`;
  }

  const result = await req.query(gapQuery(dateWhere, scopeWhere));
  const entities: DepthGapEntity[] = result.recordset.map(r => ({
    legalEntityKey: Number(r.LegalEntityKey),
    legalEntityName: String(r.LegalEntityName),
    totalSalesNet: { bs: Number(r.TotalSalesNetBs), usd: r.TotalSalesNetUsd === null ? null : Number(r.TotalSalesNetUsd) },
  }));

  const response: DepthGapResponse = { entities, segment, productLabel };
  return jsonWithCache(response);
}
```

- [ ] **Step 5: Update `handleMatrix`**

```typescript
async function handleMatrix(
  dateWhere: string,
  groupBy: DepthGroupBy,
  linea: string | null,
  sublinea: string | null,
  thresholds: TierThresholds,
  salesRepKey: number | null,
  salesRepName: string | null,
): Promise<NextResponse> {
  const pool = await getDwhPool();

  let scopeWhere = '';
  const scopeReq = pool.request();
  if (salesRepKey !== null) scopeReq.input('salesRepKey', salesRepKey);
  if (groupBy === 'sublinea') {
    scopeReq.input('linea', linea ?? '');
    scopeWhere = `AND ISNULL(p.LineName, '${NO_LINEA}') = @linea`;
  } else if (groupBy === 'sku') {
    scopeReq.input('linea', linea ?? '');
    scopeReq.input('sublinea', sublinea ?? '');
    scopeWhere = `AND ISNULL(p.LineName, '${NO_LINEA}') = @linea AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublinea`;
  }

  const totalsReq = pool.request();
  if (salesRepKey !== null) totalsReq.input('salesRepKey', salesRepKey);

  const [matrixResult, totalsResult] = await Promise.all([
    scopeReq.query(salesRepKey !== null ? matrixQueryForSeller(groupBy, dateWhere, scopeWhere) : matrixQuery(groupBy, dateWhere, scopeWhere)),
    totalsReq.query(salesRepKey !== null ? activeTotalsBySegmentForSellerQuery(dateWhere) : activeTotalsBySegmentQuery(dateWhere, '')),
  ]);

  const totalsBySegment = new Map<string, number>();
  for (const r of totalsResult.recordset) {
    totalsBySegment.set(String(r.SegmentCode), Number(r.TotalEntities));
  }

  const byLabel = new Map<string, DepthMatrixRow>();
  for (const r of matrixResult.recordset) {
    const label = String(r.GroupLabel);
    const segment = String(r.SegmentCode) as CustomerSegment;
    const entitiesBuying = Number(r.EntitiesBuying);
    const salesNetBs = Number(r.SalesNetBs);
    const salesNetUsd = r.SalesNetUsd === null ? null : Number(r.SalesNetUsd);
    const entitiesActive = totalsBySegment.get(segment) ?? 0;

    let row = byLabel.get(label);
    if (!row) {
      row = { label, value: label, cells: [], totalPenetration: null, totalSalesNet: { bs: 0, usd: 0 }, tier: 'sin-ventas' };
      byLabel.set(label, row);
    }
    row.cells.push({
      segment,
      entitiesBuying,
      entitiesActive,
      penetration: entitiesActive > 0 ? entitiesBuying / entitiesActive : null,
      salesNet: { bs: salesNetBs, usd: salesNetUsd },
    });
    row.totalSalesNet = {
      bs: row.totalSalesNet.bs + salesNetBs,
      usd: row.totalSalesNet.usd === null || salesNetUsd === null ? null : row.totalSalesNet.usd + salesNetUsd,
    };
  }

  const totalEntitiesActive = SEGMENTS.reduce((sum, s) => sum + (totalsBySegment.get(s) ?? 0), 0);

  const rows: DepthMatrixRow[] = Array.from(byLabel.values()).map(row => {
    const totalEntitiesBuying = row.cells.reduce((sum, c) => sum + c.entitiesBuying, 0);
    const totalPenetration = totalEntitiesActive > 0 ? totalEntitiesBuying / totalEntitiesActive : null;
    return {
      ...row,
      totalPenetration,
      tier: classifyTier(totalPenetration, row.totalSalesNet.bs > 0, thresholds),
    };
  }).sort((a, b) => b.totalSalesNet.bs - a.totalSalesNet.bs);

  const breadcrumb: DepthMatrixResponse['breadcrumb'] = [{ label: 'Líneas', groupBy: 'linea' }];
  if (groupBy === 'sublinea' || groupBy === 'sku') breadcrumb.push({ label: linea as string, groupBy: 'sublinea' });
  if (groupBy === 'sku') breadcrumb.push({ label: sublinea as string, groupBy: 'sku' });

  const response: DepthMatrixResponse = { rows, groupBy: groupBy as GroupBy, breadcrumb, scopedToSalesRepName: salesRepName };
  return jsonWithCache(response);
}
```

`row.totalSalesNet.bs > 0` (feeding `classifyTier`'s `hasAnySales` flag) and `b.totalSalesNet.bs - a.totalSalesNet.bs` (the final sort) both switch from the bare-number field to `.bs` explicitly — same pattern as every other ratio/sort-by-BS site in this plan.

- [ ] **Step 6: Update `handleLeaderboard`**

`byLinea`'s accumulator (`{ entitiesBuying: number; salesNet: number }`) only feeds the penetration ratio and the `classifyTier`/`tieredLineNames` selection logic — never displayed as money — so it can stay plain BS, reading `Number(r.SalesNetBs)` instead of `Number(r.SalesNet)`:

```typescript
async function handleLeaderboard(dateWhere: string, thresholds: TierThresholds): Promise<NextResponse> {
  const pool = await getDwhPool();

  const unscopedResult = await pool.request().query(matrixQuery('linea', dateWhere, ''));
  const totalsResult = await pool.request().query(activeTotalsBySegmentQuery(dateWhere, ''));
  const totalsBySegment = new Map<string, number>();
  for (const r of totalsResult.recordset) totalsBySegment.set(String(r.SegmentCode), Number(r.TotalEntities));
  const totalEntitiesActive = SEGMENTS.reduce((sum, s) => sum + (totalsBySegment.get(s) ?? 0), 0);

  const byLinea = new Map<string, { entitiesBuying: number; salesNet: number }>();
  for (const r of unscopedResult.recordset) {
    const label = String(r.GroupLabel);
    const entry = byLinea.get(label) ?? { entitiesBuying: 0, salesNet: 0 };
    entry.entitiesBuying += Number(r.EntitiesBuying);
    entry.salesNet += Number(r.SalesNetBs);
    byLinea.set(label, entry);
  }

  const tieredLineNames: string[] = [];
  let baselinePenetrationSum = 0;
  let baselineCount = 0;
  for (const [label, entry] of byLinea) {
    const penetration = totalEntitiesActive > 0 ? entry.entitiesBuying / totalEntitiesActive : null;
    const tier = classifyTier(penetration, entry.salesNet > 0, thresholds);
    if (tier === 'primera' || tier === 'segunda') {
      tieredLineNames.push(label);
      if (penetration !== null) {
        baselinePenetrationSum += penetration;
        baselineCount += 1;
      }
    }
  }
  const baselinePenetration = baselineCount > 0 ? baselinePenetrationSum / baselineCount : null;

  if (tieredLineNames.length === 0) {
    const response: SellerCoverageResponse = { rows: [] };
    return jsonWithCache(response);
  }

  const req = pool.request();
  tieredLineNames.forEach((name, i) => req.input(`tieredLine${i}`, name));
  const sellerResult = await req.query(sellerCoverageQuery(dateWhere, tieredLineNames));

  const rows: SellerCoverageRow[] = sellerResult.recordset.map(r => {
    const entitiesServed = Number(r.EntitiesServed);
    const tieredLinesCovered = Number(r.TieredLinesCovered);
    const maxPossible = entitiesServed * tieredLineNames.length;
    const ownPenetration = maxPossible > 0 ? tieredLinesCovered / maxPossible : null;
    return {
      salesRepKey: String(r.SalesRepKey),
      salesRepName: String(r.SalesRepName),
      entitiesServed,
      ownPenetration,
      baselinePenetration,
      gapVsBaseline: computeGapVsBaseline(ownPenetration, baselinePenetration),
    };
  }).filter(row => row.entitiesServed > 0)
    .sort((a, b) => (a.gapVsBaseline ?? 0) - (b.gapVsBaseline ?? 0));

  const response: SellerCoverageResponse = { rows };
  return jsonWithCache(response);
}
```

- [ ] **Step 7: Update `GET`'s call sites**

Remove `const currency = searchParams.get('currency') ?? 'bs';` and update: `handleLeaderboard(dateWhere, currency, thresholds)` → `handleLeaderboard(dateWhere, thresholds)`; `handleMatrix(dateWhere, groupBy, lineaParam, sublineaParam, currency, thresholds, salesRepKey, salesRepName)` → `handleMatrix(dateWhere, groupBy, lineaParam, sublineaParam, thresholds, salesRepKey, salesRepName)`.

- [ ] **Step 8: Update `types.ts`**

```typescript
export interface DepthMatrixCell {
  segment: CustomerSegment;
  entitiesBuying: number;
  entitiesActive: number;
  penetration: number | null;
  salesNet: DualAmount;
}

export interface DepthMatrixRow {
  label: string;
  value: string;
  cells: DepthMatrixCell[];
  totalPenetration: number | null;
  totalSalesNet: DualAmount;
  tier: 'primera' | 'segunda' | 'addon' | 'sin-ventas';
}

export interface DepthMatrixResponse {
  rows: DepthMatrixRow[];
  groupBy: GroupBy;
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  scopedToSalesRepName: string | null;
}

export interface DepthGapEntity {
  legalEntityKey: number;
  legalEntityName: string;
  totalSalesNet: DualAmount;
}

export interface DepthGapResponse {
  entities: DepthGapEntity[];
  segment: CustomerSegment;
  productLabel: string;
}

export interface SellerCoverageResponse {
  rows: SellerCoverageRow[];
}
```

(`SellerCoverageRow` itself is unchanged — `ownPenetration`/`baselinePenetration`/`gapVsBaseline` are ratios, `entitiesServed` a count.)

- [ ] **Step 9: Run tests and typecheck**

Run: `bun test app/api/dwh/profundidad-linea/__tests__/ && bunx tsc --noEmit`
Expected: PASS; no new errors.

- [ ] **Step 10: Commit**

```bash
git add app/api/dwh/profundidad-linea/route.ts "app/(app)/analitica/types.ts"
git commit -m "$(cat <<'EOF'
fix: convert profundidad-linea route to historical per-row USD conversion

matrixQuery/matrixQueryForSeller/gapQuery now convert per-row.
handleLeaderboard's internal byLinea accumulator stays plain BS —
it only feeds tier classification and a penetration ratio, never
displayed as money.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `lib/format.ts` — drop client-side division

**Files:**
- Modify: `app/(app)/analitica/lib/format.ts`
- Modify: `app/(app)/analitica/lib/__tests__/format.test.ts`

**Interfaces:**
- Consumes: `DualAmount`, `Currency` from `app/(app)/analitica/types.ts`.
- Produces: `money(amount: DualAmount, currency: Currency): string`, `moneyLabel(amount: DualAmount, currency: Currency): string`, `moneyTooltip(value: unknown, currency: Currency): string` — all drop the `rate?: number` parameter.

**Design notes:**

Every route now ships both currencies pre-computed; the client's only job is to pick `.bs` or `.usd`. `moneyTooltip` is called by Recharts with whatever value the chart's `dataKey` resolves to — since every chart's data-mapping step (Task 13+) now extracts a single number (`.bs` or `.usd`, already selected before the chart renders), `moneyTooltip` keeps accepting a bare number/array, unchanged in that respect — only the `rate` param and the currency-conversion branch inside are removed.

- [ ] **Step 1: Write the failing tests**

Replace `app/(app)/analitica/lib/__tests__/format.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { money, moneyLabel, moneyTooltip } from '../format';

describe('money', () => {
  test('formats the bs side with Venezuelan locale grouping, no decimals', () => {
    expect(money({ bs: 1234567, usd: 30000 }, 'bs')).toBe('1.234.567');
  });

  test('formats the usd side with US locale grouping', () => {
    expect(money({ bs: 1234567, usd: 30864 }, 'usd')).toBe('30,864');
  });

  test('returns an em dash when the requested currency side is null', () => {
    expect(money({ bs: 1234567, usd: null }, 'usd')).toBe('—');
  });
});

describe('moneyLabel', () => {
  test('prefixes bs amounts with "Bs. "', () => {
    expect(moneyLabel({ bs: 1000, usd: 25 }, 'bs')).toBe('Bs. 1.000');
  });

  test('prefixes usd amounts with "$"', () => {
    expect(moneyLabel({ bs: 1000, usd: 25 }, 'usd')).toBe('$25');
  });

  test('shows an em dash (no "$" prefix collision) when usd is null', () => {
    expect(moneyLabel({ bs: 1000, usd: null }, 'usd')).toBe('—');
  });
});

describe('moneyTooltip', () => {
  test('formats a plain numeric value already selected by the caller', () => {
    expect(moneyTooltip(1000, 'bs')).toBe('Bs. 1.000');
  });

  test('unwraps a Recharts-style single-element array value', () => {
    expect(moneyTooltip([1000], 'bs')).toBe('Bs. 1.000');
  });

  test('formats a usd-side value the same way', () => {
    expect(moneyTooltip(2000, 'usd')).toBe('$2,000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/(app)/analitica/lib/__tests__/format.test.ts`
Expected: FAIL — current `money`/`moneyLabel` signatures take `(n: number, currency, rate?)`, not `(amount: DualAmount, currency)`; `moneyLabel({ bs: 1000, usd: null }, 'usd')` would currently return `$NaN`, not `'—'`.

- [ ] **Step 3: Rewrite `format.ts`**

```typescript
import type { Currency, DualAmount } from '../types';

export function money(amount: DualAmount, currency: Currency = 'bs'): string {
  const n = currency === 'usd' ? amount.usd : amount.bs;
  if (n === null) return '—';
  const format = currency === 'usd'
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
  return format.format(n);
}

export function moneyLabel(amount: DualAmount, currency: Currency): string {
  const n = currency === 'usd' ? amount.usd : amount.bs;
  if (n === null) return '—';
  return `${currency === 'usd' ? '$' : 'Bs. '}${money(amount, currency)}`;
}

// Recharts already hands this a single already-selected number (the chart's
// data-mapping step picks .bs/.usd before the chart renders — see every
// tab's chartData useMemo) — this formats that bare number/array, it does
// not itself pick a DualAmount side.
export function moneyTooltip(value: unknown, currency: Currency = 'bs'): string {
  const numVal = Number(Array.isArray(value) ? value[0] : value);
  return `${currency === 'usd' ? '$' : 'Bs. '}${(currency === 'usd'
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 })
  ).format(numVal)}`;
}
```

`moneyTooltip` can no longer delegate to `moneyLabel` (which now expects a `DualAmount`, not a bare number) — its number-formatting logic is inlined directly, duplicating `money`'s two-locale `Intl.NumberFormat` branch. This is a deliberate small duplication over reshaping `money`'s signature to accept either a `DualAmount` or a bare number, which would make its contract harder to reason about at every other call site.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/(app)/analitica/lib/__tests__/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/lib/format.ts" "app/(app)/analitica/lib/__tests__/format.test.ts"
git commit -m "$(cat <<'EOF'
fix: drop client-side BS-to-USD division from format helpers

money/moneyLabel now take a DualAmount and just select .bs/.usd —
every route already ships both currencies pre-converted per-row, so
there is no rate left for the client to divide by. Returns '—' when
the requested side is null (no resolvable rate for that figure).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: `tab-resumen.tsx`

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-resumen.tsx`

**Interfaces:**
- Consumes: `ResumenResponse` (Task 2's `DualAmount`-shaped fields), `money`/`moneyLabel`/`moneyTooltip` (Task 12's `(amount, currency)` / `(value, currency)` signatures, no `rate`).

**Design notes:**

This tab's fetch URL currently sends `currency` as a query param even though the route no longer reads it after Task 2 — drop it for clarity, since every other route this plan touches has also dropped its now-unused `currency` param parsing. Recharts chart data (`trendData`, `agingData`) currently spreads a raw money `number` (`r.salesNet`, `b.amount`) directly as a chart `dataKey` — Recharts needs a plain number per data point, so each chart's data-mapping step must select `.bs` or `.usd` based on the `currency` prop before handing data to `<Bar>`/`<Line>`, since it cannot render a `DualAmount` object as a bar height.

- [ ] **Step 1: Drop the `usdRate`/`rate` plumbing and the URL's `currency` param**

```typescript
const res = await fetch(`/api/dwh/resumen?dateRange=${dateRange}`);
```

Remove `const rate = data.usdRate ?? undefined;` entirely (no `ResumenResponse.usdRate` field exists after Task 2).

- [ ] **Step 2: Update `trendData`/`agingData`/`overdueShare` to select `.bs`/`.usd` per the `currency` prop**

```typescript
const trendData = data.monthlyTrend.map(r => ({
  label: formatYearMonth(r.yearMonth),
  Ventas: currency === 'usd' ? r.salesNet.usd : r.salesNet.bs,
  Devoluciones: currency === 'usd' ? r.returnsNet.usd : r.returnsNet.bs,
}));

const orderedBuckets = BUCKET_ORDER
  .map(bucket => data.agingBuckets.find(b => b.bucket === bucket))
  .filter((b): b is AgingBucketRow => b !== undefined);
const agingData = orderedBuckets.map(b => ({ bucket: b.bucket, Monto: currency === 'usd' ? b.amount.usd : b.amount.bs }));
const overdueShare = (() => {
  const total = orderedBuckets.reduce((sum, b) => sum + b.amount.bs, 0);
  const overdue = orderedBuckets.filter(b => b.bucket !== 'Current').reduce((sum, b) => sum + b.amount.bs, 0);
  return total > 0 ? overdue / total : null;
})();
```

`overdueShare` stays computed off `.bs` explicitly — a same-currency ratio, per this plan's established convention (Task 2/10). A `Ventas`/`Devoluciones`/`Monto` value of `null` (unresolvable USD rate) renders as a gap in the chart, which is Recharts' native behavior for a `null` data point — no extra handling needed.

- [ ] **Step 3: Update every `money`/`moneyLabel`/`moneyTooltip` call site to drop the `rate` argument**

```typescript
<KpiCard label="Ventas netas (12m)" value={moneyLabel(data.kpis.salesNet12mo, currency)} />
<KpiCard label="Devoluciones (12m)" value={moneyLabel(data.kpis.returnsNet12mo, currency)} />
{/* ...returnRate/collected12mo/activeCustomers/churnRate KpiCards unchanged except: */}
<KpiCard label="Cobrado (12m)" value={moneyLabel(data.kpis.collected12mo, currency)} />
```

```typescript
<YAxis tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
<Tooltip formatter={val => moneyTooltip(val, currency)} />
```

`tickFormatter`/`Tooltip formatter` receive Recharts' own already-selected plain number (from `trendData`/`agingData`'s `.bs`/`.usd` selection in Step 2) — wrapping it as `{ bs: v, usd: v }` satisfies `money`'s new `DualAmount` parameter without re-deriving a second currency value that's never actually used (whichever `currency` is active picks the same `v` either way). Apply this same `{ bs: v, usd: v }` wrapping pattern to every remaining `tickFormatter`/`money(...)` call site in this file (top customers/products bar charts, aging chart) — `moneyTooltip` itself takes a bare number/array per Task 12, unchanged.

For the two remaining table sections:

```typescript
<td className="px-3 py-2 text-right font-medium text-gray-900">
  {moneyLabel(d.outstanding, currency)}
</td>
```

```typescript
<td className="px-3 py-2 text-right font-medium text-gray-900">
  {moneyLabel(r.salesNet, currency)}
</td>
<td className="px-3 py-2 text-right text-gray-600">
  {moneyLabel(r.returnsNet, currency)}
</td>
<td className="px-3 py-2 text-right text-gray-600">
  {r.salesNet.bs > 0 ? pct(r.returnsNet.bs / r.salesNet.bs) : '—'}
</td>
```

(`r.salesNet > 0`/`r.returnsNet / r.salesNet` — the sales-rep table's inline return-rate ratio — switches to `.bs` on both sides, same established ratio convention.)

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in `tab-resumen.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/analitica/tabs/tab-resumen.tsx
git commit -m "$(cat <<'EOF'
fix: adapt tab-resumen to DualAmount-shaped Resumen responses

Chart data now selects .bs/.usd per the currency toggle before
handing values to Recharts (which needs a plain number, not a
DualAmount object); money()/moneyLabel() call sites drop the now-gone
rate argument.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: `tab-ventas.tsx`

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-ventas.tsx`

**Interfaces:**
- Consumes: `VentasResponse`/`VentasKpisResponse`/`VentasComparisonResponse` (Task 4's `DualAmount`-shaped fields), `money`/`moneyLabel`/`moneyTooltip` (Task 12 signatures).

**Design notes:**

The most involved tab in this plan: `ComparisonChart`'s `data.rows[].values: Record<string, DualAmount>` (post-Task-4) needs `.bs`/`.usd` selection before becoming chart data, same as `porLineaMesData` will in Task 15. `formatBreakdownMetric` closures (4 call sites) pass a `BreakdownRow`'s plain-`number` metric into `moneyLabel` — after Task 12, `moneyLabel` requires a `DualAmount`, so these call sites must switch to a small inline bare-number formatter instead (this file's established non-goal, Task 4 Step 7: breakdown rows stay plain BS numbers).

- [ ] **Step 1: Add a local bare-BS-number formatter for breakdown metrics**

`BreakdownRow` metrics are plain BS numbers post-Task-4 (never converted — see Task 4's non-goal). Add near the top of the file, after the existing helper functions:

```typescript
// BreakdownRow metrics (drill-in rows under GroupedDrilldownTable) are plain
// BS numbers, not DualAmount — see docs/superpowers/specs/
// 2026-09-23-historical-usd-conversion-design.md's non-goal on ad-hoc
// breakdown rows. moneyLabel() now requires a DualAmount, so these format as
// bare BS regardless of the currency toggle rather than mis-calling moneyLabel
// with a number where a DualAmount is expected.
function formatBreakdownBs(value: string | number | null): string {
  return typeof value === 'number' ? moneyLabel({ bs: value, usd: null }, 'bs') : String(value ?? '—');
}
```

Replace every `formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, clienteRate) : String(value ?? '—'))}` (2 occurrences — `clienteColumns`' table and `lineaColumns`' table) with `formatBreakdownMetric={(_key, value) => formatBreakdownBs(value)}`.

- [ ] **Step 2: Drop `usdRate`/`rate` state and URL params throughout**

Remove `mesRate`/`clienteRate`/`lineaRate`/`kpisRate` (`data?.usdRate ?? undefined` derivations) — none of `VentasResponse`/`VentasKpisResponse`/`VentasComparisonResponse` carry `usdRate` after Task 4. Remove `currency` from every `URLSearchParams({ dateRange, currency, ... })` call in this file's fetch effects (7 occurrences: `mesData`, `clienteData`, `lineaData`, `kpisData`, `comparisonOptions` — this one already omits `currency` from its dependency array via the eslint-disable comment, but still includes it in the request; drop it there too since the route never reads it — `lineaCompareData`, `clienteCompareData`) and the two `handleFetchBreakdown`/`handleFetchLineaBreakdown` functions' `URLSearchParams` calls.

- [ ] **Step 3: Update `ComparisonChart` to select `.bs`/`.usd`**

```typescript
function ComparisonChart({
  options,
  selected,
  onToggle,
  data,
  loading,
  error,
  currency,
  maxSelected = 4,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  data: VentasComparisonResponse | null;
  loading: boolean;
  error: string | null;
  currency: Currency;
  maxSelected?: number;
}) {
  const chartData = (data?.rows ?? []).map(row => {
    const flat: Record<string, string | number | null> = { yearMonth: row.yearMonth };
    for (const [key, amount] of Object.entries(row.values)) {
      flat[key] = currency === 'usd' ? amount.usd : amount.bs;
    }
    return flat;
  });
  const labelFor = (value: string) => options.find(o => o.value === value)?.label ?? value;

  return (
    <div>
      {/* ...unchanged selection buttons/empty states... */}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
          <Tooltip formatter={val => moneyTooltip(val, currency)} />
          {/* ...Legend/Line elements unchanged... */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

(`rate?: number` prop removed from the destructured props and its type; both call sites — "Comparación por línea"/"Comparación por cadena" — drop their `rate={lineaCompareData?.usdRate ?? undefined}`/`rate={clienteCompareData?.usdRate ?? undefined}` props in Step 6 below.)

- [ ] **Step 4: Update `chartData` (Por mes) to select `.bs`/`.usd`**

```typescript
const chartData = (mesData?.rows ?? []).map(r => ({
  label: r.label,
  value: String(r.value),
  salesNet: currency === 'usd' ? r.salesNet.usd : r.salesNet.bs,
}));
```

- [ ] **Step 5: Update column formatters and KPI cards**

```typescript
const clienteColumns: DrilldownColumn<VentasTableRow>[] = [
  {
    key: 'salesNet',
    label: 'Ventas netas',
    align: 'right',
    format: row => moneyLabel(row.salesNet, currency),
  },
  // ...returnRate/avgDiscount unchanged...
];
```

(Same `moneyLabel(row.salesNet, currency)` edit — drop the third arg — for `lineaColumns`.)

```typescript
const kpis = kpisData?.kpis;
const salesDelta = kpis && kpis.salesNetPrevPeriod !== null && kpis.salesNetPrevPeriod.bs !== 0
  ? (kpis.salesNet.bs - kpis.salesNetPrevPeriod.bs) / kpis.salesNetPrevPeriod.bs
  : null;
```

(`salesDelta`, a period-over-period percentage change, is computed off `.bs` on both sides — same-currency ratio convention.)

```typescript
<KpiCard
  label="Ventas netas"
  value={moneyLabel(kpis.salesNet, currency)}
  delta={{ pct: salesDelta, label: 'vs. período anterior' }}
/>
<KpiCard label="Clientes activos" value={kpis.activeClients.toLocaleString('es-VE')} />
<KpiCard label="Ticket promedio" value={kpis.avgTicket !== null ? moneyLabel(kpis.avgTicket, currency) : '—'} />
<KpiCard label="Unidades vendidas" value={kpis.unitsSold.toLocaleString('es-VE')} />
<KpiCard
  label="Ventas por cliente activo"
  value={kpis.salesPerActiveClient !== null ? moneyLabel(kpis.salesPerActiveClient, currency) : '—'}
/>
```

- [ ] **Step 6: Update the "Por mes" chart's axis/tooltip and both `ComparisonChart` call sites**

```typescript
<YAxis tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
<Tooltip formatter={val => moneyTooltip(val, currency)} />
```

```typescript
<ComparisonChart
  options={comparisonOptions?.lineas ?? []}
  selected={lineaCompareKeys}
  onToggle={toggleLineaCompare}
  data={lineaCompareData}
  loading={lineaCompareLoading}
  error={lineaCompareError}
  currency={currency}
/>
```

(Same edit — drop the `rate={...}` prop — for the "Comparación por cadena" `ComparisonChart`.)

- [ ] **Step 7: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in `tab-ventas.tsx`.

- [ ] **Step 8: Commit**

```bash
git add app/(app)/analitica/tabs/tab-ventas.tsx
git commit -m "$(cat <<'EOF'
fix: adapt tab-ventas to DualAmount-shaped Ventas responses

Comparison-chart series and the monthly bar chart now select .bs/.usd
per the currency toggle before handing data to Recharts. Breakdown
rows (still plain BS per the shared non-goal) get their own bare-BS
formatter instead of miscalling the now-DualAmount-typed moneyLabel.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: `tab-productos.tsx`

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-productos.tsx`

**Interfaces:**
- Consumes: `ProductosResponse`/`ProfundidadLineaResponse`/`UnitsByLineaResponse` (Task 5's `DualAmount`-shaped fields), `money`/`moneyLabel` (Task 12 signatures).

**Design notes:**

`porLineaMesData.rows[].salesNet: Record<string, DualAmount>` (post-Task-5) is read inside the stacked-bar chart's `Tooltip formatter` closure (not the chart's own `dataKey`, which stays `units` — a plain-number field, unaffected) — that closure needs `.bs`/`.usd` selection before formatting. This tab's Tienda `<select>` is unrelated to this plan (a separate, already-tracked searchable-select refactor from a different spec — `2026-09-23-seller-product-store-matrix-design.md` — not touched here).

- [ ] **Step 1: Drop `rate`/`usdRate` derivations and `currency` from every fetch URL**

Remove `const rate = data?.usdRate ?? undefined;`, `const profundidadRate = profundidadData?.usdRate ?? undefined;`, `const porLineaMesRate = porLineaMesData?.usdRate ?? undefined;`. Remove `currency` from the three `URLSearchParams({ dateRange, currency, ... })` calls (main `data` fetch, `profundidad` section fetch, `porLineaMes` section fetch) — the route never reads it after Task 5.

- [ ] **Step 2: Update the main table's `moneyLabel` call site**

```typescript
<td className="px-3 py-2 text-right font-medium text-gray-900">
  {moneyLabel(row.salesNet, currency)}
</td>
```

- [ ] **Step 3: Update the stacked-bar chart's tooltip to select `.bs`/`.usd`**

```typescript
<Tooltip
  formatter={(value, name, entry) => {
    const row = porLineaMesData.rows.find(r => r.yearMonth === (entry.payload as { yearMonth: string })?.yearMonth);
    const lineaName = String(name);
    const salesNetAmount = row?.salesNet[lineaName] ?? { bs: 0, usd: 0 };
    const totalBs = row?.totalSalesNet.bs ?? 0;
    const share = totalBs > 0 ? salesNetAmount.bs / totalBs : null;
    return [`${qty(Number(value))} u. — ${moneyLabel(salesNetAmount, currency)} (${pct(share)} del mes)`, lineaName];
  }}
/>
```

(`share`, a within-month percentage, is computed off `.bs` on both sides — same-currency ratio convention. `porLineaMesChartData` itself, built from `r.units` only, is untouched — `units` was never a money field.)

- [ ] **Step 4: Update the Profundidad de Línea table's `moneyLabel` call site**

```typescript
<td className="px-3 py-2 text-right text-gray-600">
  {moneyLabel(row.avgMonthlyPrice, currency)}
</td>
```

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in `tab-productos.tsx`.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/analitica/tabs/tab-productos.tsx
git commit -m "$(cat <<'EOF'
fix: adapt tab-productos to DualAmount-shaped Productos responses

Per-línea salesNet map in the stacked-bar tooltip now selects .bs/.usd
before formatting; the flat table's own money cells drop the now-gone
rate argument.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: `tab-profundidad.tsx`

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-profundidad.tsx`

**Interfaces:**
- Consumes: `DepthMatrixResponse`/`DepthGapResponse` (Task 11's `DualAmount`-shaped fields), `moneyLabel` (Task 12 signature).

**Design notes:**

No Recharts usage in this tab (plain HTML tables only) — every change is a direct `moneyLabel(x, currency, rate)` → `moneyLabel(x, currency)` call-site edit, plus dropping `currency` from the two fetch URLs' params (the route never reads it after Task 11) and removing `rate`.

- [ ] **Step 1: Drop `rate` and `currency` from fetch params**

Remove `const rate = data?.usdRate ?? undefined;` (`DepthMatrixResponse` has no `usdRate` after Task 11). Remove `currency` from both `URLSearchParams({ dateRange, currency, ... })` calls (leaderboard fetch, main matrix fetch) — `SellerCoverageResponse` also drops `usdRate` per Task 11.

- [ ] **Step 2: Update both `moneyLabel` call sites**

```typescript
<td className="px-3 py-2 text-right text-gray-900 font-medium">{moneyLabel(row.totalSalesNet, currency)}</td>
```

```typescript
<li key={e.legalEntityKey} className="text-gray-700">
  {e.legalEntityName} — {moneyLabel(e.totalSalesNet, currency)} en ventas totales
</li>
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in `tab-profundidad.tsx`.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/analitica/tabs/tab-profundidad.tsx
git commit -m "$(cat <<'EOF'
fix: adapt tab-profundidad to DualAmount-shaped matrix/gap responses

moneyLabel call sites drop the now-gone rate argument; fetch URLs
drop the currency param the route no longer reads.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: `tab-vendedores.tsx`

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-vendedores.tsx`

**Interfaces:**
- Consumes: `VendedoresResponse`/`VendedoresExcludedResponse` (Task 7's `DualAmount`-shaped fields), `moneyLabel` (Task 12 signature).

**Design notes:**

Two sort/filter sites compare `VendedoresRow.salesNet`/`.excludedSalesNet` as bare numbers today — both need `.bs` access post-Task-7. `formatBreakdownMetric`'s `moneyLabel(value, currency, rate)` call (on a plain-number `BreakdownRow` metric) needs the same bare-BS-formatter fix as Task 14.

- [ ] **Step 1: Add the same local bare-BS-number formatter as Task 14**

```typescript
// BreakdownRow metrics are plain BS numbers, not DualAmount — see Task 14's
// identical note (docs/superpowers/specs/
// 2026-09-23-historical-usd-conversion-design.md's non-goal on ad-hoc
// breakdown rows).
function formatBreakdownBs(value: string | number | null): string {
  return typeof value === 'number' ? moneyLabel({ bs: value, usd: null }, 'bs') : String(value ?? '—');
}
```

Replace `formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, rate) : String(value ?? '—'))}` with `formatBreakdownMetric={(_key, value) => formatBreakdownBs(value)}`.

- [ ] **Step 2: Drop `rate`/`currency` plumbing**

Remove `const rate = data?.usdRate ?? undefined;` (`VendedoresResponse` has no `usdRate` after Task 7). Drop `currency` from both fetch URLs (`/api/dwh/vendedores?dateRange=${dateRange}&currency=${currency}` → `/api/dwh/vendedores?dateRange=${dateRange}`; the `handleToggleExcluded`/`handleFetchBreakdown` `URLSearchParams` calls) — the route never reads it after Task 7.

- [ ] **Step 3: Update the sort/filter sites to compare `.bs`**

```typescript
const rows: VendedoresTableRow[] = useMemo(() => {
  if (!data) return [];
  return [...data.rows]
    .sort((a, b) => b.salesNet.bs - a.salesNet.bs)
    .map(r => ({ ...r, label: r.name }));
}, [data]);
```

```typescript
const rowsWithExclusions = rows.filter(r => r.excludedSalesNet.bs > 0);
```

- [ ] **Step 4: Update every `moneyLabel` call site**

```typescript
const columns: DrilldownColumn<VendedoresTableRow>[] = [
  {
    key: 'salesNet',
    label: 'Ventas netas',
    align: 'right',
    format: row => moneyLabel(row.salesNet, currency),
  },
  {
    key: 'returnsNet',
    label: 'Devoluciones',
    align: 'right',
    format: row => moneyLabel(row.returnsNet, currency),
  },
  // ...returnRate/collectionRate/avgDiscount unchanged...
];
```

```typescript
{row.name}: {moneyLabel(row.excludedSalesNet, currency)} excluidos ({row.excludedInvoiceCount} facturas)
```

```typescript
<td className="text-right py-1">{moneyLabel(inv.amountNet, currency)}</td>
```

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in `tab-vendedores.tsx`.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/analitica/tabs/tab-vendedores.tsx
git commit -m "$(cat <<'EOF'
fix: adapt tab-vendedores to DualAmount-shaped Vendedores responses

Sort/filter comparisons on salesNet/excludedSalesNet now read .bs
explicitly; moneyLabel call sites drop the now-gone rate argument;
breakdown rows get the same bare-BS formatter as tab-ventas.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: `tab-cxc.tsx`

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-cxc.tsx`

**Interfaces:**
- Consumes: `CxcResponse`/`DebtConcentrationResponse` (Task 10's `DualAmount`-shaped fields), `money`/`moneyLabel`/`moneyTooltip` (Task 12 signatures).

**Design notes:**

`data.agingBuckets`/`data.weekdayVencimiento`/`data.agingTrend`/`debtConcentration.rows` all feed Recharts chart data directly today (`b.amount`, `row.buckets.find(...).amount`) — every one becomes a `.bs`/`.usd` selection. `totalOutstanding` (a plain sum feeding a KPI card) also needs `.bs` since it's summed across rows before any currency selection.

- [ ] **Step 1: Drop `rate`/`usdRate` and `currency` from both fetch URLs**

Remove `const rate = data.usdRate ?? undefined;` (`CxcResponse` has no `usdRate` after Task 10). Drop `currency` from both `URLSearchParams({ currency, clienteDimension, ... })` calls — the route never reads it after Task 10 (note: this route never took `dateRange` either — unchanged, AR aging is always "latest snapshot" per the file's own header comment).

- [ ] **Step 2: Update `agingData`/`totalOutstanding`**

```typescript
const orderedBuckets = BUCKET_ORDER
  .map(bucket => data.agingBuckets.find(b => b.bucket === bucket))
  .filter((b): b is AgingBucketRow => b !== undefined);
const agingData = orderedBuckets.map(b => ({ bucket: b.bucket, Monto: currency === 'usd' ? b.amount.usd : b.amount.bs }));
```

(`AgingBucketRow` import already present via `types` — no new import needed. The original single `totalOutstanding` line is replaced entirely in Step 4 below, once both currencies are summed independently for the KPI card.)

- [ ] **Step 3: Update the weekday-vencimiento and aging-trend chart data**

```typescript
<BarChart data={data.weekdayVencimiento.map(w => ({
  weekday: w.weekday,
  noVencida: currency === 'usd' ? w.noVencida.usd : w.noVencida.bs,
  venceHoy: currency === 'usd' ? w.venceHoy.usd : w.venceHoy.bs,
  vencida: currency === 'usd' ? w.vencida.usd : w.vencida.bs,
}))}>
```

(Replaces the existing `<BarChart data={data.weekdayVencimiento}>` — the three `<Bar dataKey="noVencida"/"venceHoy"/"vencida">` elements below it are unchanged, since they still read those same key names off the new flattened array.)

```typescript
<AreaChart
  data={data.agingTrend.map(row => {
    const flat: Record<string, string | number | null> = { yearMonth: row.yearMonth };
    for (const bucket of BUCKET_ORDER) {
      const amount = row.buckets.find(b => b.bucket === bucket)?.amount;
      flat[bucket] = amount === undefined ? 0 : (currency === 'usd' ? amount.usd : amount.bs);
    }
    return flat;
  })}
>
```

- [ ] **Step 4: Sum both currencies independently for the KPI card, and update the top-debtors table**

`totalOutstanding` (the original code's single BS-only sum) is replaced by two independent sums, since the API ships per-bucket amounts, not a pre-aggregated total, and the KPI card must respect the currency toggle rather than always showing BS:

```typescript
const totalOutstandingBs = data.agingBuckets.reduce((sum, b) => sum + b.amount.bs, 0);
const totalOutstandingUsd = data.agingBuckets.some(b => b.amount.usd === null)
  ? null
  : data.agingBuckets.reduce((sum, b) => sum + (b.amount.usd as number), 0);
```

```typescript
<KpiCard label="Saldo total pendiente" value={moneyLabel({ bs: totalOutstandingBs, usd: totalOutstandingUsd }, currency)} />
```

```typescript
<td className="px-3 py-2 text-right font-medium text-gray-900">
  {moneyLabel(d.outstanding, currency)}
</td>
```

- [ ] **Step 5: Update chart axis/tooltip formatters and the debt-concentration chart**

```typescript
<YAxis tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
<Tooltip formatter={val => moneyTooltip(val, currency)} />
```

Apply this same two-line edit (drop `rate`, wrap `tickFormatter`'s `v` as `{ bs: v, usd: v }` per Task 13's established pattern) to the AR-aging chart, the weekday-vencimiento chart, and the aging-trend chart's axis/tooltip. The debt-concentration chart's data mapping:

```typescript
<BarChart
  data={debtConcentration.rows.map(row => {
    const flat: Record<string, string | number> = { name: row.name };
    for (const bucket of BUCKET_ORDER) {
      const amount = row.buckets.find(b => b.bucket === bucket)?.amount;
      flat[bucket] = amount === undefined ? 0 : ((currency === 'usd' ? amount.usd : amount.bs) ?? 0);
    }
    return flat;
  })}
  layout="vertical"
  margin={{ left: 24 }}
>
  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} />
  <Tooltip formatter={val => moneyTooltip(val, currency)} />
```

(The `?? 0` after the `.usd`/`.bs` ternary here — unlike the aging-trend chart's version — guards against a `null` USD amount specifically for this stacked bar, where a `null` segment height would otherwise break the stack's total rather than just showing a gap, since multiple buckets stack additively in one bar per customer.)

- [ ] **Step 6: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in `tab-cxc.tsx`.

- [ ] **Step 7: Commit**

```bash
git add app/(app)/analitica/tabs/tab-cxc.tsx
git commit -m "$(cat <<'EOF'
fix: adapt tab-cxc to DualAmount-shaped CXC/debt-concentration responses

Every aging/weekday/debt-concentration chart now selects .bs/.usd per
the currency toggle before handing data to Recharts. The KPI row's
total-outstanding figure is now summed independently in both
currencies rather than only ever showing BS.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: `tab-devoluciones.tsx`

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-devoluciones.tsx`

**Interfaces:**
- Consumes: `DevolucionesResponse` (Task 8's `DualAmount`-shaped `amountNet` field), `moneyLabel` (Task 12 signature).

**Design notes:**

`DevolucionesTableRow.amountNet` (this file's own local interface, not `DevolucionesMatrixCell` itself) changes from `number` to `DualAmount` since it's copied straight from `r.amountNet`. `MatrixTable`'s internal sort comparator and its `rate` prop both need updating — the prop is dropped entirely (Task 12's `moneyLabel` needs no rate). `formatBreakdownMetric` in `clienteColumns` gets the same bare-BS-formatter treatment as Tasks 14/17.

- [ ] **Step 1: Update `DevolucionesTableRow` and add the bare-BS formatter**

```typescript
interface DevolucionesTableRow {
  label: string;
  value: string;
  ratioDevolucion: number | null;
  amountNet: DualAmount;
}
```

(Add `DualAmount` to this file's `import type { ... } from '../types';` list.)

```typescript
// BreakdownRow metrics are plain BS numbers — see Task 14's identical note.
function formatBreakdownBs(value: string | number | null): string {
  return typeof value === 'number' ? moneyLabel({ bs: value, usd: null }, 'bs') : String(value ?? '—');
}
```

- [ ] **Step 2: Update `MatrixTable`'s props and sort comparator**

```typescript
function MatrixTable({
  rows,
  currency,
  nameColumnLabel,
  nameOf,
  defaultSortKey = 'amountNet',
}: {
  rows: DevolucionesMatrixCell[];
  currency: Currency;
  nameColumnLabel: string;
  nameOf: (row: DevolucionesMatrixCell) => string;
  defaultSortKey?: MatrixSortKey;
}) {
  // ...sortKey/sortDir state unchanged...

  const sortedRows = useMemo(() => {
    const withName = rows.map(row => ({ row, name: nameOf(row) }));
    withName.sort((a, b) => {
      let cmp: number;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === 'ratioDevolucion') {
        cmp = (a.row.ratioDevolucion ?? -Infinity) - (b.row.ratioDevolucion ?? -Infinity);
      } else {
        cmp = a.row.amountNet.bs - b.row.amountNet.bs;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return withName.map(x => x.row);
  }, [rows, sortKey, sortDir, nameOf]);

  // ...handleSort unchanged...

  // in the row-rendering table body:
  <td className="px-3 py-2 text-right font-medium text-gray-900">{moneyLabel(row.amountNet, currency)}</td>
```

(`rate: number | undefined` removed from the props type; `nameColumnLabel`'s param order in the JSX call sites below is unaffected since these are named props.)

- [ ] **Step 3: Drop `rate`/`usdRate` derivations, `currency` from fetch URLs, and update both `MatrixTable` call sites**

Remove `const salesrepRate = salesrepData?.usdRate ?? undefined;`, `const productoRate = productoData?.usdRate ?? undefined;`, `const clienteRate = clienteData?.usdRate ?? undefined;` (`DevolucionesResponse` has no `usdRate` after Task 8). Drop `currency` from all 4 fetch calls (`salesrepData`, `productoData`, `clienteData`, `handleFetchBreakdown`) — the route never reads it after Task 8.

```typescript
<MatrixTable rows={salesrepData?.rows ?? []} currency={currency} nameColumnLabel="Vendedor" nameOf={row => row.salesRep} />
```

```typescript
<MatrixTable rows={productoData?.rows ?? []} currency={currency} nameColumnLabel="Producto" nameOf={row => row.producto} />
```

- [ ] **Step 4: Update `clienteRows`' sort and `clienteColumns`' formatter**

```typescript
const clienteRows: DevolucionesTableRow[] = useMemo(() => {
  if (!clienteData) return [];
  const rows = clienteData.rows
    .filter(r => r.clienteValue !== null)
    .map(r => ({
      label: r.cliente,
      value: r.clienteValue as string,
      ratioDevolucion: r.ratioDevolucion,
      amountNet: r.amountNet,
    }));
  if (clienteSortByRate) {
    rows.sort((a, b) => (b.ratioDevolucion ?? -Infinity) - (a.ratioDevolucion ?? -Infinity));
  }
  return rows;
}, [clienteData, clienteSortByRate]);
```

(No change needed here beyond the type change already covered by Step 1 — `ratioDevolucion` sort is untouched, `amountNet` is just carried through as the new `DualAmount` shape.)

```typescript
const clienteColumns: DrilldownColumn<DevolucionesTableRow>[] = [
  {
    key: 'amountNet',
    label: 'Monto neto',
    align: 'right',
    format: row => moneyLabel(row.amountNet, currency),
  },
  // ...ratioDevolucion unchanged...
];
```

```typescript
formatBreakdownMetric={(_key, value) => formatBreakdownBs(value)}
```

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in `tab-devoluciones.tsx`.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/analitica/tabs/tab-devoluciones.tsx
git commit -m "$(cat <<'EOF'
fix: adapt tab-devoluciones to DualAmount-shaped Devoluciones responses

MatrixTable's sort comparator now reads amountNet.bs explicitly and
drops its rate prop entirely; breakdown rows get the same bare-BS
formatter as tab-ventas/tab-vendedores.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: `tab-compras.tsx`

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-compras.tsx`

**Interfaces:**
- Consumes: `ComprasResponse` (Task 9's `DualAmount`-shaped `purchasesNet` field), `money`/`moneyLabel`/`moneyTooltip` (Task 12 signatures).

**Design notes:**

Structurally mirrors Task 14 (`tab-ventas.tsx`) but simpler — one chart, no comparison charts, no correlated-returns concept. `chartData`'s `purchasesNet` needs `.bs`/`.usd` selection before becoming a Recharts `dataKey`.

- [ ] **Step 1: Drop `rate`/`usdRate` derivations and `currency` from fetch URLs**

Remove `const mesRate = mesData?.usdRate ?? undefined;`, `const proveedorRate = proveedorData?.usdRate ?? undefined;`, `const lineaRate = lineaData?.usdRate ?? undefined;` (`ComprasResponse` has no `usdRate` after Task 9). Drop `currency` from all 4 fetch calls (`mesData`, `proveedorData`, `lineaData`, `handleFetchLineaBreakdown`) — the route never reads it after Task 9.

- [ ] **Step 2: Update `chartData` to select `.bs`/`.usd`**

```typescript
const chartData = (mesData?.rows ?? []).map(r => ({
  label: r.label,
  value: String(r.value),
  purchasesNet: currency === 'usd' ? r.purchasesNet.usd : r.purchasesNet.bs,
}));
```

- [ ] **Step 3: Update the chart's axis/tooltip and both `moneyLabel` column formatters**

```typescript
<YAxis tick={{ fontSize: 12 }} tickFormatter={v => money({ bs: v, usd: v }, currency)} />
<Tooltip formatter={val => moneyTooltip(val, currency)} />
```

```typescript
const proveedorColumns: DrilldownColumn<ComprasTableRow>[] = [
  {
    key: 'purchasesNet',
    label: 'Compras netas',
    align: 'right',
    format: row => moneyLabel(row.purchasesNet, currency),
  },
  // ...avgDiscount unchanged...
];
```

(Same edit — drop the third arg — for `lineaColumns`.)

- [ ] **Step 4: Update both `formatBreakdownMetric` closures**

This route's second breakdown query (the generic proveedor-parent path, `Task 9 Step 4`) was left as a bare `SUM(fp.NetAmount)` with column name `PurchasesNet` — still a plain BS number, same as the línea→producto sentinel path. Add the same bare-BS formatter as Tasks 14/17/19:

```typescript
// BreakdownRow metrics are plain BS numbers — see Task 14's identical note.
function formatBreakdownBs(value: string | number | null): string {
  return typeof value === 'number' ? moneyLabel({ bs: value, usd: null }, 'bs') : String(value ?? '—');
}
```

```typescript
formatBreakdownMetric={(_key, value) => formatBreakdownBs(value)}
```

(Applied to both `GroupedDrilldownTable` call sites — `proveedorColumns`' table and `lineaColumns`' table.)

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in `tab-compras.tsx`.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/analitica/tabs/tab-compras.tsx
git commit -m "$(cat <<'EOF'
fix: adapt tab-compras to DualAmount-shaped Compras responses

Monthly chart data now selects .bs/.usd per the currency toggle;
moneyLabel call sites drop the now-gone rate argument; breakdown rows
get the same bare-BS formatter as the other GroupedDrilldownTable tabs.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: `tab-clientes.tsx`

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-clientes.tsx`

**Interfaces:**
- Consumes: `ClientesResponse`/`ClientesChurnedResponse` (Task 6's `DualAmount`-shaped fields), `moneyLabel` (Task 12 signature).

**Design notes:**

`sortValue`'s `salesNet`/`returnsNet` cases return a bare number today for the sortable-table comparator — both switch to `.bs`. `useClientesChurned`'s hook signature keeps its `currency` parameter (still needed as a prop to pick `.bs`/`.usd` when rendering `lostRevenue`) but drops `currency` from its own fetch URL, since the route no longer reads it after Task 6. No Recharts money fields in this tab — the trend chart (`activeCustomers`/`churnRate`) has no money, untouched.

- [ ] **Step 1: Update `sortValue`**

```typescript
function sortValue(row: ClientesRow, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return row.name ?? '';
    case 'salesNet':
      return row.salesNet.bs;
    case 'returnsNet':
      return row.returnsNet.bs;
    case 'returnRate':
      return row.returnRate ?? -Infinity;
    case 'pareto':
      return row.pareto;
  }
}
```

- [ ] **Step 2: Drop `rate`/`usdRate` and `currency` from fetch URLs**

Remove `const rate = data.usdRate ?? undefined;` (`ClientesResponse` has no `usdRate` after Task 6). In `useClientesChurned`, drop `currency` from its `URLSearchParams({ dateRange, currency, clienteDimension, section: 'churned' })` call (keep the `currency: Currency` parameter itself — it's still consumed by the caller to render `lostRevenue`, just no longer sent to the server). Drop `currency` from the main `data` fetch's `URLSearchParams({ dateRange, currency, clienteDimension })` call too.

- [ ] **Step 3: Update the churned-customers table and main Pareto table**

```typescript
(() => {
  const churnedRows = churned.data!.rows;
  return (
    <div className="overflow-x-auto">
      {/* ...thead unchanged... */}
      <tbody className="divide-y divide-gray-100">
        {churnedRows.map((r, i) => (
          <tr key={`${r.name}-${i}`} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
            <td className="px-3 py-2 text-gray-800">{r.name}</td>
            <td className="px-3 py-2 text-right text-gray-600">{formatDateKey(r.lastPurchaseDateKey)}</td>
            <td className="px-3 py-2 text-right font-medium text-gray-900">
              {moneyLabel(r.lostRevenue, currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </div>
  );
})()
```

(The `const churnedRate = churned.data.usdRate ?? undefined;` line inside this IIFE is removed entirely — `ClientesChurnedResponse` has no `usdRate` after Task 6 — and the IIFE's `churned.data!` non-null assertion mirrors the existing outer `churned.data && !churned.data.available ? ... : !churned.data || churned.data.rows.length === 0 ? ... : (() => {...})()` guard chain immediately above it, which already guarantees `churned.data` is non-null by the time this branch runs.)

```typescript
<td className="px-3 py-2 text-right font-medium text-gray-900">
  {moneyLabel(r.salesNet, currency)}
</td>
<td className="px-3 py-2 text-right text-gray-600">
  {moneyLabel(r.returnsNet, currency)}
</td>
```

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in `tab-clientes.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/analitica/tabs/tab-clientes.tsx
git commit -m "$(cat <<'EOF'
fix: adapt tab-clientes to DualAmount-shaped Clientes responses

sortValue's salesNet/returnsNet comparator now reads .bs explicitly;
moneyLabel call sites drop the now-gone rate argument.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-09-23-historical-usd-conversion-design.md`):

- Shared per-row conversion expression in `query-builder.ts` — Task 1. ✅
- Missing-rate fallback to that date's `Fact_ExchangeRate` — Task 1's `dualAmountExpr`. ✅
- No `co_mone` branching (confirmed BS-only) — documented in Task 1's design notes, no code needed. ✅
- All 9 in-scope routes (`resumen`, `ventas`, `productos`, `clientes`, `vendedores`, `devoluciones`, `compras`, `cxc`, `profundidad-linea`) — Tasks 2, 4–11. ✅
- Dead `dashboard` route deleted — Task 3. ✅
- `finanzas`/`multimoneda` explicitly untouched — never referenced in any task's Files section; confirmed no task modifies `app/api/dwh/finanzas/`, `app/api/dwh/multimoneda/`, `tab-finanzas.tsx`, or `tab-multimoneda.tsx`. ✅
- Every response type's money fields become `DualAmount`, `usdRate`/`currency` param removed — one `types.ts` edit per route task (2, 4–11), covering every interface enumerated in the spec's `types.ts` grep. ✅
- Client never divides — Task 12 (`lib/format.ts`) plus every tab task (13–21) removing `rate` args and `usdRate` derivations. ✅
- All 9 in-scope tab components — Tasks 13–21. ✅

**Placeholder scan:** no "TBD"/"similar to Task N"/unshown code found across Tasks 13–21 — every step includes the actual before/after code.

**Type consistency:**
- `DualAmount` (Task 1) is imported and used identically as `{ bs: number; usd: number | null }` in every task that touches `types.ts` (2, 4–11) and every tab that receives it (13–21) — no task introduces a differently-named or differently-shaped equivalent.
- `usdConversionJoin(factAlias, dateColumn?)` and `dualAmountExpr(factAlias, column, bsAlias, usdAlias)` (Task 1) are called with the same signature and the same `fx`-alias-rename convention (`.replace('fx', '<shortalias>fx')` for nested correlated subqueries) in every subsequent route task — verified across Tasks 2, 4–11.
- `money(amount: DualAmount, currency)` / `moneyLabel(amount: DualAmount, currency)` / `moneyTooltip(value: unknown, currency)` (Task 12) are called with the exact same 2-argument shape in every tab task (13–21); every `tickFormatter={v => money({ bs: v, usd: v }, currency)}` site uses the same wrapping idiom introduced in Task 13, established once and reused verbatim in Tasks 14/18/20.
- The `formatBreakdownBs` local helper (introduced independently but identically in Tasks 14, 17, 19, 20 — the four tabs using `GroupedDrilldownTable`'s `formatBreakdownMetric`) has the same name and body in each — a shared implementation across 4 files that could be extracted into `lib/format.ts` itself, but is kept as a small per-file duplication rather than growing `format.ts`'s public surface for a formatter only these 4 breakdown-row call sites need; noted here as a deliberate choice, not an inconsistency.

**Judgment calls made while reading tab files fresh (not pre-existing assumptions from Tasks 1–12):**
- `tab-cxc.tsx`'s "Saldo total pendiente" KPI card summed a single BS-only `totalOutstanding` in the original code — since the API never ships a pre-aggregated total (only per-bucket amounts), Task 18 Step 4 sums both `.bs` and `.usd` independently client-side (with a `null`-propagation guard) rather than arbitrarily picking one currency for that one KPI.
- `tab-productos.tsx`'s Tienda `<select>` is explicitly left untouched — it's tracked by a different, already-existing spec (the searchable-select refactor) and is unrelated to currency conversion.
- Four tabs' `formatBreakdownMetric` closures called `moneyLabel(value, currency, rate)` on a `BreakdownRow`'s plain-`number` field — after Task 12 changes `moneyLabel`'s first parameter to `DualAmount`, this would be a type error if left as a bare call; Tasks 14/17/19/20 each add a small local `formatBreakdownBs` helper rather than widening `moneyLabel`'s signature to accept either shape, keeping that function's contract simple for every other call site.
- `tab-cxc.tsx`'s stacked debt-concentration chart needed a `?? 0` fallback for a `null` USD segment (unlike the aging-trend area chart, which lets a `null` point render as a gap) — because Recharts stacks bars additively per category, a `null` segment there would misrender the whole bar's total height, not just that one segment.

