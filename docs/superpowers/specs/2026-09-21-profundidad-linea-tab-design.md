# Depth of Line ("Profundidad de Línea") Tab

Date: 2026-09-21
Status: Approved, pending implementation plan

## Context

This is the first of four related initiatives requested together:

1. **This spec** — a new analytics tab to find which products aren't reaching
   all customers in a category, and classify products into first-line
   ("must be everywhere"), second-line ("should be in many places meeting
   specific criteria"), and addon ("fits specific customer characteristics").
2. Seller commission reliability under consignment (Notas de Entrega not
   tracked in-system) — separate spec.
3. Seller × depth-of-line gap view (which sellers have coverage gaps in their
   own customer/product matrix) — separate spec, builds on this one's matrix.
4. Active-customer visit cadence (sales as a proxy for visit frequency) —
   separate spec.

All four will be implemented together once specs 2–4 are written, but each is
designed and reviewed independently.

### What already exists

The Productos tab (`app/(app)/analitica/tabs/tab-productos.tsx`) already has a
"Profundidad de Línea" widget backed by `profundidadLineaQuery` in
`app/api/dwh/productos/route.ts`. It shows, per top-15 SKU: distinct
`ClientCount`/`clientShare` (share of active **legal entities**, not raw
customer rows), `StoreCount`/`storeShare`, average monthly price/units, and
return rate. This is a flat leaderboard with a single pooled penetration
number — it does not break penetration out by customer segment, is not a
matrix, has no drill-down to see *which* customers are missing a product, and
has no first/second-line/addon classification. That widget stays as-is; this
spec adds a new, separate tab that answers a different question using the
same underlying facts.

### Dimensions this reuses (verified live against `Ncake_a`, 2026-09-21)

- **`Dim_Customer.SegmentCode`** (sourced from `saCliente.co_seg` →
  `saSegmento`): confirmed live that among all 132 active, currently-selling
  customers, this column takes exactly two values — `CADENA` (72 customers)
  and `INDEPENDIENTES` (60 customers) — with **zero** nulls/blanks. Although
  `saSegmento` itself is a messy 78-row catalog reused across modules for
  unrelated things (cost centers, third-party names), the subset that actually
  reaches real selling customers is clean. This is the segment rollup axis
  for the matrix. No new ETL needed.
- **`Dim_LegalEntity`/`Dim_Customer.LegalEntityKey`** (`dwh-migrations/0014_dim_legal_entity.sql`):
  already rolls up multi-tienda chains (e.g. Excelsior Gama's many store
  codes) to one commercial entity, and is already used by the existing
  Profundidad widget for exactly this purpose (`ClientCount` = distinct
  `LegalEntityKey`, `StoreCount` = distinct `CustomerKey`). The new matrix
  counts penetration at the **legal-entity** grain, matching this existing
  convention — a chain counts once, not once per tienda.
- **`Dim_Product`** (`LineCode`/`LineName`, `SubLineCode`/`SubLineName`,
  `CategoryCode`/`CategoryName`): existing hierarchy, used for the drill
  breadcrumb (línea → sublínea → SKU), same pattern as `productos/route.ts`.
- **`Fact_Sales`**: source of truth for "did this entity buy this product,"
  joined the same way the existing Profundidad query does.

No DWH migration is required for this spec — everything needed is already
loaded.

## Goal

Given a product (or product line), show penetration into each customer
segment (CADENA / INDEPENDIENTES) at the legal-entity grain, let the user see
exactly which entities in a segment are *not* buying a given product, and
classify products into first-line / second-line / addon tiers based on
penetration and volume so the user can prioritize which gaps matter most.

## Design

### Tab and navigation

New tab `profundidad` added to `TABS` in
`app/(app)/analitica/analitica-client.tsx`, positioned after `productos`.
Gated the same way every other analytics tab is — by `hasDwhAccess()`, no new
module needed (this lives inside the existing `dwh` module gate).

### API route

New route: `app/api/dwh/profundidad-linea/route.ts`. Kept separate from
`productos/route.ts` rather than added into it — different query shapes
(segment-partitioned aggregates, a gap-list drill query) that don't share
enough SQL with the existing línea/sublínea/sku breadcrumb queries to justify
merging, and keeping it separate avoids growing an already-366-line file.
Follows the same conventions as every other `app/api/dwh/*` route:
`requireDwhAccess`, `getDwhPool()`, `.input()` for all parameters,
`buildDateWhereClause`, `jsonWithCache`.

Query parameters: `dateRange` (reuse existing convention, e.g. `12m`),
`linea` (optional, scopes to a product line), `segment` (optional,
`CADENA` | `INDEPENDIENTES`, for the drill/gap-list calls).

### Section 1 — Matrix (línea × segment penetration)

Top level: one row per product line (drillable into sublínea, then SKU —
same breadcrumb interaction as the Productos tab), one column per segment
(`CADENA`, `INDEPENDIENTES`), plus a pooled "Total" column matching today's
widget. Each cell shows penetration (`entitiesBuyingInSegment /
entitiesActiveInSegment`) and absolute counts, e.g. "18/72 (25%)".

Query shape (conceptual — final SQL written at implementation time):

```sql
SELECT
  ISNULL(p.LineName, 'Sin línea') AS GroupLabel,
  c.SegmentCode,
  COUNT(DISTINCT c.LegalEntityKey) AS EntitiesBuying,
  SUM(fs.NetAmount) AS SalesNet,
  SUM(fs.QuantitySold) AS QuantitySold
FROM fact.Fact_Sales fs
JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
WHERE fs.IsVoided = 0 AND c.SegmentCode IS NOT NULL <dateWhere>
GROUP BY ISNULL(p.LineName, 'Sin línea'), c.SegmentCode
```

paired with a per-segment entity-count denominator query (same pattern as
today's `activeTotalsQuery`, but `GROUP BY c.SegmentCode` instead of pooled).

### Section 2 — Gap drill-down

Clicking a matrix cell (a línea/sublínea/SKU × segment combination) opens a
panel listing every legal entity in that segment that has **not** bought that
product in the selected date range — the literal answer to "who am I missing
this to." Query: all `LegalEntityKey`s with `SegmentCode = @segment` and any
sale at all in range (i.e., active customers, not lapsed ones — consistent
with the "active" definition used elsewhere in this DWH), minus those with a
`Fact_Sales` row for the selected product/line in range. Sorted by the
entity's total sales net in range descending, so the biggest, most obviously-
should-be-buying-this accounts surface first.

### Section 3 — First-line / second-line / addon classification

Computed client-side (in the API response, not stored) from two inputs per
product: **penetration** (share of active entities buying it, pooled across
segments) and **volume rank** (its `SalesNet` or `QuantitySold` percentile
among all products). Default thresholds, shown as editable number inputs in
the UI (not hardcoded — the user tunes what "great amounts" means for their
business) and passed as query params, persisted in `localStorage` only
(view preference, not shared state):

- **Primera línea**: penetration ≥ `firstLineMinPenetration` (default 70%)
  — "must be everywhere."
- **Segunda línea**: penetration ≥ `secondLineMinPenetration` (default 30%)
  and < the first-line bar — "should be in many places."
- **Addon**: below the second-line bar but with at least one sale — "fits
  specific customers."
- Products with zero sales in range are excluded from classification (shown
  separately as "sin ventas en el período" if relevant, not tiered).

This tier is shown as a column/badge in the matrix and is filterable (e.g.
"show only segunda línea products with penetration gaps in INDEPENDIENTES").

Pooled penetration (`totalPenetration`, used for classification) is
`(sum of entitiesBuying across both segments) / (sum of entitiesActive across
both segments)` — safe because each `LegalEntityKey` maps to exactly one
`SegmentCode` (segment is a customer-level attribute, not a per-sale one), so
summing counts across segments never double-counts an entity.

### Types

New interfaces in `app/(app)/analitica/types.ts`, following the existing
`ProfundidadLineaRow`/`ProfundidadLineaResponse` naming pattern:

```typescript
export type CustomerSegment = 'CADENA' | 'INDEPENDIENTES';

export interface DepthMatrixCell {
  segment: CustomerSegment;
  entitiesBuying: number;
  entitiesActive: number;
  penetration: number | null; // entitiesBuying / entitiesActive
  salesNet: number;
}

export interface DepthMatrixRow {
  label: string;           // línea, sublínea, or SKU name depending on drill level
  cells: DepthMatrixCell[];
  totalPenetration: number | null; // pooled across segments
  tier: 'primera' | 'segunda' | 'addon' | 'sin-ventas';
}

export interface DepthMatrixResponse {
  rows: DepthMatrixRow[];
  breadcrumb: { label: string; groupBy: 'linea' | 'sublinea' | 'sku' }[];
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

### UI component

New file `app/(app)/analitica/tabs/tab-profundidad.tsx`, following the
existing tab pattern (own `useState`/`useEffect` data fetching, `ChartCard`/
table layout helpers already used by sibling tabs — no new layout primitives
needed). Breadcrumb drill (línea → sublínea → SKU) mirrors
`tab-productos.tsx`'s existing interaction exactly. Gap drill-down renders as
an expandable row or side panel (implementation detail, decide during
build — a modal is also acceptable; whichever matches how `tab-clientes.tsx`
or `tab-productos.tsx` already handles a similar drill/detail interaction).

### Error handling / edge cases

- A product line with entities in only one segment (e.g. a B2B-only line)
  shows `—` for the other segment's penetration rather than `0%`, to avoid
  implying a gap where the product was never applicable.
- `SegmentCode IS NULL` customers (none exist today among active sellers, per
  live verification, but the query defensively excludes them rather than
  crashing) are excluded from both the matrix and gap lists, not bucketed
  into a third pseudo-segment.
- Currency toggle (`bs`/`usd`) reuses `getUsdRate()`/`moneyLabel` exactly as
  other tabs do — penetration percentages are currency-independent.

## Testing

- Unit test for the tier-classification function (pure, given penetration +
  volume rank inputs, following the pattern of
  `app/api/dwh/finanzas/__tests__/margen-proxy.test.ts` — a pure calculation
  tested in isolation from the route).
- Route test following `app/api/dwh/vendedores/__tests__/route.test.ts`'s
  shape: mock `getDwhPool`, assert on query shape and response mapping.
- Manual verification against the live `Ncake_a`/DWH test data: confirm the
  CADENA/INDEPENDIENTES split matches the two-value reality confirmed above,
  and that a known-ubiquitous product (something already showing high
  `clientShare` in the existing Profundidad widget) lands in "primera línea."

## Out of scope (explicitly deferred to other specs)

- Seller dimension on this matrix (spec 3).
- Any commission or consignment logic (spec 2).
- Visit-cadence / last-sale-date tracking (spec 4).
- Persisting user-tuned thresholds server-side or per-user (`localStorage`
  only, for now — revisit if multiple users need to share tuned thresholds).
