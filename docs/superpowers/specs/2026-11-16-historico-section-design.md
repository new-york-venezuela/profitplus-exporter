# Histórico section (legacy-ERP analytics mirror) — design

Status: draft for approval. Date: 2026-11-16.

## Intent and why

Today the legacy (pre-March-2026-cutover) Profit Plus data is shown in one
Analítica tab, "Histórico 2025" (`tab-historico.tsx`,
`app/api/dwh/historico/route.ts`): a monthly / client / línea drilldown over
calendar 2025 only. The owner wants a proper mirror of the main analytics for
the legacy data, as its own section in the sidebar below Analítica, covering the
whole legacy range (Jan 2025 – Feb 2026, i.e. including the few 2026 months).
Purpose: look back at the old system the way they look at the new one, to
compare behaviour over time. (The owner did not elaborate beyond this.)

## Data source (decided by the owner: option "A")

Read the already-imported `fact.Fact_Sales_Legacy`, `fact.Fact_Returns_Legacy`,
`dim.Dim_Customer_Legacy`, `dim.Dim_Product_Legacy`, `dim.Dim_SalesRep_Legacy`
(+ shared `dim.Dim_Date`, `fact.Fact_ExchangeRate`, `dim.Dim_Currency`) through
the existing `getDwhPool()`. No runtime connection to the legacy server; the
`LEGACY_DB_*` vars stay import-script-only. Extending the import (AR, purchases,
routes) is out of scope.

What legacy facts hold: date, customer, product, seller, quantity, net amount
(sin IVA), document rate, voided flag; returns also carry
`OriginalInvoiceDateKey`. They do NOT hold cost, collections/AR, purchases,
routes, visit frequency, registration date, legal-entity rollup, ERP segment
names, or consignment flags.

## Goals

- New sidebar entry "Histórico" under Analítica, route `/historico`.
- Tabs mirroring the main analytics where the data supports it:
  Resumen, Ventas, Devoluciones, Clientes, Productos, Vendedores.
- Full legacy range selectable (Jan 2025 – Feb 2026) with the same date-range
  picker behaviour as Analítica, bounded to that window; Bs / USD toggle.
- Production Analítica tabs untouched in behaviour.

## Non-goals

- CxC, Compras, Finanzas, Multimoneda, Seguimiento goals/pace, Perfil de
  prospecto, Vendedor 360 scorecard: no legacy data.
- Merging or comparing legacy against new-system figures (customers, products
  and sellers are independent identities across the cutover; documented in the
  existing banner).
- Any write path, any new migration, any change to the import script.
- Cost / margin views.

## Anti-goals

- Silent zeros: a missing USD rate is `null` -> "Sin datos", never `$0`
  (same invariant as recipes/statements).
- Fake columns: no tab shows route, frequency, patrimonio/nuevo, tienda/entity
  or cost for legacy rows, not even empty-looking ones.
- Regressing live tabs by touching shared query code in a way that changes
  their output.

## Constraints

- Auth: gated on the `'dwh'` module like `/analitica`. Page redirects, and every
  `/api/dwh/historico/*` route independently calls `requireDwhAccess` (no
  middleware in this app). Sidebar shows the link when `canSeeAnalitica`.
- ERP/DWH rules: DWH queries only; `.input()` for any user-controlled value;
  no joins across databases.
- Money convention (as in the current historico route): paired Bs/USD via
  `dualAmountExpr` + `legacyUsdConversionJoin`; USD uses
  `fact.Fact_ExchangeRate.RateSell` for the row's own date, NOT
  `DocumentExchangeRate`. Returns convert at the ORIGINAL factura's date
  (`legacyReturnsUsdConversionJoin`).
- Ventas brutas = `SUM(NetAmount)` before returns; netas = brutas − devoluciones;
  voided documents excluded (confirm how the current route handles `IsVoided`
  and keep identical).
- Returns are windowed by the devolución's own date by default, as in
  Analítica's convention. The `returnsBasis` selector (devolucion|factura) is
  offered on Resumen/Ventas/Devoluciones as in the main section, because
  `OriginalInvoiceDateKey` exists on legacy returns.
- Legacy identities: customer/product/seller keys are the `*Legacy` keys;
  names come from the legacy dims. Legacy dims have codes but no customer group.
- Spanish UI strings, consistent with the app.

## Approaches considered

1. **Parallel section with its own slim API (chosen).** New `/historico` page and
   `app/api/dwh/historico/*` routes querying `_Legacy` tables, reusing
   presentational components and formatting/pure helpers. Trade-off: some SQL
   shape duplicated; zero risk to live tabs; each tab shows only what legacy
   data supports.
2. Parameterize existing routes/tabs by data source. Rejected: 30K
   `query-builder.ts` and 300–700-line routes depend on columns legacy lacks
   (cost, consignment, current-row Dim_Customer, ERP segment); high regression
   risk on production tabs.
