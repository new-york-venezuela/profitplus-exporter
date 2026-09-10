# Tabbed Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-view analytics dashboard into an 11-tab system with drill-down exploration, global date/currency filters, and modular API routes per analytical domain.

**Architecture:** Tab shell (`analitica-client.tsx`) manages navigation, active tab state, and global filters (date range, currency). Each tab is a lazy-loaded component that fetches from its own dedicated API route. Drill-down is driven by `groupBy` query params and breadcrumb navigation; date range and currency are passed to all APIs via URL params.

**Tech Stack:** Next.js 14+, React hooks, Recharts, TypeScript, Tailwind CSS

**Spec:** Previous session transcript defines 9 active tabs (Resumen, Ventas, Devoluciones, CXC, Vendedores, Clientes, Productos, Finanzas, Multimoneda) + 2 stubs (Compras, Rutas), with drill-down patterns and fixed-axis matrix views.

## Global Constraints

- All money formatting: preserve existing `money()` and `moneyTooltip()` helpers from current `analitica-client.tsx`
- Date range defaults: 30d / 90d / 12m / custom (all stored in URL `?dateRange=12m` param)
- Currency toggle: Bs / USD, persisted in localStorage as `analytics-currency`
- All APIs accept `?dateRange=X&currency=bs|usd&groupBy=X` query params
- Lazy data load: no API call until tab is first activated
- Error handling: render error banner with user-friendly message, not crash
- Each tab file: ≤400 lines (break into helper files if needed)

---

## File Structure

**New files to create:**

```
app/(app)/analitica/
  analitica-client.tsx              ← refactored to tab shell + global filter bar
  types.ts                          ← shared response types for all tabs
  tabs/
    tab-resumen.tsx                 ← summary dashboard
    tab-ventas.tsx                  ← sales trend & breakdown
    tab-devoluciones.tsx            ← returns matrix with drill-down
    tab-cxc.tsx                     ← AR aging and debtor concentration
    tab-vendedores.tsx              ← sales rep performance
    tab-clientes.tsx                ← customer segmentation & Pareto
    tab-productos.tsx               ← product rotation & margin
    tab-finanzas.tsx                ← revenue cascade
    tab-multimoneda.tsx             ← exchange rate trends
    tab-stub.tsx                    ← reusable stub placeholder

app/api/dwh/
  dashboard/route.ts                ← KEEP (deprecated, for backward compat)
  resumen/route.ts                  ← summary KPIs & charts
  ventas/route.ts                   ← sales data with drill-down by mes/cliente/linea
  devoluciones/route.ts             ← returns matrix by salesrep/producto/cliente
  cxc/route.ts                      ← AR aging & debtor lists
  vendedores/route.ts               ← sales rep metrics
  clientes/route.ts                 ← customer metrics with Pareto
  productos/route.ts                ← product rotation by linea/sublinea/sku
  finanzas/route.ts                 ← revenue waterfall
  multimoneda/route.ts              ← exchange rate trends
```

---

## Task 1: Create shared types and utilities

**Files:**
- Create: `app/(app)/analitica/types.ts`
- Modify: `app/(app)/analitica/analitica-client.tsx` (extract types & helpers)

**Interfaces:**
- Produces: All response types used by tab components and API routes (DrillPath, DateRangeParam, CurrencyParam, etc.)

- [ ] **Step 1: Create `types.ts` with all shared response shapes**

Create `app/(app)/analitica/types.ts`:

