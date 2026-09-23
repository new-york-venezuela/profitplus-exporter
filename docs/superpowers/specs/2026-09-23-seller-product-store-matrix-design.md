# Seller × Product × Store Matrix ("Matriz Vendedor-Producto")

Date: 2026-09-23
Status: Approved, pending implementation plan

## Context

The user wants to identify which sellers are underperforming at growing
"Profundidad de Línea" (depth of product line penetration) at the
seller-and-store level, so they can coach specific sellers on specific gaps.
This is a different granularity than the existing "Profundidad de Línea" tab
(`app/(app)/analitica/tabs/tab-profundidad.tsx`, spec
`2026-09-21-profundidad-linea-tab-design.md`), which shows product-line-tier
penetration (primera/segunda/addon) aggregated by customer segment
(Cadena/Independientes), plus a seller leaderboard comparing each seller's own
penetration to the overall baseline. That tab and its API
(`app/api/dwh/profundidad-linea/route.ts`) are unchanged by this spec.

This spec instead adds a seller-first drill-down: pick one seller, see their
own product × store matrix (with product line/subline/category as row
metadata, e.g. to check "did this seller sell enough Fresco"), and export a
flat, granular table to Excel for arbitrary pivoting by week or month.

### What already exists (verified against the current schema)

- **`dim.Dim_SalesRep`** (`0007_dim_salesrep_warehouse_documenttype.sql`):
  `SalesRepKey`, `SalesRepName`, `ZoneCode`. Already joined by
  `query-builder.ts`'s `vendedor` dimension spec.
- **`dim.Dim_Product`** (`0006_dim_product.sql`): `LineCode`/`LineName`,
  `SubLineCode`/`SubLineName`, `CategoryCode`/`CategoryName` — exactly what's
  needed for line-level target reporting (e.g. "Fresco").
- **`dim.Dim_Customer`** (tienda, i.e. one physical store) and
  **`dim.Dim_LegalEntity`** (entidad, e.g. "Plazas" rolling up
  "Plazas San Bernardino" and other branches) — `0005_dim_customer.sql` /
  `0014_dim_legal_entity.sql`. Already joined by `query-builder.ts`'s
  `cliente_entidad`/`cliente_tienda` dimension specs.
- **`fact.Fact_Sales`** / **`fact.Fact_Returns`**: both carry `SalesRepKey`,
  `ProductKey`, `CustomerKey`, `DateKey`, `NetAmount`,
  `QuantitySold`/`QuantityReturned`, `IsVoided`, and `DocumentExchangeRate`
  (the transaction's own rate at the time it was recorded, sourced from
  `saFacturaVenta.tasa`/`saDevolucionCliente.tasa`). `NetAmount` is stored in
  the ERP's base currency (BS, not USD — see `erp_currency_bsd_usd` memory,
  confirmed live against `par_emp.g_moneda = 'BSD'`).

### Dependency: app-wide historical-USD-conversion fix (separate effort)

