# Analítica histórica (legacy-ERP analytics mirror) — design

Status: revised 2026-11-16 after the builder check and the owner's
follow-up (2020 window, legacy exchange rates, same behaviour as Analítica,
truncate migration 0042). Not yet approved.

## Intent and why

Today the legacy (pre-March-2026-cutover) Profit Plus data is shown in one
Analítica tab, "Histórico 2025" (`tab-historico.tsx`,
`app/api/dwh/historico/route.ts`): a monthly / client / línea drilldown over
calendar 2025 only. The owner wants a proper mirror of the main analytics for
the legacy data, as its own section in the sidebar below Analítica, covering the
whole legacy range: **2020-01-01 through the end of the legacy data
(Feb 2026)**. The owner believes the legacy server holds clean data from 2020
on; this is an assumption to verify with a read-only query before the re-import.
The section is called "Analítica histórica" (route `/analitica-historica`).
Purpose: look back at the old system the way they look at the new one, to
compare behaviour over time. (The owner did not elaborate beyond this.)

## Data source (decided by the owner: option "A", import widened)

The imported tables only hold 2025-01-01 .. 2026-02-28 today
(`IMPORT_START_DATE`/`IMPORT_END_DATE` in `scripts/dwh-legacy-2025-import.ts`).
To reach 2020 the import is re-run over a wider range, after migration
`0042_truncate_legacy_tables.sql` (written, not yet applied) empties the five
`_Legacy` tables. The owner runs the import against production; the script keeps
refusing to run on a non-empty `Fact_Sales_Legacy`.

Read the imported `fact.Fact_Sales_Legacy`, `fact.Fact_Returns_Legacy`,
`dim.Dim_Customer_Legacy`, `dim.Dim_Product_Legacy`, `dim.Dim_SalesRep_Legacy`
(+ shared `dim.Dim_Date`, `fact.Fact_ExchangeRate`, `dim.Dim_Currency`) through
the existing `getDwhPool()`. No runtime connection to the legacy server; the
`LEGACY_DB_*` vars stay import-script-only. Extending the import beyond sales,
returns and exchange rates (AR, purchases, routes) is out of scope.

### Exchange rates come from the OLD ERP too

Legacy USD today converts through `fact.Fact_ExchangeRate`, which is loaded from
the CURRENT ERP's `saTasa` (`fecha >= 2020-01-01`) and may not cover 2020-2025,
or may hold different rates. The owner wants rates taken from the old ERP's
tables. So:
- New migration (next number after 0042): `fact.Fact_ExchangeRate_Legacy`
  (DateKey FK to `dim.Dim_Date`, RateBuy, RateSell, IsCarriedForward; USD only
  unless the legacy `saTasa` shows other relevant currencies), one row per
  calendar day like `Fact_ExchangeRate`, carry-forward on days with no real rate.
  Its truncate belongs in the same import re-run guard.
- The import script gains a step reading the legacy server's `saTasa`
  (`co_mone` USD, `tasa_v`/`tasa_c`) and loading it, using the same carry-forward
  rule as 0036.