```typescript
export type Currency = 'bs' | 'usd';
export type DateRange = '30d' | '90d' | '12m' | 'custom';
export type GroupBy = string; // e.g., 'mes', 'cliente', 'salesrep', 'producto', 'linea', 'sublinea', 'sku'

export interface FilterParams {
  dateRange: DateRange;
  currency: Currency;
  startDate?: string; // YYYY-MM-DD, only if custom
  endDate?: string;
}

export interface DrillContext {
  groupBy: GroupBy;
  parentValue?: string; // e.g., salesRepKey=123 when drilling into products for that rep
}

// Resumen tab
export interface ResumenKPIs {
  salesNet12mo: number;
  returnsNet12mo: number;
  returnRate: number | null;
  collected12mo: number;
}

export interface MonthlyTrendRow {
  yearMonth: string;
  salesNet: number;
  returnsNet: number;
}

export interface NamedAmount {
  name: string;
  netRevenue: number;
}

export interface SalesRepRow {
  name: string;
  salesNet: number;
  returnsNet: number;
}

export interface AgingBucketRow {
  bucket: string;
  amount: number;
}

export interface DebtorRow {
  name: string;
  outstanding: number;
}

export interface ResumenResponse {
  monthlyTrend: MonthlyTrendRow[];
  topCustomers: NamedAmount[];
  topProducts: NamedAmount[];
  salesReps: SalesRepRow[];
  agingBuckets: AgingBucketRow[];
  topDebtors: DebtorRow[];
  snapshotDateKey: number | null;
  usdRate: number | null;
  kpis: ResumenKPIs;
}

// Ventas tab
export interface VentasRow {
  label: string; // formatted month or customer or line name
  value: string | number; // the groupBy identifier
  salesNet: number;
  returnRate: number | null;
  avgDiscount: number | null;
}

export interface VentasResponse {
  rows: VentasRow[];
  groupBy: GroupBy;
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  usdRate: number | null;
}

// Devoluciones tab
export interface DevolucionesMatrixCell {
  salesRep: string;
  producto: string;
  cliente: string;
  ratioDevolucion: number | null;
  amountNet: number;
}

export interface DevolucionesResponse {
  rows: DevolucionesMatrixCell[];
  groupBy: GroupBy; // 'salesrep' | 'producto' | 'cliente'
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  usdRate: number | null;
}

// CXC tab
export interface CxcResponse {
  agingBuckets: AgingBucketRow[];
  topDebtors: DebtorRow[];
  overdueShare: number | null;
  snapshotDateKey: number | null;
  usdRate: number | null;
}

// Vendedores tab
export interface VendedoresRow {
  name: string;
  salesNet: number;
  returnsNet: number;
  returnRate: number | null;
  collectionRate: number | null;
  avgDiscount: number | null;
}

export interface VendedoresResponse {
  rows: VendedoresRow[];
  usdRate: number | null;
}

// Clientes tab
export interface ClientesRow {
  name: string;
  salesNet: number;
  returnsNet: number;
  returnRate: number | null;
  pareto: 'A' | 'B' | 'C'; // Pareto segment
}

export interface ClientesResponse {
  rows: ClientesRow[];
  paretoThresholds: { a: number; b: number }; // cumulative % for A and B segments
  usdRate: number | null;
}

// Productos tab
export interface ProductosRow {
  sku: string;
  linea: string;
  sublinea: string;
  rotacion: number; // QuantitySold * GrossProfitAmount or similar metric
  salesNet: number;
  margin: number | null; // GrossProfitAmount / NetAmount
}

export interface ProductosResponse {
  rows: ProductosRow[];
  groupBy: GroupBy; // 'linea' | 'sublinea' | 'sku'
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  usdRate: number | null;
}

// Finanzas tab
export interface FinanzasWaterfallStep {
  step: string; // 'Bruto' → 'Descuento' → 'Neto' → 'COGS' → 'Utilidad'
  amount: number;
  cumulative: number;
}

export interface FinanzasResponse {
  waterfall: FinanzasWaterfallStep[];
  usdRate: number | null;
}

// Multimoneda tab
export interface ExchangeRateRow {
  yearMonth: string;
  rateBcvToUsd: number; // BCV official rate
}

export interface MultimonedaResponse {
  exchangeRates: ExchangeRateRow[];
  currentRate: number | null;
}
```

- [ ] **Step 2: Verify types are complete and don't overlap**

