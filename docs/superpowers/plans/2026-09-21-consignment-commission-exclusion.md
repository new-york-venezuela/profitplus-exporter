# Consignment Commission Exclusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect multi-tienda chains billed in aggregate at their root customer code (the consignment pattern found in Excelsior Gama), and exclude those root-billed invoices from sellers' commission-relevant sales/collection totals in the Vendedores tab, with an auditable list of exactly what was excluded.

**Architecture:** Modify `app/api/dwh/vendedores/route.ts`'s existing `salesRepQuery` to compute an `IsConsignmentPattern` flag per `Dim_LegalEntity` (ratio of root-billed sales to total sales, threshold-gated) and split each seller's totals into included vs. excluded amounts. Add a new audit-list query and a small expand affordance in `tab-vendedores.tsx`. No DWH migration needed — this is a reporting-time computation, not a persisted dimension attribute.

**Tech Stack:** Next.js 16 App Router, TypeScript, `mssql` against `DWH_AlimentosNY`, Bun test, Playwright e2e (`@mssql`-tagged).

**Spec:** `docs/superpowers/specs/2026-09-21-consignment-commission-exclusion-design.md`

## Global Constraints

- All ERP/DWH `mssql` queries use `.input()` for every user-controlled value.
- `requireDwhAccess` gates the route; the page already gates independently (unchanged).
- `rootShareThreshold` is a tunable query param with a `0.15` default — never hardcoded as the only option.
- No estimation or splitting of excluded amounts across sellers — the excluded amount is shown as-is, never redistributed (per the spec's explicit "flag + exclude, not flag + estimate" decision).
- `salesNet`/`collected` on `VendedoresRow` keep their existing meaning to every current consumer — they just now exclude flagged root-level invoices; excluded amounts are additive new fields, not a silent redefinition visible only in a diff.
- Route tests only assert the auth gate (401 unauthenticated), matching this codebase's convention.
- New e2e tests are tagged `@mssql`, added to `e2e/vendedores-consignment.spec.ts`, run via `bun run e2e:mssql`.

---

## File Structure

- **Modify:** `app/api/dwh/vendedores/route.ts` — add consignment detection, split totals, add the audit-list `section=excluded` query.
- **Create:** `app/api/dwh/vendedores/consignment.ts` — pure `isConsignmentPattern(salesOnRoot, totalSales, threshold)` function, isolated for unit testing.
- **Create:** `app/api/dwh/vendedores/__tests__/consignment.test.ts`
- **Modify:** `app/api/dwh/vendedores/__tests__/route.test.ts` — unchanged shape, already covers the auth gate; no new test needed here since the auth gate itself doesn't change (confirmed no modification needed beyond what already exists).
- **Modify:** `app/(app)/analitica/types.ts` — extend `VendedoresRow`, add `VendedoresExcludedInvoice`/`VendedoresExcludedResponse`.
- **Modify:** `app/(app)/analitica/tabs/tab-vendedores.tsx` — render the exclusion footnote + expandable invoice list.
- **Create:** `e2e/vendedores-consignment.spec.ts`.

---

### Task 1: Consignment-pattern detection pure function

**Files:**
- Create: `app/api/dwh/vendedores/consignment.ts`
- Test: `app/api/dwh/vendedores/__tests__/consignment.test.ts`

**Interfaces:**
- Produces: `isConsignmentPattern(salesOnRoot: number, totalSales: number, threshold: number): boolean` and `DEFAULT_ROOT_SHARE_THRESHOLD = 0.15` — consumed by Task 2's route changes.

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/dwh/vendedores/__tests__/consignment.test.ts
import { describe, test, expect } from 'bun:test';
import { isConsignmentPattern, DEFAULT_ROOT_SHARE_THRESHOLD } from '../consignment';

describe('isConsignmentPattern', () => {
  test('flags a chain with 90% root-billed sales (Excelsior Gama-like)', () => {
    expect(isConsignmentPattern(17_847_304.71, 19_767_993.52, DEFAULT_ROOT_SHARE_THRESHOLD)).toBe(true);
  });

  test('does not flag a chain billed correctly per-tienda (1% root share)', () => {
    expect(isConsignmentPattern(142_407.05, 13_566_849.56, DEFAULT_ROOT_SHARE_THRESHOLD)).toBe(false);
  });

  test('does not flag a chain with zero total sales (avoid divide-by-zero false positive)', () => {
    expect(isConsignmentPattern(0, 0, DEFAULT_ROOT_SHARE_THRESHOLD)).toBe(false);
  });

  test('respects a custom threshold', () => {
    expect(isConsignmentPattern(30, 100, 0.5)).toBe(false);
    expect(isConsignmentPattern(60, 100, 0.5)).toBe(true);
  });

  test('boundary: exactly at threshold counts as flagged (>=, not >)', () => {
    expect(isConsignmentPattern(15, 100, 0.15)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/vendedores/__tests__/consignment.test.ts`
Expected: FAIL with "Cannot find module '../consignment'"

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/dwh/vendedores/consignment.ts
export const DEFAULT_ROOT_SHARE_THRESHOLD = 0.15;

export function isConsignmentPattern(salesOnRoot: number, totalSales: number, threshold: number): boolean {
  if (totalSales <= 0) return false;
  return salesOnRoot / totalSales >= threshold;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/vendedores/__tests__/consignment.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/dwh/vendedores/consignment.ts app/api/dwh/vendedores/__tests__/consignment.test.ts
git commit -m "feat: add consignment-pattern detection function"
```

---

### Task 2: Types for excluded amounts and audit list

**Files:**
- Modify: `app/(app)/analitica/types.ts`

**Interfaces:**
- Produces: extended `VendedoresRow` (adds `excludedSalesNet`, `excludedCollected`, `excludedInvoiceCount`), new `VendedoresExcludedInvoice`, `VendedoresExcludedResponse` — consumed by Task 3 (route) and Task 4 (tab).

- [ ] **Step 1: Modify `VendedoresRow` and add new types**

```typescript
// app/(app)/analitica/types.ts — replace the existing VendedoresRow block with:
export interface VendedoresRow {
  value: string; // SalesRepKey, stringified — used as parentValue for breakdown fetches
  name: string;
  salesNet: number;
  returnsNet: number;
  returnRate: number | null;
  collectionRate: number | null;
  avgDiscount: number | null;
  // Amounts excluded from salesNet/collected above because they came from a
  // root-billed invoice of a chain flagged as a consignment-billing pattern
  // (see docs/superpowers/specs/2026-09-21-consignment-commission-exclusion-design.md).
  // Zero for a seller with no flagged exclusions.
  excludedSalesNet: number;
  excludedCollected: number;
  excludedInvoiceCount: number;
}

export interface VendedoresResponse {
  rows: VendedoresRow[];
  usdRate: number | null;
}

// Vendedores tab — audit list behind a seller row's excludedSalesNet figure:
// the literal invoices pulled out of that seller's reliable totals.
export interface VendedoresExcludedInvoice {
  legalEntityName: string;
  invoiceNumber: string;
  invoiceDate: string; // ISO date
  amountNet: number;
}

export interface VendedoresExcludedResponse {
  invoices: VendedoresExcludedInvoice[];
}
```

(This replaces the existing `VendedoresRow`/`VendedoresResponse` interfaces in place — same file, same location, just extended.)

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: errors in `app/api/dwh/vendedores/route.ts` and `tab-vendedores.tsx` (they construct/consume `VendedoresRow` without the three new required fields) — this is expected at this point in the plan; Tasks 3 and 4 fix it.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/analitica/types.ts
git commit -m "feat: extend VendedoresRow with consignment exclusion fields"
```

---

### Task 3: Route changes — detection, exclusion, audit query

**Files:**
- Modify: `app/api/dwh/vendedores/route.ts`

**Interfaces:**
- Consumes: `isConsignmentPattern`, `DEFAULT_ROOT_SHARE_THRESHOLD` from `./consignment` (Task 1); `VendedoresRow`, `VendedoresResponse`, `VendedoresExcludedInvoice`, `VendedoresExcludedResponse` from `@/app/(app)/analitica/types` (Task 2).
- Produces: `GET` handler gains `rootShareThreshold` query param and `section=excluded`+`salesRepKey` for the audit list. Consumed by Task 4 (tab).

- [ ] **Step 1: Read the current file to confirm line numbers before editing**

Run: `grep -n "" app/api/dwh/vendedores/route.ts | tail -5` to confirm the file is still the 105-line version already read earlier in this session (no other change should have touched it).

- [ ] **Step 2: Rewrite the route**

Replace the full contents of `app/api/dwh/vendedores/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimensionForFact, jsonWithCache, type Dimension } from '@/app/api/dwh/lib/query-builder';
import { isConsignmentPattern, DEFAULT_ROOT_SHARE_THRESHOLD } from './consignment';
import type { VendedoresResponse, VendedoresRow, VendedoresExcludedInvoice, VendedoresExcludedResponse } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.
//
// Consignment-pattern exclusion: see docs/superpowers/specs/
// 2026-09-21-consignment-commission-exclusion-design.md. A multi-tienda
// legal entity is flagged when its share of sales billed at the ROOT
// customer code (rather than individual tienda codes) meets or exceeds
// rootShareThreshold. Flagged entities' root-level invoices are excluded
// from a seller's "reliable" salesNet/collected totals and surfaced
// separately as excludedSalesNet/excludedCollected — never estimated or
// redistributed across sellers.

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

// Per legal-entity root-billing ratio, scoped to the current date range —
// recomputed per request rather than persisted, since this is a reporting
// judgment (tunable threshold) not a stable ERP fact.
function consignmentFlagsQuery(dateWhere: string): string {
  return `
    SELECT
      le.LegalEntityKey,
      SUM(CASE WHEN c.CustomerCode = le.RootCustomerCode THEN fs.NetAmount ELSE 0 END) AS SalesOnRoot,
      SUM(fs.NetAmount) AS TotalSales
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    WHERE fs.IsVoided = 0 AND le.StoreCount > 1 ${dateWhere}
    GROUP BY le.LegalEntityKey
    HAVING SUM(fs.NetAmount) > 0
  `;
}

// Per-seller sales/returns, split by whether the invoice's own customer
// belongs to a flagged entity AND was billed at that entity's root code
// (only the ambiguous root-level invoices are excluded — a flagged chain's
// normally-billed tienda invoices still count normally).
function salesRepQuery(salesDateWhere: string, returnsDateWhere: string, collectionsDateWhere: string, flaggedRootCodes: string[]): string {
  const flaggedCase = flaggedRootCodes.length > 0
    ? `CASE WHEN c.CustomerCode IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')}) THEN 1 ELSE 0 END`
    : '0';
  return `
    SELECT
      CAST(fs.SalesRepKey AS varchar(20)) AS SalesRepKeyValue,
      ISNULL(r.SalesRepName, r.SalesRepCode) AS Name,
      SUM(CASE WHEN ${flaggedCase} = 0 THEN fs.NetAmount ELSE 0 END) AS SalesNet,
      SUM(CASE WHEN ${flaggedCase} = 1 THEN fs.NetAmount ELSE 0 END) AS ExcludedSalesNet,
      SUM(CASE WHEN ${flaggedCase} = 1 THEN 1 ELSE 0 END) AS ExcludedInvoiceCount,
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNet,
      (SELECT ISNULL(SUM(fc.AmountCollected), 0)
         FROM fact.Fact_Collections fc
         JOIN dim.Dim_Customer cc ON cc.CustomerKey = fc.CustomerKey
         WHERE fc.SalesRepKey = fs.SalesRepKey AND fc.IsVoided = 0 ${collectionsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `cc.CustomerCode NOT IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 1'}
      ) AS Collected,
      (SELECT ISNULL(SUM(fc.AmountCollected), 0)
         FROM fact.Fact_Collections fc
         JOIN dim.Dim_Customer cc ON cc.CustomerKey = fc.CustomerKey
         WHERE fc.SalesRepKey = fs.SalesRepKey AND fc.IsVoided = 0 ${collectionsDateWhere}
           AND ${flaggedRootCodes.length > 0 ? `cc.CustomerCode IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})` : '1 = 0'}
      ) AS ExcludedCollected
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
    ORDER BY SalesNet DESC
  `;
}

// Fact_Sales has no SalesDate column — only DateKey (int, FK to
// dim.Dim_Date), so this joins Dim_Date for FullDate, same pattern as
// app/api/dwh/clientes/route.ts's churnedQuery.
function excludedInvoicesQuery(salesDateWhere: string, flaggedRootCodes: string[]): string {
  return `
    SELECT c.CustomerName AS LegalEntityName, fs.InvoiceNumber, d.FullDate AS SalesDate, SUM(fs.NetAmount) AS NetAmount
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey ${salesDateWhere}
      AND c.CustomerCode IN (${flaggedRootCodes.map((_, i) => `@flaggedRoot${i}`).join(', ')})
    GROUP BY c.CustomerName, fs.InvoiceNumber, d.FullDate
    ORDER BY d.FullDate DESC
  `;
}

async function getFlaggedRootCodes(dateWhere: string, rootShareThreshold: number): Promise<string[]> {
  const pool = await getDwhPool();
  const result = await pool.request().query(consignmentFlagsQuery(dateWhere));
  const flaggedEntityKeys = result.recordset
    .filter(r => isConsignmentPattern(Number(r.SalesOnRoot), Number(r.TotalSales), rootShareThreshold))
    .map(r => Number(r.LegalEntityKey));

  if (flaggedEntityKeys.length === 0) return [];

  const rootReq = pool.request();
  const placeholders = flaggedEntityKeys.map((_, i) => {
    rootReq.input(`entityKey${i}`, flaggedEntityKeys[i]);
    return `@entityKey${i}`;
  });
  const rootResult = await rootReq.query(`
    SELECT RootCustomerCode FROM dim.Dim_LegalEntity WHERE LegalEntityKey IN (${placeholders.join(', ')})
  `);
  return rootResult.recordset.map(r => String(r.RootCustomerCode).trim());
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const rootShareThresholdParam = Number(searchParams.get('rootShareThreshold') ?? DEFAULT_ROOT_SHARE_THRESHOLD);
  const rootShareThreshold = Number.isFinite(rootShareThresholdParam) ? rootShareThresholdParam : DEFAULT_ROOT_SHARE_THRESHOLD;

  const breakdownByParam = searchParams.get('breakdownBy');
  const breakdownBy: Dimension | null = isDimensionForFact(breakdownByParam, 'sales') ? breakdownByParam : null;
  const parentValue = searchParams.get('parentValue');

  try {
    const pool = await getDwhPool();

    if (breakdownBy && parentValue && /^\d+$/.test(parentValue)) {
      const salesDateWhereForBreakdown = buildDateWhereClause(dateRange, 'fs');
      const req = pool.request();
      req.input('salesRepKey', Number(parentValue));
      const result = await req.query(breakdownQuery(breakdownBy, salesDateWhereForBreakdown));
      return jsonWithCache({
        breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), salesNet: Number(r.SalesNet) })),
      });
    }

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
    const collectionsDateWhere = buildDateWhereClause(dateRange, 'fc');

    const flaggedRootCodes = await getFlaggedRootCodes(salesDateWhere, rootShareThreshold);

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
        amountNet: Number(r.NetAmount),
      }));
      const response: VendedoresExcludedResponse = { invoices };
      return jsonWithCache(response);
    }

    const salesReq = pool.request();
    flaggedRootCodes.forEach((code, i) => salesReq.input(`flaggedRoot${i}`, code));

    const [salesReps, usdRate] = await Promise.all([
      salesReq.query(salesRepQuery(salesDateWhere, returnsDateWhere, collectionsDateWhere, flaggedRootCodes)),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

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
        excludedSalesNet: Number(r.ExcludedSalesNet),
        excludedCollected: Number(r.ExcludedCollected),
        excludedInvoiceCount: Number(r.ExcludedInvoiceCount),
      };
    });

    const response: VendedoresResponse = { rows, usdRate };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```

Note: `Fact_Sales` is line-grain (`UQ_Fact_Sales_Invoice_Line (InvoiceNumber, LineNumber)` per `dwh-migrations/0009_fact_sales.sql`), so `excludedInvoicesQuery` aggregates with `SUM(fs.NetAmount)` grouped by invoice — otherwise it would emit one row per line instead of per invoice. Confirmed `InvoiceNumber` exists directly on `Fact_Sales`, and `DateKey` (not a `SalesDate` column) is the date FK, joined to `dim.Dim_Date` for `FullDate` — same pattern as `app/api/dwh/clientes/route.ts`'s `churnedQuery`.

- [ ] **Step 3: Run the existing auth-gate test**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/vendedores/__tests__/route.test.ts`
Expected: PASS (unchanged — this test doesn't touch the new logic)

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors now that both the route and types are updated consistently.

- [ ] **Step 5: Commit**

```bash
git add app/api/dwh/vendedores/route.ts
git commit -m "feat: exclude consignment-pattern invoices from seller commission totals"
```

---

### Task 4: Tab UI — exclusion footnote and audit list

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-vendedores.tsx`

**Interfaces:**
- Consumes: `VendedoresExcludedResponse` from `@/app/(app)/analitica/types` (Task 2); existing `VendedoresRow` (now with the three new fields).

- [ ] **Step 1: Add exclusion state and fetch logic, and a footnote row**

Modify `app/(app)/analitica/tabs/tab-vendedores.tsx`. Add imports and state:

```typescript
// add to the existing type import line
import type { BreakdownRow, Currency, DateRange, PivotDimension, VendedoresResponse, VendedoresRow, VendedoresExcludedResponse } from '../types';
```

Add state and a fetch handler inside the component body (after the existing `breakdownBy` state):

```typescript
  const [excludedExpandedFor, setExcludedExpandedFor] = useState<string | null>(null);
  const [excludedData, setExcludedData] = useState<VendedoresExcludedResponse | null>(null);
  const [excludedLoading, setExcludedLoading] = useState(false);

  async function handleToggleExcluded(salesRepValue: string) {
    if (excludedExpandedFor === salesRepValue) {
      setExcludedExpandedFor(null);
      return;
    }
    setExcludedExpandedFor(salesRepValue);
    setExcludedData(null);
    setExcludedLoading(true);
    try {
      const params = new URLSearchParams({ dateRange, currency, section: 'excluded', parentValue: salesRepValue });
      const res = await fetch(`/api/dwh/vendedores?${params.toString()}`);
      if (res.ok) setExcludedData(await res.json());
    } finally {
      setExcludedLoading(false);
    }
  }
```

- [ ] **Step 2: Render the footnote and expandable list beneath the table**

Replace the final render block (from `if (loading)` through the end of the component) with:

```typescript
  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <EmptyState />
      </div>
    );
  }

  const rowsWithExclusions = rows.filter(r => r.excludedSalesNet > 0);

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-900">Desempeño por vendedor</h2>
        <p className="text-xs text-gray-500 mb-3">
          Ventas netas, devoluciones y cobranza por representante de ventas
        </p>
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <GroupedDrilldownTable<VendedoresTableRow>
            rows={rows}
            columns={columns}
            groupByOptions={GROUP_BY_OPTIONS}
            groupBy="vendedor"
            onGroupByChange={() => {}}
            breakdownByOptions={BREAKDOWN_BY_OPTIONS}
            breakdownBy={breakdownBy}
            onBreakdownByChange={setBreakdownBy}
            onFetchBreakdown={handleFetchBreakdown}
            formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, rate) : String(value ?? '—'))}
          />
        )}
      </div>

      {rowsWithExclusions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-1">Facturas excluidas — patrón de consignación</h2>
          <p className="text-xs text-gray-500 mb-3">
            Estas facturas se facturaron de forma agregada a nivel de cadena (no por tienda individual),
            por lo que no es posible atribuir de forma confiable qué vendedor generó la venta. Se
            excluyen de las ventas/cobranza del vendedor arriba en vez de estimarse.
          </p>
          <ul className="space-y-2">
            {rowsWithExclusions.map(row => (
              <li key={row.value} className="text-sm">
                <button
                  onClick={() => handleToggleExcluded(row.value)}
                  className="text-amber-700 hover:text-amber-900 underline"
                >
                  {row.name}: {moneyLabel(row.excludedSalesNet, currency, rate)} excluidos ({row.excludedInvoiceCount} facturas)
                </button>
                {excludedExpandedFor === row.value && (
                  <div className="mt-2 ml-4 text-xs">
                    {excludedLoading ? (
                      <div className="text-gray-400 py-1">Cargando…</div>
                    ) : !excludedData || excludedData.invoices.length === 0 ? (
                      <div className="text-gray-400 py-1">Sin facturas.</div>
                    ) : (
                      <table className="min-w-full">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left pr-4 py-1">Entidad</th>
                            <th className="text-left pr-4 py-1">Factura</th>
                            <th className="text-left pr-4 py-1">Fecha</th>
                            <th className="text-right py-1">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excludedData.invoices.map((inv, i) => (
                            <tr key={`${inv.invoiceNumber}-${i}`} className="text-gray-700">
                              <td className="pr-4 py-1">{inv.legalEntityName}</td>
                              <td className="pr-4 py-1">{inv.invoiceNumber}</td>
                              <td className="pr-4 py-1">{inv.invoiceDate}</td>
                              <td className="text-right py-1">{moneyLabel(inv.amountNet, currency, rate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: no errors

- [ ] **Step 4: Manual smoke test**

Run `bun --bun run dev`, log in as admin, go to `/analitica?tab=vendedores`. If Excelsior Gama's seller shows exclusions in the live test DWH, confirm the footnote section appears and expands to a per-invoice list.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/analitica/tabs/tab-vendedores.tsx
git commit -m "feat: show consignment exclusion footnote in Vendedores tab"
```

---

### Task 5: E2E coverage

**Files:**
- Create: `e2e/vendedores-consignment.spec.ts`

- [ ] **Step 1: Write the e2e spec**

```typescript
// e2e/vendedores-consignment.spec.ts
import { test, expect } from './fixtures';

// @mssql — requires the profitplus-erp-mock container with DWH_AlimentosNY
// migrated and loaded, including the real Excelsior Gama consignment-
// pattern data verified during spec design (~90% of its sales billed at
// its root customer code). See e2e/analitica.spec.ts's header comment for
// the general DWH e2e setup this file relies on.

test.describe('vendedores-consignment @mssql', () => {
  test('a seller with consignment exclusions shows the exclusion footnote and its invoice list', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=vendedores');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const footnoteHeading = adminPage.getByRole('heading', { name: 'Facturas excluidas — patrón de consignación' });
    // This section only renders when at least one seller has exclusions —
    // assert conditionally so the test doesn't fail on a DWH snapshot where
    // Excelsior Gama data isn't in the current date range.
    const isVisible = await footnoteHeading.isVisible().catch(() => false);
    test.skip(!isVisible, 'No seller has consignment exclusions in the current 12m default range — nothing to assert.');

    await expect(footnoteHeading).toBeVisible();
    const firstExclusionButton = adminPage.locator('button', { hasText: 'excluidos' }).first();
    await firstExclusionButton.click();

    await expect(adminPage.locator('table').filter({ hasText: 'Factura' })).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Run the e2e spec against the real DWH**

Run: `bun run e2e:mssql -- vendedores-consignment`
Expected: PASS (either asserting the footnote/list, or skipping cleanly if the current date range has no flagged exclusions — check which occurred and confirm it matches the live data verified during spec design, i.e. Excelsior Gama's invoices should fall in a `12m` trailing window from the current date if their `fec_emis` values are recent).

- [ ] **Step 3: Commit**

```bash
git add e2e/vendedores-consignment.spec.ts
git commit -m "test: add e2e coverage for consignment commission exclusion"
```

---

### Task 6: Full verification pass

- [ ] **Step 1: Run the full unit test suite**

Run: `bun run test:unit`
Expected: all tests PASS, including `consignment.test.ts` and the unchanged `route.test.ts`.

- [ ] **Step 2: Run lint**

Run: `bun run lint`
Expected: no errors.

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full default e2e suite (non-mssql)**

Run: `bun run e2e`
Expected: all existing tests still PASS.

- [ ] **Step 5: Run the mssql e2e suite**

Run: `bun run e2e:mssql`
Expected: all tests PASS, including `vendedores-consignment.spec.ts` and the pre-existing `analitica.spec.ts` Vendedores test (confirm the pre-existing "expanding a Vendedores row loads a product breakdown" test in `e2e/analitica.spec.ts` still passes — the route change must not have broken the existing breakdown-by-producto/tienda path).

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address verification findings for consignment commission exclusion"
```