**Confirmed live in this session:** every existing DWH route that offers a
`currency=usd` toggle (`ventas`, `dashboard`, `profundidad-linea`, `cxc`,
etc.) converts BS→USD by dividing `NetAmount` by a single **current**
exchange rate (`getUsdRate()` — latest `Fact_ExchangeRate` row), for every
row regardless of that row's own date, even though `DocumentExchangeRate` is
already captured per-row and populated. This misrepresents any historical
trend as BS devalues (e.g. a 12-month chart shows inflated "growth" in USD
terms that isn't real).

This is a pre-existing correctness bug across the whole Analítica dashboard,
not something specific to this feature — **user decision: fix it app-wide,
as its own separate spec, before this one**. See
`2026-09-23-historical-usd-conversion-design.md` for the full design: a
shared per-row conversion expression in `query-builder.ts`
(`NetAmount / NULLIF(COALESCE(DocumentExchangeRate, fx.RateSell), 0)`,
summed per-row before aggregation, with a same-date `Fact_ExchangeRate`
fallback for missing rates). **This spec's implementation plan must not
proceed until that spec is implemented** — this feature's export/matrix
queries call that shared expression directly rather than inventing a
separate one.
- **`dim.Dim_Date`**: has `Year`, `Month`, `MonthName`, `YearMonth` — but
  **no week-level column**. This is the one schema gap this spec fills.
- **`lib/xlsx.ts`**'s `buildXlsx(columns, rows)`: generic XLSX builder
  already used by the ERP `ReportConfig` export path
  (`app/api/reports/[report]/export/route.ts`). Reused as-is; this spec does
  not touch the ERP `ReportConfig` pattern (AGENTS.md is explicit that DWH
  routes never use it) but reuses the same underlying XLSX-writing helper
  directly.
- **`app/api/dwh/lib/query-builder.ts`**: `buildDateWhereClause`,
  `getDimensionSpec`/`isDimensionForFact` for `vendedor`, `producto`,
  `cliente_entidad`, `cliente_tienda` — all reused, no changes needed to this
  file.

### No existing "week" concept in the DWH

`dim.Dim_Date` has no ISO-week or week-start column. Every other tab in this
dashboard rolls up to month (`YearMonth`) or uses `dateRange` window
filtering directly on `DateKey`. This spec adds two columns to
`dim.Dim_Date` — this is the only schema change required.

## Non-goals

- No changes to the existing Profundidad de Línea tab, its tier
  classification, or its seller leaderboard.
- No new `user_modules` module — gated by the existing `dwh` module, same as
  every other Analítica tab.
- No zero-filled cross join (seller × product × store × week for
  combinations with zero activity) — both the web matrix and the XLSX export
  only ever emit rows/cells for combinations with actual sales or returns in
  the selected range. A full cross product would be enormous and useless for
  pivoting (Excel pivot tables handle sparse source data natively).
- No margin/cost data — `Fact_Sales.UnitCost`/`COGSAmount` are unwired
  (`NO_COST_DATA`) per `dwh-migrations/README.md`; this feature only reports
  income (net sales), not margin.

## Schema change: `dim.Dim_Date` gains week columns

New migration `dwh-migrations/0033_dim_date_add_week.sql`:

- `WeekStartDate date NOT NULL` — the Monday of the ISO week containing
  `FullDate` (`DATEADD(day, 1 - ((DATEPART(weekday, FullDate) + 5) % 7 + 1), FullDate)`-style
  anchoring, using `DATEFIRST`-independent arithmetic so the result doesn't
  depend on session `SET DATEFIRST`).
- `YearWeek char(7) NOT NULL` — `'YYYY-Www'` using `DATEPART(iso_week, ...)`
  and the ISO week-year (`YEAR(DATEADD(day, 26 - DATEPART(iso_week, FullDate) * 7, FullDate))`-style,
  i.e. the year the ISO week belongs to, which can differ from `YEAR(FullDate)`
  for dates in the last days of December / first days of January).
- Both columns are backfilled in the same migration via a single `UPDATE`
  against all existing rows (table is small — 2020–2035 daily rows per
  `0003_dim_date.sql`), following the `CREATE OR ALTER`/`IF NOT EXISTS`
  re-runnable convention required by `dwh-migrations/README.md`.
- No changes to any `Load_*` procedure — `Dim_Date` is fully pre-populated by
  `0003_dim_date.sql`, not incrementally loaded.

## New API route: `app/api/dwh/matriz-vendedor/route.ts`

Gated by `requireDwhAccess`, following the existing per-route pattern
(`jsonWithCache` for JSON responses, direct `NextResponse.json` for errors).

### `GET ?section=summary&dateRange=...`

One row per seller with sales in range: `salesRepKey`, `salesRepName`,
`netSales`, `netReturns`, `entitiesServed` (distinct `LegalEntityKey`).
Powers both the seller leaderboard and the searchable seller-picker's option
list (fetched once per `dateRange` change, matching the existing
`profundidad-linea` leaderboard's fetch pattern).

### `GET ?section=matrix&salesRepKey=<key>&dateRange=...`

Scoped to one seller — bounded by construction, since it only touches that
seller's actual customers/products, never a full cross join. Joins
`Fact_Sales`/`Fact_Returns` → `Dim_Product` → `Dim_Customer` →
`Dim_LegalEntity`, grouped by `(ProductKey, CustomerKey)`. Response shape:

```typescript
interface SellerMatrixResponse {
  products: { productKey: number; productName: string; lineName: string | null; subLineName: string | null; categoryName: string | null }[];
  stores: { customerKey: number; customerName: string; legalEntityName: string }[];
  cells: {
    productKey: number;
    customerKey: number;
    netSales: number;
    units: number;
    returnRateUsd: number | null; // null when netSales + returns both 0 (no activity, shouldn't occur since cells are sparse)
    returnRateUnits: number | null;
  }[];
}
```

Only non-zero `(productKey, customerKey)` combinations appear in `cells` —
the web UI renders this as a pivot grid (products as rows, stores as
columns), consistent with the "bounded matrix per seller" UI decision.

### `GET ?format=xlsx&salesRepKey=<key|omit for all>&dateRange=...`

Flat export, one row per `(SalesRepKey, ProductKey, CustomerKey, WeekStartDate)`
combination with non-zero sales or returns in the window. Columns (built via
`buildXlsx`):

| Column | Source |
|---|---|
| Vendedor | `Dim_SalesRep.SalesRepName` |
| Entidad | `Dim_LegalEntity.LegalEntityName` |
| Tienda | `Dim_Customer.CustomerName` |
| Producto | `Dim_Product.ProductName` |
| Línea | `Dim_Product.LineName` |
| Sublínea | `Dim_Product.SubLineName` |
| Categoría | `Dim_Product.CategoryName` |
| Semana | `Dim_Date.WeekStartDate` |
| Mes | `Dim_Date.YearMonth` |
| Ingreso USD | `SUM(NetAmount / DocumentExchangeRate)` per line from `Fact_Sales` — historical, per-transaction conversion (see dependency note above), summed after conversion, not converted-after-sum |
| Unidades | `SUM(QuantitySold)` from `Fact_Sales` |
| Devolución USD | `SUM(NetAmount / DocumentExchangeRate)` per line from `Fact_Returns`, same historical-conversion rule |
| Devolución Unidades | `SUM(QuantityReturned)` from `Fact_Returns` |
| Tasa Devolución USD | Devolución USD ÷ Ingreso USD for that exact row (null/blank when Ingreso USD is 0) |
| Tasa Devolución Unidades | Devolución Unidades ÷ Unidades for that exact row (null/blank when Unidades is 0) |

Converting each line individually before summing (rather than summing raw BS
first and dividing by one rate) matters because a single `(seller, product,
store, week)` row can aggregate multiple invoices issued on different days
within that week, each potentially at a different `DocumentExchangeRate`.

Per-row return rates (not a separate sheet) — confirmed with the user: this
lets the user's own Excel pivot tables re-roll-up the ratio at any grain
(seller, product, store, week, month) without a manual join.

`dateRange` reuses `buildDateWhereClause` exactly as every other DWH route
does; no new date-range parsing.

## New tab: "Matriz Vendedor-Producto"

Added to `TABS` in `app/(app)/analitica/analitica-client.tsx`, gated by the
existing `dwh` module (no new module). New file
`app/(app)/analitica/tabs/tab-matriz-vendedor.tsx`:

1. **Seller leaderboard** (from `section=summary`) — same visual pattern as
   the existing Profundidad seller-coverage table.
2. **Searchable seller picker** (new `SearchableSelect` component, see
   below) — selecting a seller loads `section=matrix` for that seller and
   renders the product × store pivot grid. Empty state when no seller is
   selected yet ("Selecciona un vendedor para ver su matriz").
3. **Line/subline/category filter** on the matrix view, reusing the row
   metadata already present in `SellerMatrixResponse.products` — lets the
   user isolate "Fresco" rows without a server round-trip (client-side
   filter over already-fetched data, same pattern as `tab-profundidad`'s
   `linea`/`sublinea` breadcrumb state, but client-side here since the
   dataset is already scoped to one seller and is small).
4. **Export button** linking to
   `/api/dwh/matriz-vendedor?format=xlsx&salesRepKey=...&dateRange=...`
   (current seller) and a second "Exportar todos los vendedores" button
   omitting `salesRepKey`.

## New component: searchable select

New `lib/components/searchable-select.tsx` — a client-only combobox that
filters an already-fetched, in-memory option list (`{label, value}[]`) as the
user types. No server-side search/debounce needed: every option list in
scope here (sellers, tiendas) is small enough to fetch once. Props mirror a
native `<select>` (`value`, `onChange`, `options`) so it's a drop-in
replacement.

**Adopted by:**
- The new seller picker on this tab.
- `tab-productos.tsx`'s existing "Tienda" `<select>` (refactored in place —
  it's a `Dim_Customer` picker that can have many stores, confirmed as the
  one dropdown-of-customers currently in the analytics module).

**Explicitly not adopted by** (confirmed with user — searching adds friction
for a handful of fixed options, not value):
- `tab-cadencia.tsx`'s segment filter (3 fixed values: Todos/Cadena/Independientes).
- `grouped-drilldown-table.tsx`'s `groupBy`/`breakdownBy` selects (4–5 fixed
  enum values each).