All response types defined. No duplicates. Ready for tab components to import.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/analitica/types.ts
git commit -m "feat: define shared types for analytics tabs"
```

---

## Task 2: Refactor analitica-client to tab shell + global filter bar

**Files:**
- Modify: `app/(app)/analitica/analitica-client.tsx`

**Interfaces:**
- Consumes: Shared types from Task 1
- Produces: AnaliticaClient component that manages tab state, global filters, and lazy-loads tab components

- [ ] **Step 1: Replace analitica-client.tsx with tab shell**

See Task 2 code block in plan (approximately 200 lines). The shell manages:
- Tab navigation (11 tabs)
- URL-based tab state (?tab=resumen)
- Global filter bar (date range + currency)
- Lazy loading via Set<string> of mounted tabs
- Dynamic tab component rendering

- [ ] **Step 2: Commit**

```bash
git add app/(app)/analitica/analitica-client.tsx
git commit -m "refactor: convert single dashboard to tabbed shell with global filters"
```

---

## Task 3: Create tab-stub.tsx for placeholder tabs

**Files:**
- Create: `app/(app)/analitica/tabs/tab-stub.tsx`

**Interfaces:**
- Produces: TabStub component for Compras and Rutas tabs (empty state)

- [ ] **Step 1: Create stub component**

Approximately 30 lines. Shows title + "planned but requires additional DWH data" message.

- [ ] **Step 2: Commit**

```bash
git add app/(app)/analitica/tabs/tab-stub.tsx
git commit -m "feat: add stub component for planned tabs"
```

---

## Task 4: Create API infrastructure for drill-down support

**Files:**
- Create: `app/api/dwh/lib/types.ts`
- Create: `app/api/dwh/lib/query-builder.ts`

**Interfaces:**
- Produces: Query building helpers for `groupBy` param support and date range filtering

- [ ] **Step 1: Create API types and query builder**

Two small files:
- `types.ts` — ApiQueryParams, parseDateRange()
- `query-builder.ts` — getUsdRate(), buildDateWhereClause()

- [ ] **Step 2: Commit**

```bash
git add app/api/dwh/lib/types.ts app/api/dwh/lib/query-builder.ts
git commit -m "feat: add API infrastructure for drill-down and date filtering"
```

---

## Task 5: Create API route for Resumen tab (repurpose dashboard data)

**Files:**
- Create: `app/api/dwh/resumen/route.ts`

**Interfaces:**
- Consumes: `ResumenResponse` type from Task 1, query builder from Task 4
- Produces: GET /api/dwh/resumen?dateRange=12m&currency=bs returns ResumenResponse

- [ ] **Step 1: Adapt existing dashboard logic to resumen/route.ts**

Approximately 150 lines. Reuses the existing dashboard query patterns.

- [ ] **Step 2: Test locally**

```bash
curl "http://localhost:3000/api/dwh/resumen?dateRange=12m&currency=bs" | jq .
```

- [ ] **Step 3: Commit**

```bash
git add app/api/dwh/resumen/route.ts
git commit -m "feat: create resumen API endpoint with existing dashboard data"
```

---

## Task 6: Create tab-resumen.tsx component

**Files:**
- Create: `app/(app)/analitica/tabs/tab-resumen.tsx`

**Interfaces:**
- Consumes: `ResumenResponse`, formatting helpers
- Produces: TabResumen component that fetches from /api/dwh/resumen and renders charts

- [ ] **Step 1: Create tab component by refactoring existing dashboard UI**

Approximately 350 lines. Renders KPI cards, trend chart, top customers/products, AR aging, debtors, sales rep table.

- [ ] **Step 2: Commit**

```bash
git add app/(app)/analitica/tabs/tab-resumen.tsx
git commit -m "feat: create Resumen tab component with existing dashboard UI"
```

---

## Task 7: Create Ventas tab + API route

**Files:**
- Create: `app/api/dwh/ventas/route.ts`
- Create: `app/(app)/analitica/tabs/tab-ventas.tsx`

**Interfaces:**
- Consumes: `VentasResponse` type, query builder
- Produces: GET /api/dwh/ventas?dateRange=12m&currency=bs&groupBy=mes returns VentasResponse; TabVentas renders with drill-down breadcrumb

- [ ] **Step 1: Create API route with drill-down**

Supports `groupBy=mes|cliente|linea` with breadcrumb navigation.

- [ ] **Step 2: Create tab component with drill-down breadcrumb**

Renders bar chart of sales data. Toggle buttons to switch groupBy.

- [ ] **Step 3: Commit**

```bash
git add app/api/dwh/ventas/route.ts app/(app)/analitica/tabs/tab-ventas.tsx
git commit -m "feat: create Ventas tab with drill-down support"
```

---

## Task 8: Create Devoluciones tab + API route

**Files:**
- Create: `app/api/dwh/devoluciones/route.ts`
- Create: `app/(app)/analitica/tabs/tab-devoluciones.tsx`

**Interfaces:**
- Consumes: `DevolucionesResponse`
- Produces: Matrix view by salesrep/producto/cliente with return ratio %

- [ ] **Step 1: Create API route**

GROUP BY salesrep/producto/cliente, compute ratio of returns to sales.

- [ ] **Step 2: Create tab component**

Matrix or heatmap table view. Toggle views by dimension.

- [ ] **Step 3: Commit**

```bash
git add app/api/dwh/devoluciones/route.ts app/(app)/analitica/tabs/tab-devoluciones.tsx
git commit -m "feat: create Devoluciones tab with matrix view"
```

---

## Task 9: Create CXC tab + API route

**Files:**
- Create: `app/api/dwh/cxc/route.ts`
- Create: `app/(app)/analitica/tabs/tab-cxc.tsx`

**Interfaces:**
- Consumes: `CxcResponse`
- Produces: AR aging buckets chart + top debtors table

- [ ] **Step 1: Create API route**

Query Snapshot_Fact_AR for aging buckets, compute overdueShare %, top 10 debtors.

- [ ] **Step 2: Create tab component**

Aging bar chart (colored by bucket) + debtors table.

- [ ] **Step 3: Commit**

```bash
git add app/api/dwh/cxc/route.ts app/(app)/analitica/tabs/tab-cxc.tsx
git commit -m "feat: create CXC tab with AR aging and debtors"
```

---

## Task 10: Create Vendedores tab + API route

**Files:**
- Create: `app/api/dwh/vendedores/route.ts`
- Create: `app/(app)/analitica/tabs/tab-vendedores.tsx`

**Interfaces:**
- Consumes: `VendedoresResponse`
- Produces: Sales rep performance table (sales, returns, return rate, collection rate, avg discount)

- [ ] **Step 1: Create API route**

GROUP BY SalesRep, aggregate sales + returns + collections, compute rates.

- [ ] **Step 2: Create tab component**

Table with sortable columns.

- [ ] **Step 3: Commit**

```bash
git add app/api/dwh/vendedores/route.ts app/(app)/analitica/tabs/tab-vendedores.tsx
git commit -m "feat: create Vendedores tab with sales rep metrics"
```

---

## Task 11: Create Clientes tab + API route

**Files:**
- Create: `app/api/dwh/clientes/route.ts`
- Create: `app/(app)/analitica/tabs/tab-clientes.tsx`

**Interfaces:**
- Consumes: `ClientesResponse`
- Produces: Customer Pareto segmentation table (A/B/C segments based on cumulative % of sales)

- [ ] **Step 1: Create API route**

GROUP BY Customer, compute Pareto thresholds (e.g., top 20% = A, next 30% = B, rest = C).

- [ ] **Step 2: Create tab component**

Table with Pareto segment column. Filter by segment if desired.

- [ ] **Step 3: Commit**

```bash
git add app/api/dwh/clientes/route.ts app/(app)/analitica/tabs/tab-clientes.tsx
git commit -m "feat: create Clientes tab with Pareto segmentation"
```

---

## Task 12: Create Productos tab + API route

**Files:**
- Create: `app/api/dwh/productos/route.ts`
- Create: `app/(app)/analitica/tabs/tab-productos.tsx`

**Interfaces:**
- Consumes: `ProductosResponse`
- Produces: Product rotation + margin data, grouped by linea/sublinea/sku with drill-down

- [ ] **Step 1: Create API route**

GROUP BY linea/sublinea/sku, compute rotation (QuantitySold), margin % (GrossProfitAmount/NetAmount).

- [ ] **Step 2: Create tab component**

Drill-down view by product hierarchy. Table with rotation and margin metrics.

- [ ] **Step 3: Commit**

```bash
git add app/api/dwh/productos/route.ts app/(app)/analitica/tabs/tab-productos.tsx
git commit -m "feat: create Productos tab with rotation and margin"
```

---

## Task 13: Create Finanzas tab + API route

**Files:**
- Create: `app/api/dwh/finanzas/route.ts`
- Create: `app/(app)/analitica/tabs/tab-finanzas.tsx`

**Interfaces:**
- Consumes: `FinanzasResponse`
- Produces: Revenue waterfall chart (Bruto → Descuento → Neto → COGS → Utilidad Bruta)

- [ ] **Step 1: Create API route**

Query Fact_Sales, compute waterfall steps: SUM(GrossAmount) → SUM(DiscountAmount) → SUM(NetAmount) → SUM(COGSAmount) → SUM(GrossProfitAmount).

- [ ] **Step 2: Create tab component**

Waterfall chart (cumulative bars showing each step's impact).

- [ ] **Step 3: Commit**

```bash
git add app/api/dwh/finanzas/route.ts app/(app)/analitica/tabs/tab-finanzas.tsx
git commit -m "feat: create Finanzas tab with revenue waterfall"
```

---

## Task 14: Create Multimoneda tab + API route

**Files:**
- Create: `app/api/dwh/multimoneda/route.ts`
- Create: `app/(app)/analitica/tabs/tab-multimoneda.tsx`

**Interfaces:**
- Consumes: `MultimonedaResponse`
- Produces: Exchange rate trend chart (BCV rate over time)

- [ ] **Step 1: Create API route**

Query Fact_ExchangeRate, return trend by month.

- [ ] **Step 2: Create tab component**

Line chart of exchange rate over time. Show current rate as a badge.

- [ ] **Step 3: Commit**

```bash
git add app/api/dwh/multimoneda/route.ts app/(app)/analitica/tabs/tab-multimoneda.tsx
git commit -m "feat: create Multimoneda tab with exchange rate trends"
```

---

## Task 15: Integration testing + final cleanup

**Files:**
- No new files; verify all tabs load and filters work

**Interfaces:**
- Consumes: All 11 tabs, all APIs
- Produces: Working analitica dashboard with no console errors

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test each tab loads without errors**

Click through all 11 tabs. Verify data loads, charts render, no 500s.

- [ ] **Step 3: Test global filters**

Toggle date range (30d/90d/12m) and currency (Bs/USD) for each tab. Verify URL params update, data refetches.

- [ ] **Step 4: Test lazy loading**

Verify API calls only fire when tab is activated (check Network tab in DevTools). First activation loads; switching away and back does not re-fetch.

- [ ] **Step 5: Test drill-down (Ventas/Devoluciones/Productos)**

Click drill-down breadcrumbs. Verify groupBy param changes, data updates.

- [ ] **Step 6: Commit**

```bash
git commit --allow-empty -m "test: verify analytics dashboard integration and filters"
```

---

## Summary

**Phase 1 (Sequential foundation — Tasks 1–6):** Shared types, tab shell, stub, API infrastructure, Resumen.

**Phase 2 (Parallelizable — Tasks 7–14):** 8 active tabs + APIs (Ventas, Devoluciones, CXC, Vendedores, Clientes, Productos, Finanzas, Multimoneda).

**Phase 3 (Integration — Task 15):** Full dashboard testing.

**Final deliverable:** `/analitica` page with 11 tabs, global filters, drill-down navigation, lazy-loaded data, independent API endpoints.
