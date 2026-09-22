# Seller × Depth-of-Line Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Profundidad de Línea tab (from the Depth of Line plan) with a seller filter that scopes the matrix to one seller's own entities/sales, and a seller-comparison leaderboard showing each seller's own penetration rate against the company-wide baseline, so coverage gaps can be attributed to a specific seller's book.

**Architecture:** Add a `salesRepKey` query param to the existing `app/api/dwh/profundidad-linea/route.ts` (from the Depth of Line plan) that re-scopes the matrix's entity/sales denominators to that seller's own touched entities. Add a new `section=leaderboard` query computing each seller's pooled penetration against the global tier list. New leaderboard UI renders above the existing matrix in `tab-profundidad.tsx`.

**Tech Stack:** Next.js 16 App Router, TypeScript, `mssql` against `DWH_AlimentosNY`, Bun test, Playwright e2e (`@mssql`-tagged).

**Spec:** `docs/superpowers/specs/2026-09-21-seller-depth-of-line-coverage-design.md`

## Global Constraints

- **Depends on the Depth of Line plan** (`docs/superpowers/plans/2026-09-21-profundidad-linea-tab.md`) being implemented first — this plan modifies files that plan creates (`app/api/dwh/profundidad-linea/route.ts`, `app/(app)/analitica/tabs/tab-profundidad.tsx`, `app/(app)/analitica/types.ts`'s `DepthMatrixRow`/`DepthMatrixResponse`). Do not start this plan until that one's Task 6 (full verification pass) is green.
- Seller attribution uses `Fact_Sales.SalesRepKey` (actual seller per sale), never `Dim_Customer.DefaultSalesRepCode` — confirmed with user, for consistency with commission attribution (Plan 2).
- When `salesRepKey` scopes the matrix, `entitiesActive` in each `DepthMatrixCell` means "entities this seller sold anything to," not "all entities in the segment" — a seller who legitimately covers a handful of accounts must not show artificially low penetration against the whole market.
- All ERP/DWH `mssql` queries use `.input()` for every user-controlled value.
- Route tests only assert the auth gate, matching this codebase's convention.
- New e2e tests are tagged `@mssql`, added to `e2e/profundidad-linea-vendedor.spec.ts`.

---

## File Structure

- **Modify:** `app/api/dwh/profundidad-linea/route.ts` — add `salesRepKey` scoping to the matrix query and a new `section=leaderboard` handler.
- **Modify:** `app/(app)/analitica/types.ts` — add `SellerCoverageRow`, `SellerCoverageResponse`; add optional `salesRepKey` echo field to `DepthMatrixResponse`.
- **Modify:** `app/(app)/analitica/tabs/tab-profundidad.tsx` — add seller filter dropdown and leaderboard card.
- **Create:** `e2e/profundidad-linea-vendedor.spec.ts`.

---

### Task 1: Types for seller coverage

**Files:**
- Modify: `app/(app)/analitica/types.ts`

**Interfaces:**
- Produces: `SellerCoverageRow`, `SellerCoverageResponse` — consumed by Task 2 (route) and Task 3 (tab). Also extends `DepthMatrixResponse` with an optional `scopedToSalesRep` field.

- [ ] **Step 1: Add the new types and extend `DepthMatrixResponse`**

In `app/(app)/analitica/types.ts`, modify the existing `DepthMatrixResponse` (added by the Depth of Line plan) to add one field, and append the new seller-coverage types after it:

```typescript
export interface DepthMatrixResponse {
  rows: DepthMatrixRow[];
  groupBy: GroupBy;
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  usdRate: number | null;
  // Echoes the salesRepKey filter applied, if any — lets the UI label the
  // matrix clearly ("Mostrando solo clientes de: Juan Pérez") when scoped.
  // See docs/superpowers/specs/2026-09-21-seller-depth-of-line-coverage-design.md.
  scopedToSalesRepName: string | null;
}

// Seller coverage leaderboard — one row per seller, comparing their own
// pooled penetration (over entities/products they personally touched)
// against the company-wide baseline from the unscoped matrix.
export interface SellerCoverageRow {
  salesRepKey: string;
  salesRepName: string;
  entitiesServed: number;
  ownPenetration: number | null;      // this seller's pooled penetration across their own entities
  baselinePenetration: number | null; // company-wide pooled penetration, for comparison
  gapVsBaseline: number | null;       // ownPenetration - baselinePenetration; negative = underperforming
}

export interface SellerCoverageResponse {
  rows: SellerCoverageRow[];
  usdRate: number | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: errors in `app/api/dwh/profundidad-linea/route.ts` (constructs `DepthMatrixResponse` without the new required field) — expected at this point; Task 2 fixes it.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/analitica/types.ts
git commit -m "feat: add seller coverage types for Profundidad de Línea"
```

---

### Task 2: Pure gap calculation function

**Files:**
- Create: `app/api/dwh/profundidad-linea/seller-coverage.ts`
- Test: `app/api/dwh/profundidad-linea/__tests__/seller-coverage.test.ts`

**Interfaces:**
- Produces: `computeGapVsBaseline(ownPenetration: number | null, baselinePenetration: number | null): number | null` — consumed by Task 3 (route).

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/dwh/profundidad-linea/__tests__/seller-coverage.test.ts
import { describe, test, expect } from 'bun:test';
import { computeGapVsBaseline } from '../seller-coverage';

describe('computeGapVsBaseline', () => {
  test('positive gap when seller outperforms baseline', () => {
    expect(computeGapVsBaseline(0.8, 0.6)).toBeCloseTo(0.2);
  });

  test('negative gap when seller underperforms baseline', () => {
    expect(computeGapVsBaseline(0.4, 0.6)).toBeCloseTo(-0.2);
  });

  test('null when either input is null', () => {
    expect(computeGapVsBaseline(null, 0.6)).toBeNull();
    expect(computeGapVsBaseline(0.4, null)).toBeNull();
    expect(computeGapVsBaseline(null, null)).toBeNull();
  });

  test('zero gap when equal to baseline', () => {
    expect(computeGapVsBaseline(0.5, 0.5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/profundidad-linea/__tests__/seller-coverage.test.ts`
Expected: FAIL with "Cannot find module '../seller-coverage'"

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/dwh/profundidad-linea/seller-coverage.ts
export function computeGapVsBaseline(ownPenetration: number | null, baselinePenetration: number | null): number | null {
  if (ownPenetration === null || baselinePenetration === null) return null;
  return ownPenetration - baselinePenetration;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/profundidad-linea/__tests__/seller-coverage.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/dwh/profundidad-linea/seller-coverage.ts app/api/dwh/profundidad-linea/__tests__/seller-coverage.test.ts
git commit -m "feat: add seller coverage gap calculation function"
```

---

### Task 3: Route changes — seller scoping and leaderboard

**Files:**
- Modify: `app/api/dwh/profundidad-linea/route.ts`

**Interfaces:**
- Consumes: `computeGapVsBaseline` from `./seller-coverage` (Task 2); `SellerCoverageRow`, `SellerCoverageResponse` from `@/app/(app)/analitica/types` (Task 1); existing `classifyTier`, `DEFAULT_TIER_THRESHOLDS` from `./tier` (Depth of Line plan Task 1); existing `matrixQuery`/`activeTotalsBySegmentQuery`/`handleMatrix` (Depth of Line plan Task 3).
- Produces: `GET` handler gains `salesRepKey` query param (scopes the matrix) and `section=leaderboard` (returns `SellerCoverageResponse`). Consumed by Task 4 (tab).

- [ ] **Step 1: Add a `salesRepKey`-aware variant of the matrix and totals queries**

Modify `app/api/dwh/profundidad-linea/route.ts`. Add two new query-building functions near the existing `matrixQuery`/`activeTotalsBySegmentQuery`:

```typescript
// Same shape as matrixQuery, but scoped to one seller's own sales — used
// when salesRepKey is present. See docs/superpowers/specs/
// 2026-09-21-seller-depth-of-line-coverage-design.md.
function matrixQueryForSeller(groupBy: DepthGroupBy, dateWhere: string, scopeWhere: string): string {
  const labelExpr = labelExprFor(groupBy);
  return `
    SELECT
      ${labelExpr} AS GroupLabel,
      c.SegmentCode AS SegmentCode,
      COUNT(DISTINCT c.LegalEntityKey) AS EntitiesBuying,
      SUM(fs.NetAmount) AS SalesNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey AND c.SegmentCode IN ('CADENA', 'INDEPENDIENTES') ${dateWhere} ${scopeWhere}
    GROUP BY ${labelExpr}, c.SegmentCode
  `;
}

// Denominator when scoped to a seller: entities THIS SELLER sold anything
// to (any product) in range, per segment — not the whole segment's active
// entities. This is what makes the scoped view answer "am I covering my
// own accounts well" rather than "am I covering the whole market."
function activeTotalsBySegmentForSellerQuery(dateWhere: string): string {
  return `
    SELECT c.SegmentCode AS SegmentCode, COUNT(DISTINCT c.LegalEntityKey) AS TotalEntities
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND fs.SalesRepKey = @salesRepKey AND c.SegmentCode IN ('CADENA', 'INDEPENDIENTES') ${dateWhere}
    GROUP BY c.SegmentCode
  `;
}
```

- [ ] **Step 2: Thread `salesRepKey` through `handleMatrix`**

Modify the existing `handleMatrix` function's signature and body to accept an optional `salesRepKey: number | null` and `salesRepName: string | null`, and pick the seller-scoped queries/inputs when present:

```typescript
async function handleMatrix(
  dateWhere: string,
  groupBy: DepthGroupBy,
  linea: string | null,
  sublinea: string | null,
  currency: string,
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
    const salesNet = Number(r.SalesNet);
    const entitiesActive = totalsBySegment.get(segment) ?? 0;

    let row = byLabel.get(label);
    if (!row) {
      row = { label, value: label, cells: [], totalPenetration: null, totalSalesNet: 0, tier: 'sin-ventas' };
      byLabel.set(label, row);
    }
    row.cells.push({
      segment,
      entitiesBuying,
      entitiesActive,
      penetration: entitiesActive > 0 ? entitiesBuying / entitiesActive : null,
      salesNet,
    });
    row.totalSalesNet += salesNet;
  }

  const totalEntitiesActive = SEGMENTS.reduce((sum, s) => sum + (totalsBySegment.get(s) ?? 0), 0);

  const rows: DepthMatrixRow[] = Array.from(byLabel.values()).map(row => {
    const totalEntitiesBuying = row.cells.reduce((sum, c) => sum + c.entitiesBuying, 0);
    const totalPenetration = totalEntitiesActive > 0 ? totalEntitiesBuying / totalEntitiesActive : null;
    return {
      ...row,
      totalPenetration,
      tier: classifyTier(totalPenetration, row.totalSalesNet > 0, thresholds),
    };
  }).sort((a, b) => b.totalSalesNet - a.totalSalesNet);

  const usdRate = currency === 'usd' ? await getUsdRate() : null;

  const breadcrumb: DepthMatrixResponse['breadcrumb'] = [{ label: 'Líneas', groupBy: 'linea' }];
  if (groupBy === 'sublinea' || groupBy === 'sku') breadcrumb.push({ label: linea as string, groupBy: 'sublinea' });
  if (groupBy === 'sku') breadcrumb.push({ label: sublinea as string, groupBy: 'sku' });

  const response: DepthMatrixResponse = { rows, groupBy: groupBy as GroupBy, breadcrumb, usdRate, scopedToSalesRepName: salesRepName };
  return jsonWithCache(response);
}
```

(This replaces the Depth of Line plan's original `handleMatrix` in place — same function name, extended signature.)

- [ ] **Step 3: Add the leaderboard query and handler**

Add near the other query functions:

```typescript
// Seller leaderboard: for each seller, how many of their own (entity,
// tiered product) pairs are actually covered, against the tiered product
// set computed from the UNSCOPED matrix (passed in as tieredLineNames —
// the caller runs the unscoped handleMatrix-equivalent computation first
// and extracts which línea labels classify as primera/segunda).
function sellerCoverageQuery(dateWhere: string, tieredLineNames: string[]): string {
  const linePlaceholders = tieredLineNames.map((_, i) => `@tieredLine${i}`).join(', ');
  return `
    SELECT
      CAST(fs.SalesRepKey AS varchar(20)) AS SalesRepKey,
      ISNULL(r.SalesRepName, r.SalesRepCode) AS SalesRepName,
      COUNT(DISTINCT c.LegalEntityKey) AS EntitiesServed,
      COUNT(DISTINCT CONCAT(c.LegalEntityKey, '|', p.ProductKey)) AS TieredProductsCovered
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 AND ISNULL(p.LineName, '${NO_LINEA}') IN (${linePlaceholders}) ${dateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
  `;
}

async function handleLeaderboard(dateWhere: string, currency: string, thresholds: TierThresholds): Promise<NextResponse> {
  const pool = await getDwhPool();

  // Step 1: compute the unscoped, línea-level matrix to find the tiered line set.
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
    entry.salesNet += Number(r.SalesNet);
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
    const usdRate = currency === 'usd' ? await getUsdRate() : null;
    const response: SellerCoverageResponse = { rows: [], usdRate };
    return jsonWithCache(response);
  }

  // Step 2: for each seller, how many (entity, tiered-line-product) pairs did they cover.
  const req = pool.request();
  tieredLineNames.forEach((name, i) => req.input(`tieredLine${i}`, name));
  const sellerResult = await req.query(sellerCoverageQuery(dateWhere, tieredLineNames));

  const rows: SellerCoverageRow[] = sellerResult.recordset.map(r => {
    const entitiesServed = Number(r.EntitiesServed);
    const tieredProductsCovered = Number(r.TieredProductsCovered);
    const maxPossible = entitiesServed * tieredLineNames.length;
    const ownPenetration = maxPossible > 0 ? tieredProductsCovered / maxPossible : null;
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

  const usdRate = currency === 'usd' ? await getUsdRate() : null;
  const response: SellerCoverageResponse = { rows, usdRate };
  return jsonWithCache(response);
}
```

- [ ] **Step 4: Wire the new imports, param parsing, and section dispatch into `GET`**

Add to the imports at the top of the file:

```typescript
import { computeGapVsBaseline } from './seller-coverage';
import type { SellerCoverageRow, SellerCoverageResponse } from '@/app/(app)/analitica/types';
```

In the `GET` function, add `salesRepKey`/`salesRepName` parsing after the existing threshold parsing, and add the `section === 'leaderboard'` branch and pass the seller params into `handleMatrix`:

```typescript
  const salesRepKeyParam = searchParams.get('salesRepKey');
  const salesRepKey = salesRepKeyParam && /^\d+$/.test(salesRepKeyParam) ? Number(salesRepKeyParam) : null;
  const salesRepName = searchParams.get('salesRepName');
```

```typescript
    if (searchParams.get('section') === 'leaderboard') {
      return await handleLeaderboard(dateWhere, currency, thresholds);
    }

    if (searchParams.get('section') === 'gap') {
      // ...unchanged...
    }

    return await handleMatrix(dateWhere, groupBy, lineaParam, sublineaParam, currency, thresholds, salesRepKey, salesRepName);
```

(Insert the `leaderboard` branch before the existing `gap` branch inside the same `try` block; update the final `handleMatrix` call to pass the two new arguments.)

- [ ] **Step 5: Run the existing auth-gate test**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/profundidad-linea/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/api/dwh/profundidad-linea/route.ts
git commit -m "feat: add seller-scoped matrix and coverage leaderboard to profundidad-linea"
```

---

### Task 4: Tab UI — seller filter and leaderboard

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-profundidad.tsx`

**Interfaces:**
- Consumes: `SellerCoverageResponse` from `@/app/(app)/analitica/types` (Task 1).

- [ ] **Step 1: Add seller list fetching, filter state, and the leaderboard card**

Modify `app/(app)/analitica/tabs/tab-profundidad.tsx`. Add to the type import:

```typescript
import type { Currency, DateRange, DepthMatrixResponse, DepthMatrixRow, DepthGapResponse, CustomerSegment, SellerCoverageResponse } from '../types';
```

Add state (alongside the existing `groupBy`/`linea`/etc. state):

```typescript
  const [salesRepKey, setSalesRepKey] = useState<string | null>(null);
  const [salesRepName, setSalesRepName] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<SellerCoverageResponse | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
```

Add a separate `useEffect` to load the leaderboard independent of the matrix filter state (it always shows the full, unscoped seller list per the spec):

```typescript
  useEffect(() => {
    let cancelled = false;
    async function loadLeaderboard() {
      setLeaderboardLoading(true);
      try {
        const params = new URLSearchParams({
          dateRange, currency, section: 'leaderboard',
          firstLineMinPenetration: String(firstLineMinPenetration),
          secondLineMinPenetration: String(secondLineMinPenetration),
        });
        const res = await fetch(`/api/dwh/profundidad-linea?${params.toString()}`);
        if (cancelled) return;
        if (res.ok) setLeaderboard(await res.json());
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    }
    loadLeaderboard();
    return () => { cancelled = true; };
  }, [dateRange, currency, firstLineMinPenetration, secondLineMinPenetration]);
```

Update the existing matrix-loading `useEffect`'s `params` construction to include `salesRepKey` when set:

```typescript
        if (linea) params.set('linea', linea);
        if (sublinea) params.set('sublinea', sublinea);
        if (salesRepKey) params.set('salesRepKey', salesRepKey);
```

and add `salesRepKey` to that `useEffect`'s dependency array.

- [ ] **Step 2: Render the leaderboard card above the matrix, and a "clear filter" affordance when scoped**

Insert this block right after the opening `<div className="p-6 max-w-7xl space-y-6">` and before the existing matrix card:

```tsx
      {!leaderboardLoading && leaderboard && leaderboard.rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-1">Cobertura por vendedor</h2>
          <p className="text-xs text-gray-500 mb-3">
            Penetración de productos primera/segunda línea en las entidades propias de cada vendedor, comparada con el promedio general
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Vendedor</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Entidades</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Penetración propia</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Promedio general</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Brecha</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaderboard.rows.map((row, i) => (
                  <tr key={row.salesRepKey} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2 text-gray-800">{row.salesRepName}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.entitiesServed}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(row.ownPenetration)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(row.baselinePenetration)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${row.gapVsBaseline !== null && row.gapVsBaseline < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {row.gapVsBaseline === null ? '—' : `${row.gapVsBaseline >= 0 ? '+' : ''}${(row.gapVsBaseline * 100).toFixed(0)}pp`}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => { setSalesRepKey(row.salesRepKey); setSalesRepName(row.salesRepName); }}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {salesRepKey && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Mostrando solo clientes de: <strong>{salesRepName}</strong></span>
          <button
            onClick={() => { setSalesRepKey(null); setSalesRepName(null); }}
            className="text-blue-600 hover:text-blue-800 underline text-xs"
          >
            Volver a vista general
          </button>
        </div>
      )}
```

- [ ] **Step 3: Typecheck and lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: no errors

- [ ] **Step 4: Manual smoke test**

Run `bun --bun run dev`, navigate to `/analitica?tab=profundidad`, confirm the leaderboard renders above the matrix, clicking "Ver detalle" scopes the matrix and shows the "Mostrando solo clientes de" banner, and "Volver a vista general" clears it.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/analitica/tabs/tab-profundidad.tsx
git commit -m "feat: add seller coverage leaderboard and filter to Profundidad de Línea tab"
```

---

### Task 5: E2E coverage

**Files:**
- Create: `e2e/profundidad-linea-vendedor.spec.ts`

- [ ] **Step 1: Write the e2e spec**

```typescript
// e2e/profundidad-linea-vendedor.spec.ts
import { test, expect } from './fixtures';

// @mssql — requires the profitplus-erp-mock container with DWH_AlimentosNY
// migrated and loaded. Depends on the Profundidad de Línea tab existing
// (see e2e/profundidad-linea.spec.ts for the base tab's own coverage).

test.describe('profundidad-linea-vendedor @mssql', () => {
  test('leaderboard renders and scoping to a seller updates the matrix', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');

    await expect(adminPage.getByRole('heading', { name: 'Cobertura por vendedor' })).toBeVisible({ timeout: 15_000 });
    const leaderboardSection = adminPage.locator('div', { has: adminPage.getByRole('heading', { name: 'Cobertura por vendedor' }) }).first();
    await expect(leaderboardSection.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstSellerName = await leaderboardSection.locator('table tbody tr').first().locator('td').first().textContent();
    await leaderboardSection.locator('table tbody tr').first().getByRole('button', { name: 'Ver detalle' }).click();

    await expect(adminPage.getByText(`Mostrando solo clientes de: ${firstSellerName}`)).toBeVisible({ timeout: 10_000 });

    await adminPage.getByRole('button', { name: 'Volver a vista general' }).click();
    await expect(adminPage.getByText('Mostrando solo clientes de:')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run the e2e spec against the real DWH**

Run: `bun run e2e:mssql -- profundidad-linea-vendedor`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/profundidad-linea-vendedor.spec.ts
git commit -m "test: add e2e coverage for seller depth-of-line coverage"
```

---

### Task 6: Full verification pass

- [ ] **Step 1: Run the full unit test suite**

Run: `bun run test:unit`
Expected: all tests PASS, including `seller-coverage.test.ts`.

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
Expected: all tests PASS, including `profundidad-linea-vendedor.spec.ts` and the base `profundidad-linea.spec.ts` (confirm the seller-scoping addition didn't break the unscoped matrix's existing behavior).

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address verification findings for seller depth-of-line coverage"
```
