# Depth of Line Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Profundidad de Línea" analytics tab showing, per product line/sublínea/SKU, penetration into each customer segment (CADENA vs INDEPENDIENTES) at the legal-entity grain, a drill-down listing exactly which entities in a segment are missing a product, and a first-line/second-line/addon classification driven by tunable thresholds.

**Architecture:** One new API route (`app/api/dwh/profundidad-linea/route.ts`) querying `Fact_Sales`/`Dim_Product`/`Dim_Customer`/`Dim_LegalEntity` (all already loaded, no DWH migration needed), one new tab component (`app/(app)/analitica/tabs/tab-profundidad.tsx`) registered in `analitica-client.tsx`, and new types in `app/(app)/analitica/types.ts`. Follows the exact conventions of `app/api/dwh/productos/route.ts` and `tab-productos.tsx` (breadcrumb drill, `requireDwhAccess`, `jsonWithCache`, `buildDateWhereClause`).

**Tech Stack:** Next.js 16 App Router, TypeScript, `mssql` against `DWH_AlimentosNY`, Bun test, Playwright e2e (`@mssql`-tagged, matching every other DWH tab's e2e convention).

**Spec:** `docs/superpowers/specs/2026-09-21-profundidad-linea-tab-design.md`

## Global Constraints

- All ERP/DWH `mssql` queries use `.input()` for every user-controlled value — never string-concatenate a param into SQL (per `AGENTS.md`).
- Every DWH route and page checks `hasDwhAccess`/`requireDwhAccess` independently — no shared middleware exists in this app.
- CSV/export helpers are out of scope here (no export needed for this tab).
- Money values follow `moneyLabel(n, currency, rate)` from `app/(app)/analitica/lib/format.ts` — never hand-format currency.
- Segment values are exactly `'CADENA' | 'INDEPENDIENTES'` (verified live, zero nulls among active customers) — do not add a third bucket for null/blank segments; exclude those rows instead.
- Penetration denominators use `Dim_LegalEntity`/`LegalEntityKey`, not raw `Dim_Customer` rows — a multi-tienda chain counts once.
- Threshold values (`firstLineMinPenetration`, `secondLineMinPenetration`) are query params with defaults, never hardcoded constants baked into a single reading.
- New route tests only assert the auth gate (401 unauthenticated), matching this codebase's existing DWH route test convention (see `app/api/dwh/vendedores/__tests__/route.test.ts`) — deeper query-shape testing happens via the e2e suite against the real DWH, not mocked unit tests.
- New e2e tests are tagged `@mssql` in their `describe` block name (e.g. `test.describe('profundidad-linea @mssql', ...)`) and go in `e2e/profundidad-linea.spec.ts`, run via `bun run e2e:mssql`, excluded from the default `bun run e2e`.

---

## File Structure

- **Create:** `app/api/dwh/profundidad-linea/route.ts` — the matrix, gap-list, and tier-classification queries/handlers.
- **Create:** `app/api/dwh/profundidad-linea/__tests__/route.test.ts` — auth-gate test.
- **Create:** `app/api/dwh/profundidad-linea/tier.ts` — pure tier-classification function, isolated for unit testing (mirrors `app/api/dwh/finanzas/margen-proxy.ts`'s isolation pattern).
- **Create:** `app/api/dwh/profundidad-linea/__tests__/tier.test.ts` — unit tests for the pure classification function.
- **Modify:** `app/(app)/analitica/types.ts` — add `CustomerSegment`, `DepthMatrixCell`, `DepthMatrixRow`, `DepthMatrixResponse`, `DepthGapEntity`, `DepthGapResponse`.
- **Create:** `app/(app)/analitica/tabs/tab-profundidad.tsx` — the tab component.
- **Modify:** `app/(app)/analitica/analitica-client.tsx` — register the new tab.
- **Create:** `e2e/profundidad-linea.spec.ts` — `@mssql`-tagged e2e coverage.

---

### Task 1: Tier classification pure function

**Files:**
- Create: `app/api/dwh/profundidad-linea/tier.ts`
- Test: `app/api/dwh/profundidad-linea/__tests__/tier.test.ts`

**Interfaces:**
- Produces: `classifyTier(penetration: number | null, hasAnySales: boolean, thresholds: { firstLineMinPenetration: number; secondLineMinPenetration: number }): 'primera' | 'segunda' | 'addon' | 'sin-ventas'` — consumed by Task 2's route handler.
- Produces: `DEFAULT_TIER_THRESHOLDS = { firstLineMinPenetration: 0.7, secondLineMinPenetration: 0.3 }` — consumed by Task 2.

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/dwh/profundidad-linea/__tests__/tier.test.ts
import { describe, test, expect } from 'bun:test';
import { classifyTier, DEFAULT_TIER_THRESHOLDS } from '../tier';

describe('classifyTier', () => {
  test('no sales in range classifies as sin-ventas regardless of penetration', () => {
    expect(classifyTier(0, false, DEFAULT_TIER_THRESHOLDS)).toBe('sin-ventas');
    expect(classifyTier(null, false, DEFAULT_TIER_THRESHOLDS)).toBe('sin-ventas');
  });

  test('penetration at or above the first-line threshold classifies as primera', () => {
    expect(classifyTier(0.7, true, DEFAULT_TIER_THRESHOLDS)).toBe('primera');
    expect(classifyTier(0.95, true, DEFAULT_TIER_THRESHOLDS)).toBe('primera');
  });

  test('penetration at or above the second-line threshold but below first-line classifies as segunda', () => {
    expect(classifyTier(0.3, true, DEFAULT_TIER_THRESHOLDS)).toBe('segunda');
    expect(classifyTier(0.69, true, DEFAULT_TIER_THRESHOLDS)).toBe('segunda');
  });

  test('penetration below the second-line threshold but with sales classifies as addon', () => {
    expect(classifyTier(0.01, true, DEFAULT_TIER_THRESHOLDS)).toBe('addon');
    expect(classifyTier(0, true, DEFAULT_TIER_THRESHOLDS)).toBe('addon');
  });

  test('null penetration with sales (zero active entities in denominator) classifies as addon', () => {
    expect(classifyTier(null, true, DEFAULT_TIER_THRESHOLDS)).toBe('addon');
  });

  test('custom thresholds are respected', () => {
    const custom = { firstLineMinPenetration: 0.5, secondLineMinPenetration: 0.1 };
    expect(classifyTier(0.5, true, custom)).toBe('primera');
    expect(classifyTier(0.2, true, custom)).toBe('segunda');
    expect(classifyTier(0.05, true, custom)).toBe('addon');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/profundidad-linea/__tests__/tier.test.ts`
Expected: FAIL with "Cannot find module '../tier'"

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/dwh/profundidad-linea/tier.ts
export type DepthTier = 'primera' | 'segunda' | 'addon' | 'sin-ventas';

export interface TierThresholds {
  firstLineMinPenetration: number;
  secondLineMinPenetration: number;
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  firstLineMinPenetration: 0.7,
  secondLineMinPenetration: 0.3,
};

export function classifyTier(
  penetration: number | null,
  hasAnySales: boolean,
  thresholds: TierThresholds,
): DepthTier {
  if (!hasAnySales) return 'sin-ventas';
  const p = penetration ?? 0;
  if (p >= thresholds.firstLineMinPenetration) return 'primera';
  if (p >= thresholds.secondLineMinPenetration) return 'segunda';
  return 'addon';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/profundidad-linea/__tests__/tier.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/dwh/profundidad-linea/tier.ts app/api/dwh/profundidad-linea/__tests__/tier.test.ts
git commit -m "feat: add depth-of-line tier classification function"
```

---

### Task 2: Types for the Depth of Line matrix

**Files:**
- Modify: `app/(app)/analitica/types.ts`

**Interfaces:**
- Consumes: nothing new (pure type additions).
- Produces: `CustomerSegment`, `DepthMatrixCell`, `DepthMatrixRow`, `DepthMatrixResponse`, `DepthGapEntity`, `DepthGapResponse` — consumed by Task 3 (route) and Task 5 (tab component).

- [ ] **Step 1: Add the new types to the end of `app/(app)/analitica/types.ts`**

```typescript
// Profundidad de Línea tab — segment-penetration matrix, gap drill-down, and
// first/second-line/addon classification. See
// docs/superpowers/specs/2026-09-21-profundidad-linea-tab-design.md.
export type CustomerSegment = 'CADENA' | 'INDEPENDIENTES';

export interface DepthMatrixCell {
  segment: CustomerSegment;
  entitiesBuying: number;
  entitiesActive: number;
  penetration: number | null; // entitiesBuying / entitiesActive; null when entitiesActive is 0
  salesNet: number;
}

export interface DepthMatrixRow {
  label: string;            // línea, sublínea, or SKU name depending on drill level
  value: string;             // drill key: the label itself (matches línea/sublínea drill convention in productos/route.ts)
  cells: DepthMatrixCell[];  // one per segment present for this row
  totalPenetration: number | null; // pooled across segments — see spec for the sum-of-counts definition
  totalSalesNet: number;
  tier: 'primera' | 'segunda' | 'addon' | 'sin-ventas';
}

export interface DepthMatrixResponse {
  rows: DepthMatrixRow[];
  groupBy: GroupBy; // 'linea' | 'sublinea' | 'sku'
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  usdRate: number | null;
}

export interface DepthGapEntity {
  legalEntityKey: number;
  legalEntityName: string;
  totalSalesNet: number; // this entity's total sales in range, for sort/context
}

export interface DepthGapResponse {
  entities: DepthGapEntity[];
  segment: CustomerSegment;
  productLabel: string;
}
```

- [ ] **Step 2: Verify the file still typechecks**

Run: `bunx tsc --noEmit`
Expected: no new errors (there is no runtime behavior yet, so this is purely a syntax/typecheck sanity check)

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/analitica/types.ts
git commit -m "feat: add Depth of Line matrix types"
```

---

### Task 3: Matrix API route (línea/sublínea/sku breadcrumb + segment penetration)

**Files:**
- Create: `app/api/dwh/profundidad-linea/route.ts`
- Create: `app/api/dwh/profundidad-linea/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `classifyTier`, `DEFAULT_TIER_THRESHOLDS` from `./tier` (Task 1); `requireDwhAccess` from `@/lib/dwh/access`; `getDwhPool` from `@/lib/db/dwh-mssql`; `getUsdRate`, `buildDateWhereClause`, `jsonWithCache` from `@/app/api/dwh/lib/query-builder`; `DepthMatrixRow`, `DepthMatrixResponse`, `DepthGapEntity`, `DepthGapResponse`, `CustomerSegment` from `@/app/(app)/analitica/types` (Task 2).
- Produces: `GET` handler at `/api/dwh/profundidad-linea` — query params `dateRange`, `currency`, `groupBy` (`linea`|`sublinea`|`sku`), `linea`, `sublinea`, `firstLineMinPenetration`, `secondLineMinPenetration`, `section=gap`+`segment`+`productLabel` for the gap drill-down. Consumed by Task 5 (tab component) and the e2e spec (Task 6).

- [ ] **Step 1: Write the failing auth-gate test**

```typescript
// app/api/dwh/profundidad-linea/__tests__/route.test.ts
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/profundidad-linea', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/profundidad-linea');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/profundidad-linea/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

- [ ] **Step 3: Write the route implementation**

```typescript
// app/api/dwh/profundidad-linea/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { classifyTier, DEFAULT_TIER_THRESHOLDS, type TierThresholds } from './tier';
import type {
  DepthMatrixRow, DepthMatrixResponse, DepthGapEntity, DepthGapResponse, CustomerSegment, GroupBy,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/) — no COLLATE/RTRIM gymnastics needed, that already
// happened at load time. See docs/superpowers/specs/
// 2026-09-21-profundidad-linea-tab-design.md for the full design.
//
// Segment penetration is counted at the Dim_LegalEntity grain (a multi-
// tienda chain counts once), matching the convention already established by
// app/api/dwh/productos/route.ts's profundidadLineaQuery. Only
// SegmentCode IN ('CADENA','INDEPENDIENTES') rows are counted — verified
// live that every active customer has one of these two values, but the
// query defensively excludes NULL/other rather than crashing or inventing a
// third bucket.

type DepthGroupBy = 'linea' | 'sublinea' | 'sku';

const NO_LINEA = 'Sin línea';
const NO_SUBLINEA = 'Sin sublínea';
const SEGMENTS: CustomerSegment[] = ['CADENA', 'INDEPENDIENTES'];

function isDepthGroupBy(value: string | null): value is DepthGroupBy {
  return value === 'linea' || value === 'sublinea' || value === 'sku';
}

function labelExprFor(groupBy: DepthGroupBy): string {
  if (groupBy === 'sublinea') return `ISNULL(p.SubLineName, '${NO_SUBLINEA}')`;
  if (groupBy === 'sku') return 'ISNULL(p.ProductName, p.ProductCode)';
  return `ISNULL(p.LineName, '${NO_LINEA}')`;
}

// Per-row-label × segment sales/entity aggregate, scoped to a specific
// línea (and sublínea, for the sku level) when drilling deeper.
function matrixQuery(groupBy: DepthGroupBy, dateWhere: string, scopeWhere: string): string {
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
    WHERE fs.IsVoided = 0 AND c.SegmentCode IN ('CADENA', 'INDEPENDIENTES') ${dateWhere} ${scopeWhere}
    GROUP BY ${labelExpr}, c.SegmentCode
  `;
}

// Total active (any-sale) entities per segment, for the penetration
// denominator — same shape as productos/route.ts's activeTotalsQuery, just
// split by segment instead of pooled.
function activeTotalsBySegmentQuery(dateWhere: string, scopeWhere: string): string {
  return `
    SELECT c.SegmentCode AS SegmentCode, COUNT(DISTINCT c.LegalEntityKey) AS TotalEntities
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    WHERE fs.IsVoided = 0 AND c.SegmentCode IN ('CADENA', 'INDEPENDIENTES') ${dateWhere} ${scopeWhere}
    GROUP BY c.SegmentCode
  `;
}

function gapQuery(groupBy: DepthGroupBy, dateWhere: string, scopeWhere: string): string {
  const labelExpr = labelExprFor(groupBy);
  return `
    SELECT le.LegalEntityKey, le.LegalEntityName, SUM(fs.NetAmount) AS TotalSalesNet
    FROM fact.Fact_Sales fs
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
    ORDER BY TotalSalesNet DESC
  `;
}

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

  const result = await req.query(gapQuery(groupBy, dateWhere, scopeWhere));
  const entities: DepthGapEntity[] = result.recordset.map(r => ({
    legalEntityKey: Number(r.LegalEntityKey),
    legalEntityName: String(r.LegalEntityName),
    totalSalesNet: Number(r.TotalSalesNet),
  }));

  const response: DepthGapResponse = { entities, segment, productLabel };
  return jsonWithCache(response);
}

async function handleMatrix(
  dateWhere: string,
  groupBy: DepthGroupBy,
  linea: string | null,
  sublinea: string | null,
  currency: string,
  thresholds: TierThresholds,
): Promise<NextResponse> {
  const pool = await getDwhPool();

  let scopeWhere = '';
  const scopeReq = pool.request();
  if (groupBy === 'sublinea') {
    scopeReq.input('linea', linea ?? '');
    scopeWhere = `AND ISNULL(p.LineName, '${NO_LINEA}') = @linea`;
  } else if (groupBy === 'sku') {
    scopeReq.input('linea', linea ?? '');
    scopeReq.input('sublinea', sublinea ?? '');
    scopeWhere = `AND ISNULL(p.LineName, '${NO_LINEA}') = @linea AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublinea`;
  }

  const [matrixResult, totalsResult] = await Promise.all([
    scopeReq.query(matrixQuery(groupBy, dateWhere, scopeWhere)),
    pool.request().query(activeTotalsBySegmentQuery(dateWhere, '')),
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

  const response: DepthMatrixResponse = { rows, groupBy: groupBy as GroupBy, breadcrumb, usdRate };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const groupByParam = searchParams.get('groupBy');
  const lineaParam = searchParams.get('linea');
  const sublineaParam = searchParams.get('sublinea');

  let groupBy: DepthGroupBy = isDepthGroupBy(groupByParam) ? groupByParam : 'linea';
  if (groupBy === 'sublinea' && !lineaParam) groupBy = 'linea';
  if (groupBy === 'sku' && (!lineaParam || !sublineaParam)) groupBy = 'linea';

  const firstLineMinPenetration = Number(searchParams.get('firstLineMinPenetration') ?? DEFAULT_TIER_THRESHOLDS.firstLineMinPenetration);
  const secondLineMinPenetration = Number(searchParams.get('secondLineMinPenetration') ?? DEFAULT_TIER_THRESHOLDS.secondLineMinPenetration);
  const thresholds: TierThresholds = {
    firstLineMinPenetration: Number.isFinite(firstLineMinPenetration) ? firstLineMinPenetration : DEFAULT_TIER_THRESHOLDS.firstLineMinPenetration,
    secondLineMinPenetration: Number.isFinite(secondLineMinPenetration) ? secondLineMinPenetration : DEFAULT_TIER_THRESHOLDS.secondLineMinPenetration,
  };

  const dateWhere = buildDateWhereClause(dateRange, 'fs');

  try {
    if (searchParams.get('section') === 'gap') {
      const segmentParam = searchParams.get('segment');
      const productLabel = searchParams.get('productLabel');
      if (segmentParam !== 'CADENA' && segmentParam !== 'INDEPENDIENTES') {
        return NextResponse.json({ error: 'Segmento inválido' }, { status: 400 });
      }
      if (!productLabel) {
        return NextResponse.json({ error: 'Falta productLabel' }, { status: 400 });
      }
      return await handleGap(dateWhere, groupBy, lineaParam, sublineaParam, segmentParam, productLabel);
    }

    return await handleMatrix(dateWhere, groupBy, lineaParam, sublineaParam, currency, thresholds);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test --isolate --env-file=.env.local app/api/dwh/profundidad-linea/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 5: Manually verify the route against the live DWH**

Run: `bun --bun run dev` in one terminal, then in another:
```bash
curl -s -b "$(cat /tmp/session-cookie.txt 2>/dev/null || echo '')" "http://localhost:3000/api/dwh/profundidad-linea?dateRange=12m&currency=bs" | head -c 2000
```
(If no session cookie is handy, skip this manual curl step and rely on Task 6's e2e coverage instead — the important verification is that `bun run e2e:mssql` later passes end-to-end.)

- [ ] **Step 6: Commit**

```bash
git add app/api/dwh/profundidad-linea/route.ts app/api/dwh/profundidad-linea/__tests__/route.test.ts
git commit -m "feat: add profundidad-linea matrix and gap-drill API route"
```

---

### Task 4: Register the tab and build the UI

**Files:**
- Create: `app/(app)/analitica/tabs/tab-profundidad.tsx`
- Modify: `app/(app)/analitica/analitica-client.tsx`

**Interfaces:**
- Consumes: `DepthMatrixResponse`, `DepthGapResponse`, `CustomerSegment` from `@/app/(app)/analitica/types` (Task 2); `moneyLabel` from `../lib/format`; `TabComponentProps` from `../analitica-client` (existing, `{dateRange, currency}`).
- Produces: default export `TabProfundidad` — consumed by Task 4's own modification to `analitica-client.tsx`.

- [ ] **Step 1: Build the tab component**

```typescript
// app/(app)/analitica/tabs/tab-profundidad.tsx
'use client';

import { Fragment, useEffect, useState } from 'react';
import { moneyLabel } from '../lib/format';
import type { Currency, DateRange, DepthMatrixResponse, DepthMatrixRow, DepthGapResponse, CustomerSegment } from '../types';

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(0)}%`;
}

function EmptyState() {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      Sin datos disponibles todavía.
    </div>
  );
}

const TIER_LABELS: Record<DepthMatrixRow['tier'], string> = {
  primera: 'Primera línea',
  segunda: 'Segunda línea',
  addon: 'Addon',
  'sin-ventas': 'Sin ventas',
};

const TIER_COLORS: Record<DepthMatrixRow['tier'], string> = {
  primera: 'bg-green-100 text-green-800',
  segunda: 'bg-blue-100 text-blue-800',
  addon: 'bg-gray-100 text-gray-600',
  'sin-ventas': 'bg-gray-50 text-gray-400',
};

export default function TabProfundidad({ dateRange, currency }: { dateRange: DateRange; currency: Currency }) {
  const [data, setData] = useState<DepthMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'linea' | 'sublinea' | 'sku'>('linea');
  const [linea, setLinea] = useState<string | null>(null);
  const [sublinea, setSublinea] = useState<string | null>(null);
  const [firstLineMinPenetration, setFirstLineMinPenetration] = useState(0.7);
  const [secondLineMinPenetration, setSecondLineMinPenetration] = useState(0.3);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [gapData, setGapData] = useState<DepthGapResponse | null>(null);
  const [gapLoading, setGapLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({
          dateRange, currency, groupBy,
          firstLineMinPenetration: String(firstLineMinPenetration),
          secondLineMinPenetration: String(secondLineMinPenetration),
        });
        if (linea) params.set('linea', linea);
        if (sublinea) params.set('sublinea', sublinea);
        const res = await fetch(`/api/dwh/profundidad-linea?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        setData(await res.json());
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateRange, currency, groupBy, linea, sublinea, firstLineMinPenetration, secondLineMinPenetration]);

  const rate = data?.usdRate ?? undefined;

  function drillInto(row: DepthMatrixRow) {
    if (groupBy === 'linea') {
      setLinea(row.label);
      setGroupBy('sublinea');
    } else if (groupBy === 'sublinea') {
      setSublinea(row.label);
      setGroupBy('sku');
    }
    setExpandedKey(null);
  }

  function resetToLineas() {
    setGroupBy('linea');
    setLinea(null);
    setSublinea(null);
    setExpandedKey(null);
  }

  function backToSublineas() {
    setGroupBy('sublinea');
    setSublinea(null);
    setExpandedKey(null);
  }

  async function handleToggleGap(row: DepthMatrixRow, segment: CustomerSegment) {
    const key = `${row.value}|${segment}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    setGapData(null);
    setGapLoading(true);
    try {
      const params = new URLSearchParams({
        dateRange, section: 'gap', groupBy, segment, productLabel: row.label,
      });
      if (linea) params.set('linea', linea);
      if (sublinea) params.set('sublinea', sublinea);
      const res = await fetch(`/api/dwh/profundidad-linea?${params.toString()}`);
      if (res.ok) setGapData(await res.json());
    } finally {
      setGapLoading(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }
  if (!data) return <div className="p-6"><EmptyState /></div>;

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Profundidad de Línea</h2>
            <p className="text-xs text-gray-500">
              Penetración por segmento (Cadena / Independientes) a nivel de entidad legal
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <label className="flex items-center gap-1">
              Primera línea ≥
              <input
                type="number" min={0} max={100} step={5}
                value={Math.round(firstLineMinPenetration * 100)}
                onChange={e => setFirstLineMinPenetration(Number(e.target.value) / 100)}
                className="border border-gray-200 rounded px-1 py-0.5 w-14 text-right"
              />%
            </label>
            <label className="flex items-center gap-1">
              Segunda línea ≥
              <input
                type="number" min={0} max={100} step={5}
                value={Math.round(secondLineMinPenetration * 100)}
                onChange={e => setSecondLineMinPenetration(Number(e.target.value) / 100)}
                className="border border-gray-200 rounded px-1 py-0.5 w-14 text-right"
              />%
            </label>
          </div>
        </div>

        <nav className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <button onClick={resetToLineas} className="hover:text-blue-600 underline">Líneas</button>
          {linea && (
            <>
              <span>/</span>
              <button onClick={backToSublineas} className="hover:text-blue-600 underline">{linea}</button>
            </>
          )}
          {sublinea && (
            <>
              <span>/</span>
              <span>{sublinea}</span>
            </>
          )}
        </nav>

        {data.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Cadena</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Independientes</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Clasificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((row, i) => {
                  const cadena = row.cells.find(c => c.segment === 'CADENA');
                  const independientes = row.cells.find(c => c.segment === 'INDEPENDIENTES');
                  const canDrill = groupBy !== 'sku';
                  return (
                    <Fragment key={row.value}>
                      <tr className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                        <td className="px-3 py-2 text-gray-800">
                          {canDrill ? (
                            <button onClick={() => drillInto(row)} className="hover:text-blue-600 underline text-left">
                              {row.label}
                            </button>
                          ) : row.label}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {cadena ? (
                            <button onClick={() => handleToggleGap(row, 'CADENA')} className="hover:text-blue-600">
                              {cadena.entitiesBuying}/{cadena.entitiesActive} ({pct(cadena.penetration)})
                            </button>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {independientes ? (
                            <button onClick={() => handleToggleGap(row, 'INDEPENDIENTES')} className="hover:text-blue-600">
                              {independientes.entitiesBuying}/{independientes.entitiesActive} ({pct(independientes.penetration)})
                            </button>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{pct(row.totalPenetration)}</td>
                        <td className="px-3 py-2 text-right text-gray-900 font-medium">{moneyLabel(row.totalSalesNet, currency, rate)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${TIER_COLORS[row.tier]}`}>
                            {TIER_LABELS[row.tier]}
                          </span>
                        </td>
                      </tr>
                      {(expandedKey === `${row.value}|CADENA` || expandedKey === `${row.value}|INDEPENDIENTES`) && (
                        <tr>
                          <td colSpan={6} className="px-3 py-2 bg-gray-50/50">
                            {gapLoading ? (
                              <div className="text-xs text-gray-400 py-2">Cargando…</div>
                            ) : !gapData || gapData.entities.length === 0 ? (
                              <div className="text-xs text-gray-400 py-2">Ninguna entidad activa está sin comprar este producto.</div>
                            ) : (
                              <div className="text-xs">
                                <p className="text-gray-500 mb-1">
                                  Entidades en {gapData.segment} que no compran {gapData.productLabel}:
                                </p>
                                <ul className="ml-4 list-disc space-y-0.5">
                                  {gapData.entities.map(e => (
                                    <li key={e.legalEntityKey} className="text-gray-700">
                                      {e.legalEntityName} — {moneyLabel(e.totalSalesNet, currency, rate)} en ventas totales
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the tab in `analitica-client.tsx`**

Modify `app/(app)/analitica/analitica-client.tsx`:

```typescript
// add near the other tab imports
import TabProfundidad from './tabs/tab-profundidad';
```

```typescript
// in TABS, insert after the 'productos' entry
{ key: 'profundidad', label: 'Profundidad de Línea', component: TabProfundidad },
```

- [ ] **Step 3: Typecheck and lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: no errors

- [ ] **Step 4: Manual smoke test**

Run: `bun --bun run dev`, log in as admin, navigate to `/analitica?tab=profundidad`, confirm the table renders, drilling línea → sublínea → sku works, and clicking a segment cell expands a gap list (or "ninguna entidad" message).

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/analitica/tabs/tab-profundidad.tsx app/\(app\)/analitica/analitica-client.tsx
git commit -m "feat: add Profundidad de Línea tab UI"
```

---

### Task 5: E2E coverage

**Files:**
- Create: `e2e/profundidad-linea.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect` from `./fixtures` (existing `adminPage` fixture).

- [ ] **Step 1: Write the e2e spec**

```typescript
// e2e/profundidad-linea.spec.ts
import { test, expect } from './fixtures';

// @mssql — requires the profitplus-erp-mock container running locally with
// DWH_AlimentosNY migrated and loaded (bun run migrate:dwh +
// bun run dwh:incremental-load). Excluded from default `bun run e2e`; run
// via `bun run e2e:mssql`. See e2e/analitica.spec.ts for the established
// pattern this file follows.

test.describe('profundidad-linea @mssql', () => {
  test('tab renders the matrix with segment columns and tier badges', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');

    await expect(adminPage.getByRole('heading', { name: 'Profundidad de Línea' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText('Cadena', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Independientes', { exact: true })).toBeVisible();
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('drilling línea -> sublínea -> sku updates the breadcrumb', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstRowLink = adminPage.locator('table tbody tr').first().locator('button').first();
    const lineaName = await firstRowLink.textContent();
    await firstRowLink.click();

    await expect(adminPage.locator('nav').getByText(lineaName ?? '', { exact: true })).toBeVisible();
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a segment penetration cell expands a gap list', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const firstRow = adminPage.locator('table tbody tr').first();
    // Second <td> is the Cadena penetration cell (first is the product label).
    const cadenaCellButton = firstRow.locator('td').nth(1).locator('button');
    await cadenaCellButton.click();

    // Either a gap list or the "ninguna entidad" message must appear.
    await expect(
      adminPage.getByText(/Entidades en CADENA que no compran|Ninguna entidad activa está sin comprar/)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('adjusting the first-line threshold changes tier badges', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=profundidad');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const thresholdInput = adminPage.locator('label', { hasText: 'Primera línea' }).locator('input');
    await thresholdInput.fill('0');
    await expect(adminPage.locator('table tbody').getByText('Primera línea').first()).toBeVisible({ timeout: 15_000 });
  });
});
```

- [ ] **Step 2: Run the e2e spec against the real DWH**

Run: `bun run e2e:mssql -- profundidad-linea`
Expected: all 4 tests PASS. If the `profitplus-erp-mock` container or DWH data isn't ready, first run `bun run migrate:dwh` and `bun run dwh:incremental-load` per `e2e/analitica.spec.ts`'s header comment.

- [ ] **Step 3: Commit**

```bash
git add e2e/profundidad-linea.spec.ts
git commit -m "test: add e2e coverage for Profundidad de Línea tab"
```

---

### Task 6: Full verification pass

- [ ] **Step 1: Run the full unit test suite**

Run: `bun run test:unit`
Expected: all tests PASS, including the new `tier.test.ts` and `route.test.ts`.

- [ ] **Step 2: Run lint**

Run: `bun run lint`
Expected: no errors.

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full default e2e suite (non-mssql)**

Run: `bun run e2e`
Expected: all existing tests still PASS (no regressions from the new tab/nav entry).

- [ ] **Step 5: Run the mssql e2e suite**

Run: `bun run e2e:mssql`
Expected: all tests PASS, including the new `profundidad-linea.spec.ts`.

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address verification findings for Profundidad de Línea"
```