**New AGENTS.md guideline** (added under "Code Conventions"): any dropdown
whose option list is data-driven and can grow past a handful of items (e.g.
a picker over `Dim_Customer`, `Dim_SalesRep`, or similar) must use
`SearchableSelect` instead of a native `<select>`; a fixed, small enum
(segment, group-by mode, yes/no) stays a native `<select>`.

## Testing

Following the repo's existing per-DWH-route pattern:

- `app/api/dwh/matriz-vendedor/__tests__/route.test.ts` — integration test
  against a disposable DWH (via `bun test --isolate --env-file=.env.local
  --timeout 30000`), covering `summary`, `matrix`, and `format=xlsx` (asserts
  the XLSX buffer parses back to the expected rows via the `xlsx` library,
  same as `lib/xlsx.test.ts`'s existing approach).
- A unit test for the `Dim_Date` week backfill: verify `WeekStartDate` is
  always a Monday and `YearWeek` correctly handles a December-into-January
  ISO week-year boundary (e.g. 2025-12-29 through 2026-01-04, which spans a
  calendar-year boundary but is a single ISO week).
- A component-level check (manual or React Testing Library, matching
  whatever this repo's existing component test coverage convention is — none
  of the current tabs appear to have component tests, so this can stay
  manual, verified in-browser) for `SearchableSelect`'s type-to-filter
  behavior and that `tab-productos`'s refactored Tienda selector still
  round-trips the same `tienda` state correctly.

## Open items resolved during brainstorming

- **Web UI shape**: seller picker + bounded 2D matrix per seller (not a full
  3-way cross-join grid) — confirmed.
- **Return-rate grain**: per-row (seller+product+store+week), not a separate
  returns sheet — confirmed.
- **Scope**: new tab, not an extension of the existing Profundidad tab —
  confirmed. Product line/subline/category included as row metadata, not
  just SKU — confirmed (enables "sell at least this much Fresco" style
  checks).
- **Searchable-select scope**: seller picker (new) + Tienda selector in
  tab-productos (existing) — confirmed. No other selector in the analytics
  module currently qualifies.
- **USD conversion**: discovered mid-design that every existing DWH route's
  `currency=usd` toggle uses a single current exchange rate for all rows
  regardless of date — a pre-existing bug, now specced separately as
  `2026-09-23-historical-usd-conversion-design.md`. This spec's export
  columns depend on that spec's shared conversion helper (see "Dependency"
  section above). **This spec should not be implemented until that
  dependency spec is implemented.**
