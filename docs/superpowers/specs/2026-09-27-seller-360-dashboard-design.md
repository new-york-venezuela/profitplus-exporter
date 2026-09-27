# Seller 360° Profile — Design Spec

**Status:** Design approved by user, pending self-review and user sign-off
on the written spec.

**Depends on:** implemented after
`docs/superpowers/specs/2026-09-27-price-list-customer-assignment-design.md`
(per user's stated ordering) — no functional dependency between the two,
this is purely a sequencing note.

## 1. Purpose

Give a manager a single, printable scorecard per seller: activation
(client-visit cadence), monthly sales-quota attainment, collections/AR
aging, new-customer acquisition, recovered-customer wins, return
patterns, and portfolio (depth-of-line) coverage — the seven metrics the
user asked for, in one place, exportable to PDF for a 1:1 review.

This is **manager-facing**, one seller at a time — not a seller
self-service login, not a side-by-side multi-seller comparison page.

## 2. Scope

**In scope:**
- A seller-profile drill-down reachable by clicking a seller's name in
  the existing Vendedores tab (`app/(app)/analitica/tabs/tab-vendedores.tsx`).
- Seven metric sections, each scoped to the clicked seller and the
  analitica shell's existing date-range/currency selection:
  1. Activación — weekly distinct-customer/tienda reach vs a weekly visit
     quota.
  2. Cuota de ventas mensual — sales net vs a monthly sales quota.
  3. Cobranza — AR aging (30+/60+/90+ buckets) for this seller's customers.
  4. Nuevos clientes — legal entities whose first-ever sale falls in this
     period, attributed to this seller.
  5. Clientes recuperados — churned-then-returned entities, attributed to
     this seller.
  6. Devoluciones — this seller's returns broken down by product and by
     tienda.
  7. Profundidad de línea — this seller's existing coverage %/rank, reused
     from the already-shipped seller-scoped Depth of Line feature.
- A new `seller_targets` SQLite table (sales/visit/new-customer quotas per
  seller per month), admin-editable inline on the profile view.
- Browser print-to-PDF: a print-optimized layout of the same profile view,
  no new PDF-generation dependency.

**Explicitly out of scope:**
- Seller login / self-service view of "my own" dashboard — this is
  manager-facing only, gated the same way every other analitica view is
  (`hasDwhAccess()`), not tied to a per-user seller identity.
- A multi-seller comparison page or leaderboard beyond what already exists
  (Depth of Line's leaderboard, reused as-is in section 7).
- Server-side PDF rendering (Puppeteer, a PDF library, etc.) — browser
  print-to-PDF is sufficient and adds zero new dependencies.
- Quota import from a spreadsheet — quotas are entered one-by-one in-app.
- Any change to how Depth of Line, Cadencia, Vendedores, or CXC compute
  their existing numbers — this feature only re-slices/reuses their logic
  scoped to one seller, and embeds one of them (section 7) directly.

## 3. What Already Exists (and what this reuses)

Four prior specs in this DWH analytics batch are already shipped
(confirmed via `git log`, all merged):
- **Cadencia tab** (`2026-09-21-active-customer-visit-cadence`): per-customer
  purchase-frequency/gap tracking with a manual target, `visit_cadence_targets`
  SQLite table. This spec's `seller_targets` table follows the same
  shape/precedent but is a distinct table (seller-scoped quotas, not
  customer-scoped cadence targets) — no overlap, no shared rows.
- **Profundidad de Línea tab** (`2026-09-21-profundidad-linea-tab` +
  `...seller-depth-of-line-coverage`): matrix + seller-scoped coverage view
  + leaderboard, already computes exactly what this spec's section 7 needs.
  **This spec does not reimplement it** — it imports/calls the existing
  query logic from `app/api/dwh/profundidad-linea/route.ts`, scoped by
  `salesRepKey`, and renders the existing `SellerCoverageRow` shape.
- **Vendedores tab** (`app/api/dwh/vendedores/route.ts`,
  `tab-vendedores.tsx`): per-seller `salesNet`, `returnsNet`, `returnRate`,
  `collectionRate`, `avgDiscount`. This spec's section 2 (sales quota)
  reuses its `SalesNet` aggregation directly; section 6 (returns) extends
  its return-rate logic with new product/tienda grouping this tab doesn't
  currently have.
- **CXC tab** (`app/api/dwh/cxc/route.ts`): AR aging buckets from
  `Fact_AR_Snapshot`, currently computed at legal-entity/dimension grain
  with no seller attribution. This spec's section 3 adds a seller-scoped
  filter on top of the existing bucket query, following the same
  entity-to-seller join Depth of Line's seller-scoped view already uses.

Nothing above needs to change to support this spec — all reuse is
additive (new optional filter params, new call sites), confirmed by
reading each file's current route/component code before writing this
spec.

## 4. Entry Point and Navigation

No new tab, no new route, no URL change.

`app/(app)/analitica/tabs/tab-vendedores.tsx`: each row's seller name
becomes a clickable button (not a link — no route change) instead of
plain text.

`app/(app)/analitica/analitica-client.tsx` (the tab shell): gains local
state `selectedSellerKey: string | null`. When the Vendedores tab is
active and `selectedSellerKey` is set, the tab's content area renders the
new `SellerProfile` component instead of `TabVendedores`, passing
`salesRepKey={selectedSellerKey}` plus the shell's existing `dateRange`/
`currency` props — the same props every other tab already receives, no
new prop-drilling pattern introduced.

`SellerProfile` renders a "← Volver a Vendedores" button at its top that
clears `selectedSellerKey` back to `null`, returning to the list view.

This is a pure client-side state swap within the existing tab shell — no
new Next.js route, no new page-level access check needed (the existing
`app/(app)/analitica/page.tsx` gate via `hasDwhAccess()` already covers
this, since it's still the same page).

## 5. Data Model

New table in `lib/db/schema.ts`, following `visitCadenceTargets`'s
existing shape and conventions (same file, same style):

```typescript
export const sellerTargets = sqliteTable('seller_targets', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  salesRepKey:      text('sales_rep_key').notNull(),
  periodMonth:      text('period_month').notNull(), // 'YYYY-MM'
  salesQuotaUsd:    real('sales_quota_usd'),
  weeklyVisitQuota: integer('weekly_visit_quota'),
  newCustomerQuota: integer('new_customer_quota'),
}, (t) => ({
  uniq: unique().on(t.salesRepKey, t.periodMonth),
}));
```

One row per seller per month. All three quota columns are nullable
independently — a seller can have a sales quota set without a visit quota
yet defined, etc. No segment-level default/fallback row (unlike
`visitCadenceTargets`'s entity-vs-segment precedence) — the seller list is
small and known (`Dim_SalesRep`), so every seller gets their own row or no
row at all; a missing row for a given month means "no quota set," full
stop, not "fall back to a company default."

Migration: `migrations/sqlite/` — new numbered migration creating this
table, run via `scripts/migrate.ts`, following the exact pattern
`visit_cadence_targets`'s own migration already established.

## 6. API Routes

### `app/api/dwh/vendedor-360/route.ts` (new)

Gated by `requireDwhAccess`, following every other `app/api/dwh/*` route's
conventions: `getDwhPool()`, `.input()` for all parameters,
`buildDateWhereClause`, `jsonWithCache`.

Query params: `salesRepKey` (required), `dateRange` (existing shell
convention), `entityGrain` (`'entity' | 'tienda'`, default `'entity'`,
affects section 1 only).

Returns one composite JSON response containing all seven sections'
data — a single round-trip per seller/date-range/grain change, since every
section reads from pre-aggregated DWH tables and is cheap to compute
together; splitting into seven endpoints would just add latency for no
benefit.

```typescript
export interface Seller360Response {
  salesRepKey: string;
  salesRepName: string;
  activacion: { weeks: ActivacionWeekRow[]; entityGrain: 'entity' | 'tienda' };
  cuota: { salesNet: DualAmount; quotaUsd: number | null };
  cobranza: { buckets: AgingBucketRow[]; baselineBuckets: AgingBucketRow[] };
  nuevosClientes: { rows: NewCustomerRow[]; quota: number | null };
  clientesRecuperados: { rows: RecoveredCustomerRow[] };
  devoluciones: { byProduct: ReturnBreakdownRow[]; byTienda: ReturnBreakdownRow[] };
  profundidad: { coverage: SellerCoverageRow | null }; // reused type, this seller's own row
  usdRate: number | null;
}

export interface ActivacionWeekRow {
  weekStart: string;       // ISO date, Monday of the week
  distinctReached: number; // distinct CustomerKey or LegalEntityKey per entityGrain
}

export interface NewCustomerRow {
  legalEntityKey: number;
  legalEntityName: string;
  firstSaleDate: string;
  firstSaleAmount: DualAmount;
}

export interface RecoveredCustomerRow {
  legalEntityKey: number;
  legalEntityName: string;
  lastSaleBeforeGap: string;
  gapDays: number;
  recoverySaleDate: string;
  recoverySaleAmount: DualAmount;
}

export interface ReturnBreakdownRow {
  label: string;           // product name or tienda name
  quantity: number;
  amount: DualAmount;
}
```

`AgingBucketRow` and `SellerCoverageRow` are existing types, imported, not
redefined.

### `app/api/admin/seller-targets/route.ts` (new)

CRUD for `seller_targets`. `GET ?salesRepKey=&periodMonth=` returns the row
(or `null`); `POST` upserts one row (all three quota fields optional,
`null` clears a field). Gated by `requireDwhAccess` (dwh-access is
sufficient, not `role === 'admin'` — same reasoning as
`visit_cadence_targets`: this is an operational sales-management setting,
not a security-sensitive admin function), checked independently on the
route per this app's no-shared-middleware convention.

## 7. Section-by-Section Query Notes

1. **Activación**: joins `Fact_Sales` (filtered `SalesRepKey = @salesRepKey`)
   to `Dim_Date`'s week column (`0033_dim_date_add_week.sql`), groups by
   week, `COUNT(DISTINCT CustomerKey)` when `entityGrain = 'tienda'` or
   `COUNT(DISTINCT LegalEntityKey)` when `'entity'`. Weekly quota resolved
   from `seller_targets.weeklyVisitQuota` for each week's containing month
   (a range spanning two months uses each week's own month's quota row).

2. **Cuota de ventas**: reuses `vendedores/route.ts`'s existing `SalesNet`
   dual-amount aggregation, filtered to the one seller, summed for the
   whole selected period (not per-week, unlike section 1). Quota resolved
   from `seller_targets.salesQuotaUsd` for the period's primary month (if
   the range spans multiple months, sum each month's quota row that has one
   set; a month with no quota row contributes 0 to the target sum, not a
   gap — documented in the UI as "meta parcial" if any month in range is
   missing a quota).

3. **Cobranza**: extends `cxc/route.ts`'s `AGING_BUCKETS_QUERY` with a
   `WHERE LegalEntityKey IN (...)` (or a join) restricting to entities with
   a `Fact_Sales` row for this `SalesRepKey` in the selected period — same
   join shape as Depth of Line's existing seller-scoped entity set
   (`app/api/dwh/profundidad-linea/route.ts`). `baselineBuckets` is the
   existing unscoped company-wide query, returned alongside for context
   (not attributed to any seller).

4. **Nuevos clientes**: `MIN(FullDate) OVER (PARTITION BY LegalEntityKey)`
   across **all** of `Fact_Sales` (unbounded — a true "first sale ever,"
   not first-in-range) to find each entity's genuine first-sale date, then
   filters to entities whose first-sale date falls inside the selected
   period **and** whose first-sale row's `SalesRepKey` matches the
   profile's seller.

5. **Clientes recuperados**: reuses the churn definition already computed
   in `tab-clientes.tsx`/its backing route (prior-period sale, no sale in
   the immediately preceding comparison period) intersected with "has a
   sale in the selected period attributed to this seller." The recovery
   sale is the first in-period sale after the gap; `gapDays` is
   `DATEDIFF(recoverySaleDate, lastSaleBeforeGap)`.

6. **Devoluciones**: new grouped query over `Fact_Returns` filtered to
   `SalesRepKey = @salesRepKey`, two `GROUP BY` shapes returned together:
   by `ProductKey` (→ `byProduct`) and by the entity's tienda (`CustomerKey`,
   → `byTienda`), each with `SUM(QuantityReturned)` and the dual-amount
   sum, sorted descending by amount, capped at top 10 each (matching
   `topDebtorsQuery`'s `TOP 10` convention in `cxc/route.ts`).

7. **Profundidad**: calls the existing seller-scoped query function from
   `profundidad-linea/route.ts` (refactored into an importable function if
   it isn't already factored out of the route handler — confirm at
   implementation time) with `salesRepKey` set, and returns just this
   seller's own `SellerCoverageRow` from that computation, not the full
   leaderboard or matrix (a "ver detalle completo" link/button in the UI
   navigates the user to the full Profundidad tab instead of duplicating
   its matrix here).

## 8. UI

New component `app/(app)/analitica/tabs/seller-profile.tsx`. Rendered in
place of `TabVendedores`'s list when a seller is selected (see Section 4).

Seven stacked cards, following the existing `ChartCard`/`KpiCard` layout
helpers already used across sibling tabs (no new layout primitives):

1. **Activación** — small bar chart (Recharts, consistent with other
   tabs), weekly reach bars with the quota drawn as a reference line; an
   entity/tienda `<select>` toggle (small enum, native select per this
   codebase's dropdown convention) above the chart.
2. **Cuota** — one `KpiCard`: actual vs quota, % attainment. Color banding:
   ≥100% green, ≥80% amber, below amber red — if no established banding
   convention is found elsewhere in the codebase at implementation time,
   this becomes the local default. Shows "Sin meta definida" instead of a
   percentage when `quotaUsd` is `null`.
3. **Cobranza** — aging bucket table/bars for this seller, with the
   company-wide baseline shown as a muted secondary row directly below
   each bucket for comparison.
4. **Nuevos clientes** — `KpiCard` (count vs `newCustomerQuota`, same
   banding/no-target convention as section 2) plus a table of the actual
   new entities below it (name, first-sale date, first-sale amount) so the
   count is inspectable.
5. **Clientes recuperados** — count KPI (no quota concept requested for
   this one — informational only) plus a table (entity, last-sale-before-
   gap date, gap days, recovery date/amount).
6. **Devoluciones** — two small tables, top products returned and top
   tiendas returned-from, side by side on wide screens / stacked on
   narrow.
7. **Profundidad** — this seller's coverage %, rank vs baseline (reusing
   `SellerCoverageRow`'s `ownPenetration`/`baselinePenetration`/
   `gapVsBaseline`), with a "Ver matriz completa" link that switches to the
   Profundidad tab (existing tab-switch mechanism) scoped to this seller
   (reusing that tab's own `salesRepKey` filter, set programmatically on
   navigation).

Admin quota editing: a small inline edit affordance in sections 1, 2, and 4
(three number inputs, one per quota field, editable directly on their
respective cards) — same inline-edit convention as `config-inventario`,
not a separate settings page. Saves via the `seller-targets` CRUD route,
scoped to the period's primary month.

"Imprimir / PDF" button at the top of `SellerProfile`, calling
`window.print()` — no new dependency.

## 9. Print Layout

Tailwind `print:` variants (this app already uses Tailwind; no new
dependency):
- `print:hidden` on the analitica sidebar, tab navigation, and the
  date-range/currency/seller-back-link controls — the print output is just
  the seven sections.
- A print-only header (`hidden print:block`) at the top of
  `SellerProfile`: seller name, selected date range, "Generado: <today>".
- Each card gets `print:break-inside-avoid` so a section doesn't split
  across a page boundary.
- Charts (section 1's bar chart) are Recharts SVG output, which prints
  natively in browsers — verified manually against the running app during
  implementation, not assumed to work without checking.

## 10. Error Handling / Edge Cases

- No `seller_targets` row for the selected month: every KPI in sections 1,
  2, 4 shows "Sin meta definida" instead of a percentage — consistent with
  Cadencia's existing "no target = no badge" convention. Never shown as 0%
  or an error.
- Seller with zero sales in the selected period: every section renders its
  existing empty-state pattern (matching `EmptyState` components already
  used across sibling tabs), not an error — a seller can legitimately have
  a quiet period.
- `entityGrain = 'tienda'` when a chain is split across sellers (documented
  in the Depth-of-Line/seller-coverage spec as ~28% of active entities):
  each seller's weekly reach counts only the tiendas *they* personally
  sold to, consistent with the existing seller-scoped attribution
  convention used everywhere else in this batch.
- A multi-month date range for section 2's quota sum: months with no quota
  row set contribute 0 to the summed target (not treated as "no target at
  all" for the whole range) — the UI flags this case ("meta parcial: falta
  meta para <month>") rather than silently understating the target.
- An entity cannot appear in both "nuevos clientes" and "clientes
  recuperados" for the same seller/period: "nuevo" requires zero prior
  sales ever; "recuperado" requires a prior sale followed by a churn gap —
  mutually exclusive by definition, no dedup logic needed.
- AR aging (section 3) for a seller with entities split across multiple
  sellers: the split entity's full outstanding balance appears under every
  seller who sold to it in the period, matching Depth of Line's existing
  "no dedup, each seller sees their own touch" convention (documented in
  that spec) rather than inventing a different rule for debt.

## 11. Testing

- Unit tests: quota-attainment percentage calculation, new-customer
  classification (first-sale-ever-in-period check), recovered-customer
  classification (gap + return-after-gap check) — pure functions, same
  pattern as `depth-of-line-tier`/`cadence-target-resolution` tests.
- Route test for `vendedor-360/route.ts`: mock `getDwhPool()`, assert each
  section's query shape and response mapping, following
  `vendedores/route.ts`'s existing test pattern.
- Route test for `seller-targets/route.ts` CRUD: GET/POST/upsert behavior,
  following `visit-cadence-targets`'s existing CRUD test pattern.
- E2E: click a seller name in Vendedores tab → profile view renders with
  all seven sections → "Volver" returns to the list — following this
  repo's existing e2e pattern for tab-level drill-downs (e.g. the Cadencia
  and Profundidad e2e specs).
- Manual: verify print output for at least one seller with real data —
  confirm no section splits mid-page, confirm the activación chart
  actually renders in the printed/PDF output, not just on screen.

## 12. Out of Scope (explicitly deferred)

- Seller self-service login/view.
- Multi-seller comparison view beyond the existing Depth-of-Line
  leaderboard reused in section 7.
- Server-side PDF generation.
- Quota bulk-import from spreadsheet.
- Any change to the underlying logic of Cadencia, Depth of Line,
  Vendedores, or CXC — this feature only adds seller-scoped filters and
  new call sites on top of what already exists.