- All legacy USD conversion (sales at the invoice date, returns at the ORIGINAL
  factura's date) uses `Fact_ExchangeRate_Legacy`, via new legacy-specific
  helpers; the current `legacyUsdConversionJoin` (which reads
  `Fact_ExchangeRate`) is not reused for this section. A day with no legacy rate
  -> null -> "Sin datos".
- Open check (needs the legacy server): how `saTasa` looks there (currency
  codes, whether it has every day or only changes, gaps around the redenomination
  of Bs.). The plan's first task is a read-only probe of it; unusual shapes come
  back to the owner.

What legacy facts hold: date, customer, product, seller, quantity, net amount
(sin IVA), document rate, voided flag; returns also carry
`OriginalInvoiceDateKey`. They do NOT hold cost, collections/AR, purchases,
routes, visit frequency, registration date, legal-entity rollup, ERP segment
names, or consignment flags.

## Goals

- New sidebar entry "Analítica histórica" under Analítica, route
  `/analitica-historica`.
- Tabs mirroring the main analytics where the data supports it:
  Resumen, Ventas, Devoluciones, Clientes, Productos, Vendedores.
- **Behave like Analítica**: same date-range picker (presets, custom range,
  `month:` ranges, URL params), same granularity control, same Bs / USD toggle,
  same `returnsBasis` selector (devolucion|factura, default devolucion) and
  returns rules, same gross/net definitions and null-USD rule. The one
  deliberate difference: relative presets ("30 días", "12 meses", "Este mes"...)
  are anchored to the end of the legacy window instead of today, because
  anchoring to today would always return nothing; the picker is clamped to
  the window.
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
  `/api/dwh/analitica-historica/*` route independently calls `requireDwhAccess` (no
  middleware in this app). Sidebar shows the link when `canSeeAnalitica`.
- ERP/DWH rules: DWH queries only; `.input()` for any user-controlled value;
  no joins across databases.
- Money convention (as in the current historico route): paired Bs/USD via
  `dualAmountExpr` + `legacyUsdConversionJoin`; USD uses
  `fact.Fact_ExchangeRate.RateSell` for the row's own date, NOT
  `DocumentExchangeRate`. Returns convert at the ORIGINAL factura's date
  (`legacyReturnsUsdConversionJoin`).
- Ventas brutas = `SUM(NetAmount)` before returns; netas = brutas − devoluciones;
  voided documents excluded (`IsVoided = 0` on sales and returns, as the current
  route does).
- Returns are windowed by the devolución's own date by default, as in
  Analítica's convention. The `returnsBasis` selector (devolucion|factura) is
  offered on Resumen/Ventas/Devoluciones as in the main section, because
  `OriginalInvoiceDateKey` exists on legacy returns.
- Legacy identities: customer/product/seller keys are the `*Legacy` keys;
  names come from the legacy dims. Legacy dims have codes but no customer group.
- Spanish UI strings, consistent with the app.

## Approaches considered

1. **Parallel section with its own slim API (chosen).** New `/analitica-historica` page and
   `app/api/dwh/analitica-historica/*` routes querying `_Legacy` tables, reusing
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

- `app/(app)/analitica-historica/page.tsx` — server page: session check, `hasDwhAccess`,
  render `HistoricoClient`.
- `app/(app)/analitica-historica/analitica-historica-client.tsx` — tab shell (own `lib/tab-keys.ts`:
  resumen, ventas, devoluciones, clientes, productos, vendedores), URL-synced
  `?tab=`, `dateRange`, currency; date picker bounded to
  `2020-01-01 .. <end of legacy data, Feb 2026>` (export the bounds from `lib/dwh/historico-window.ts`,
  replacing the calendar-2025-only constants; this window module is the single
  source for both SQL window and picker).
- `app/api/dwh/analitica-historica/<tab>/route.ts` (or `?section=`) per tab; the existing
  `app/api/dwh/historico/route.ts` is removed and its tests ported.
- Reuse: `GroupedDrilldownTable`, `kpi-card`, `date-range-picker`, `format.ts`,
  `granularity.ts`, `net-sales.ts` (`dualFromRow`, `subtractDual`, `returnRate`),
  `searchable-select`, `returns-basis-selector`, `productos` master-table
  presentational pieces where they take plain props.
- Shared legacy SQL fragments in `lib/analitica-historica/` (date window, sales/returns
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
  window (null when the previous period falls before 2020-01-01).
  No tienda filter, no customer-group matrix, no customer accordion (phase 3)
  in v1.
- **Vendedores**: per legacy seller: brutas, devoluciones, netas, units,
  customers served, monthly trend. No goals, no routes.

### States

- Missing USD rate -> null -> "Sin datos" (never 0). Empty range -> empty state.
- Fixed banner (updated `HistoricoBanner`) on every tab: legacy system, Jan
  2020 – Feb 2026, independent identities, brutas sin IVA, returns basis note.

### Cleanup / migration of the old tab

- Remove `historico` from Analítica's `TAB_KEYS`/`TAB_LABELS`; unknown `?tab=`
  already falls back to Resumen, so old `?tab=historico` links open Resumen
  (add an explicit redirect of `?tab=historico` to `/analitica-historica` in
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
- Route `/analitica-historica`, sidebar label "Analítica histórica".
- `returnsBasis` selector offered on Resumen/Ventas/Devoluciones.
- Existing Analítica "Histórico 2025" tab is removed rather than kept.
- v1 excludes the Productos customer accordion and group matrix.

## Answers from the builder check (settled)

Already answered by the code:
- **Voided rows**: the current route excludes them on both sides
  (`fsl.IsVoided = 0` and `frl.IsVoided = 0`). Keep exactly that everywhere.
- **Product hierarchy**: `dim.Dim_Product_Legacy` has `LineCode/LineName`,
  `SubLineCode/SubLineName`, `CategoryCode/CategoryName`, so línea / sublínea /
  categoría filters and the `nivel` levels work. Null line -> `'SIN_LINEA'`
  bucket, as the current route does.

Assistant's calls (owner may override):
- **Seller attribution (Vendedores)**: by the document's own seller
  (`SalesRepLegacyKey` on the fact row), since legacy has no "current customer
  seller". Rows with a NULL seller group as "Sin vendedor", so totals still
  reconcile with Resumen. "Customers served" = distinct customers with a
  non-voided sale in range for that seller.
- **Customer populations**: "active / with purchases" = at least one
  non-voided sale in the selected range. The Clientes tab's universe is every
  customer with any non-voided sale in the full legacy window; those with none
  in the selected range are listed as "Sin compras en el período".
- **Parity check**: the old Histórico 2025 numbers are the regression
  baseline. For 2025-01-01..2025-12-31 the new Ventas / Devoluciones totals in
  **Bs** must equal the old tab's. **USD** may legitimately differ, because the
  new section converts with the old ERP's own rates (`Fact_ExchangeRate_Legacy`)
  instead of `Fact_ExchangeRate`; the plan reports the size of the difference
  rather than forcing equality. Port the old route's tests as the starting point.
- **Date controls**: identical to Analítica (presets, custom range, `month:`
  ranges, granularity), except relative presets are anchored to the end of the
  legacy window (not today) and the range is clamped to
  2020-01-01..window end. Opens on the last 12 months of the window.
- **Granularity**: reuse `granularity.ts` rules; builder checks they behave for
  a ~6-year window.

Verification the plan must start with (the local DWH copy is stale, so this is
a production check the owner may need to run or approve):
- After the re-import, confirm `MIN/MAX(DateKey)` of `Fact_Sales_Legacy` and
  `Fact_Returns_Legacy` in the real DWH and that `Fact_ExchangeRate_Legacy` has
  `RateSell` for each day in the window. If Jan–Feb 2026 are missing or partial, derive the window and
  picker bounds from the actual data (keep them in `historico-window.ts`), and
  show "Sin datos" where a rate is missing; do not assume the import end date.

## Left to the builder

- Exact route/section split, query text, component decomposition and chart
  choices; help-page copy.