3. SQL views presenting `_Legacy` as `fact.Fact_Sales`/`dim.*` and reuse routes.
   Rejected: unsupported columns would be faked/NULL and surface as
   meaningless "no cost / no route" rows.

## Design

### Structure

- `app/(app)/historico/page.tsx` — server page: session check, `hasDwhAccess`,
  render `HistoricoClient`.
- `app/(app)/historico/historico-client.tsx` — tab shell (own `lib/tab-keys.ts`:
  resumen, ventas, devoluciones, clientes, productos, vendedores), URL-synced
  `?tab=`, `dateRange`, currency; date picker bounded to
  `2025-01-01 .. 2026-02-28` (export the bounds from `lib/dwh/historico-window.ts`,
  replacing the calendar-2025-only constants; this window module is the single
  source for both SQL window and picker).
- `app/api/dwh/historico/<tab>/route.ts` (or `?section=`) per tab; the existing
  `historico/route.ts` is replaced/refactored into these; its tests move.
- Reuse: `GroupedDrilldownTable`, `kpi-card`, `date-range-picker`, `format.ts`,
  `granularity.ts`, `net-sales.ts` (`dualFromRow`, `subtractDual`, `returnRate`),
  `searchable-select`, `returns-basis-selector`, `productos` master-table
  presentational pieces where they take plain props.
- Shared legacy SQL fragments in `lib/historico/` (date window, sales/returns
  windowing, dual-amount joins) so tabs do not each re-derive them.

### Tabs (what each shows; all from `_Legacy`)

- **Resumen**: Ventas strip (brutas / devoluciones / netas, units, active
  customers, avg price) and monthly netas + devoluciones chart with return-rate
  line. "Clientes" cards limited to what legacy can say: total with purchases
  in range (distinct `CustomerLegacyKey`); no activos/nuevos split.
- **Ventas**: drilldown by month / cliente / línea (/ vendedor), with the
  existing granularity control (day/week/month as `granularity.ts` allows).
- **Devoluciones**: returns by month / cliente / producto, return rate, basis
  selector.
- **Clientes**: purchase activity per customer in the range: first/last
  invoice in range, invoices count, brutas/netas, units, return rate, and
  "Sin compras en el período" relative to the full legacy range; Pareto A/B/C
  on netas using `lib/productos/pareto.ts`-style rule. No route, group,
  frequency or patrimonio/nuevo.
- **Productos**: master table by línea / sublínea / SKU (`nivel`), metric
  ventas|unidades, filters línea, sublínea, categoría, q; columns: net, % of
  total, gross with returns, return rate, units, units/month, avg price, reach
  (distinct customers), Pareto, Δ vs previous equal period within the legacy
  window (null when the previous period falls before 2025-01-01).
  No tienda filter, no customer-group matrix, no customer accordion (phase 3)
  in v1.
- **Vendedores**: per legacy seller: brutas, devoluciones, netas, units,
  customers served, monthly trend. No goals, no routes.

### States

- Missing USD rate -> null -> "Sin datos" (never 0). Empty range -> empty state.
- Fixed banner (updated `HistoricoBanner`) on every tab: legacy system, Jan
  2025 – Feb 2026, independent identities, brutas sin IVA, returns basis note.

### Cleanup / migration of the old tab

- Remove `historico` from Analítica's `TAB_KEYS`/`TAB_LABELS`; unknown `?tab=`
  already falls back to Resumen, so old `?tab=historico` links open Resumen
  (add an explicit redirect of `?tab=historico` to `/historico` in
  `analitica-client.tsx`).
- Update AGENTS.md ("Histórico 2025" bullets, directory map, historico-window
  note) and `content/help/` definitions page (add a Histórico help slug
  allowlisted in `app/api/help/[page]/route.ts`).

### Testing

- Unit tests for pure helpers and window bounds; route tests following
  `app/api/dwh/clientes/__tests__` patterns (auth 401/403, bad params 400,
  USD-null handling); a component test for the null -> "Sin datos" rendering;
  DWH integration test only where an existing pattern fits (needs disposable DB).

## Decisions taken by the assistant (owner may override)

- Tab list and omissions above (owner saw and did not change the proposal).
- Route name `/historico` and sidebar label "Histórico".
- `returnsBasis` selector offered on Resumen/Ventas/Devoluciones.
- Existing Analítica "Histórico 2025" tab is removed rather than kept.
- v1 excludes the Productos customer accordion and group matrix.

## Left to the builder

- Exact route/section split, query text, component decomposition and chart
  choices; granularity rules for the 14-month window; help-page copy; how to
  handle `IsVoided` consistently with the current route (keep its behaviour).
