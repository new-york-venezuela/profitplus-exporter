# Analítica histórica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new sidebar section "Analítica histórica" (`/analitica-historica`) that mirrors the main analytics tabs (Resumen, Ventas, Devoluciones, Clientes, Productos, Vendedores) over the legacy-ERP data in the `_Legacy` DWH tables, 2020-01-01 through the end of the legacy data.

**Architecture:** A parallel page + slim API (`app/api/dwh/analitica-historica/*`) querying `fact.Fact_Sales_Legacy` / `fact.Fact_Returns_Legacy` / `dim.*_Legacy` through `getDwhPool()`. Shared pure helpers in `lib/analitica-historica/` (window/range maths, SQL fragments). The legacy import is widened to 2020 and also loads the old ERP's `saTasa` into a new `fact.Fact_ExchangeRate_Legacy`; all legacy USD conversion uses that table. Presentational pieces from `app/(app)/analitica/` are reused; production Analítica tabs are not changed (except removing the old Histórico 2025 tab at the end).

**Tech Stack:** Next.js 16 App Router, Bun, `mssql`, Recharts, Tailwind, `bun test` (+ React Testing Library on happy-dom for components).

**Spec:** `docs/superpowers/specs/2026-11-16-historico-section-design.md`

## Global Constraints

- Window starts `2020-01-01` (`HIST_START_KEY = 20200101`); the end is one constant in `lib/analitica-historica/window.ts`, set from the real data in Task 4 (initially `20260228`).
- Voided documents excluded everywhere: `IsVoided = 0` on sales AND returns (as the current historico route).
- `ventas brutas = SUM(NetAmount)` (sin IVA, before returns); `netas = brutas − devoluciones`.
- Returns windowed by the devolución's own date (`DateKey`) by default; `returnsBasis=factura` windows by `OriginalInvoiceDateKey`. USD for returns always converts at the ORIGINAL factura's date. Default basis `devolucion`.
- USD uses `fact.Fact_ExchangeRate_Legacy.RateSell` for the row's own date; never `DocumentExchangeRate`, never `fact.Fact_ExchangeRate`. A day with no rate -> `null` USD -> "Sin datos", never `$0`.
- Null/blank product line -> bucket `'SIN_LINEA'`; null seller -> "Sin vendedor".
- Gate: module `'dwh'`, enforced independently on the page (`hasDwhAccess`, redirect to `/inicio`) and on every `/api/dwh/analitica-historica/*` route (`requireDwhAccess`, 401/403). No middleware exists.
- Every user-controlled SQL value through `.input()`; only integers produced by `resolveHistRange` are interpolated. Errors are `{ error: string }` with a status. DWH only; no ERP tables; no cross-database joins.
- No date library: use `lib/dates.ts` / native `Date`. UI strings in Spanish.
- Legacy identities are independent of current ones: never join `_Legacy` to current dims.
- `LEGACY_DB_*` is read only by `scripts/dwh-legacy-2025-import.ts` (and the probe script), never by the running app.
- Migrations in `migrations/dwh/` are numbered and safely re-runnable (`IF NOT EXISTS` / `CREATE OR ALTER`), except 0042, which is intentionally destructive.

## Review Focus

- A day (or whole early period) with no legacy rate -> USD `null` and "Sin datos" in the UI, never `0` (Tasks 2, 5, 7).
- Range requests outside the window, reversed `custom:` ranges, and unknown `dateRange` strings -> clamped or an empty result, never a 500 (Task 4).
- A return with no invoice link (`HasInvoiceLink = 0`) under `returnsBasis=factura` is counted at its own date, so returns are never dropped (Task 9).
- A customer or product with only returns in the range appears with negative net, shown signed (Tasks 10, 11).
- Sales with a NULL seller still reconcile with Resumen totals via "Sin vendedor" (Task 12).

---

## File Structure

- `scripts/dwh-legacy-probe.ts` (new) — read-only probe of the legacy server.
- `migrations/dwh/0043_fact_exchangerate_legacy.sql` (new) — legacy rates table.
- `scripts/dwh-legacy-2025-import.ts` (modify) — 2020 window, bulk inserts, rates loader.
- `lib/analitica-historica/window.ts`, `sql.ts`, `params.ts` (new) — range maths, SQL fragments, request-param parsing.
- `app/(app)/analitica-historica/` (new) — `page.tsx`, `analitica-historica-client.tsx`, `types.ts`, `lib/tab-keys.ts`, `components/hist-banner.tsx`, `tabs/tab-*.tsx`.
- `app/api/dwh/analitica-historica/{resumen,ventas,devoluciones,clientes,productos,vendedores}/route.ts` (new).
- `lib/nav.ts` (modify) — sidebar link. Removed at the end: old Histórico tab/route/banner/types/window.

Manual checkpoint (the owner, not an agent task) sits after Task 3: apply migrations 0042 + 0043 (`bun run migrate:dwh`), run the widened import, then continue from Task 4. Use the actual `package.json` script name for the DWH migration runner.

### Task 1: Read-only legacy probe

**Files:**
- Create: `scripts/dwh-legacy-probe.ts`

**Interfaces:**
- Produces: `bun scripts/dwh-legacy-probe.ts` prints, from the legacy server (read-only SELECTs, `buildLegacyConfig()`/`getLegacyPool()` imported from `scripts/dwh-legacy-2025-import.ts`): (a) `MIN/MAX(fec_emis)` and invoice counts per year from `saFacturaVenta`; (b) same for `saDevolucionCliente`; (c) `saTasa` shape: distinct `co_mone`, `MIN/MAX(fecha)`, row count per year per `co_mone`, count of calendar days with no row, and first/last `tasa_v`/`tasa_c` for USD; (d) whether `saTasa` has `validador`.

- [ ] **Step 1:** Write the script (SELECT only; `process.exit(1)` with a message if `LEGACY_DB_*` is unset). No test: it is a diagnostic.
- [ ] **Step 2:** Owner runs it (`bun --env-file=.env.local scripts/dwh-legacy-probe.ts`) and pastes the output back. Decisions it feeds: whether 2020 data exists, the currency code(s) to load in Task 2/3, whether rates are daily or change-only, and the Bs redenomination discontinuity (record the dates).
- [ ] **Step 3: Commit** `feat(dwh): legacy server probe script`.

### Task 2: `fact.Fact_ExchangeRate_Legacy` migration

**Files:**
- Create: `migrations/dwh/0043_fact_exchangerate_legacy.sql`
- Test: `scripts/dwh/__tests__/legacy-2025-schema.test.ts` (extend; it already asserts the other legacy tables)

**Interfaces:**
- Produces: `fact.Fact_ExchangeRate_Legacy(DateKey int NOT NULL PRIMARY KEY REFERENCES dim.Dim_Date(DateKey), RateBuy decimal(21,8) NULL, RateSell decimal(21,8) NOT NULL, IsCarriedForward bit NOT NULL DEFAULT 0, LoadedAtUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME())` — USD only, one row per calendar day. If the Task 1 probe shows another currency matters, add `CurrencyCode char(6)` to the PK and update Tasks 3/5 accordingly.

- [ ] **Step 1:** Add a test to the schema test: after migrations, the table exists with exactly those columns and `DateKey` is the PK.
- [ ] **Step 2:** Run `bun test --isolate --env-file=.env.local --timeout 30000 scripts/dwh/__tests__/legacy-2025-schema.test.ts`; expect FAIL (needs a disposable `DW_NAME`).
- [ ] **Step 3:** Write the migration (`IF NOT EXISTS (sys.tables ...)` pattern from 0034).
- [ ] **Step 4:** Re-run; expect PASS. Also re-run a second time to prove re-runnability.
- [ ] **Step 5: Commit** `feat(dwh): fact.Fact_ExchangeRate_Legacy`.

### Task 3: Widen the legacy import (2020, bulk inserts, legacy rates)

**Files:**
- Modify: `scripts/dwh-legacy-2025-import.ts`
- Test: `scripts/dwh/__tests__/legacy-2025-import-date-window.test.ts`, new `scripts/dwh/__tests__/legacy-rates-fill.test.ts`

**Interfaces:**
- Produces: `IMPORT_START_DATE = '2020-01-01'` (end stays `'2026-02-28'`); `export function fillRatesCarryForward(rows: { dateKey: number; rateBuy: number | null; rateSell: number }[], startKey: number, endKey: number): { dateKey: number; rateBuy: number | null; rateSell: number; isCarriedForward: boolean }[]` (pure: one entry per calendar day from `startKey` to `endKey`; days without a real row repeat the last real rate with `isCarriedForward = true`; days before the first real rate are omitted); `export async function loadFactExchangeRateLegacy(legacyPool, dwhPool): Promise<number>` (reads legacy `dbo.saTasa` for USD, applies `fillRatesCarryForward`, bulk-inserts).
- Consumes: Task 1's findings (currency code, daily vs change-only), Task 2's table.

- [ ] **Step 1:** Update the date-window test: start is `'2020-01-01'`, end `'2026-02-28'`. Add `fillRatesCarryForward` tests: a gap of 3 days repeats the prior rate with `isCarriedForward` true; a real row after a carried day replaces it; leading days before the first rate are absent; a single real row yields rows only from its day on.
- [ ] **Step 2:** Run `bun test scripts/dwh/__tests__/legacy-2025-import-date-window.test.ts scripts/dwh/__tests__/legacy-rates-fill.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement the constant change and `fillRatesCarryForward`; update the pre-flight message in `main()` to check `Fact_ExchangeRate_Legacy` instead of `Fact_ExchangeRate`; call `loadFactExchangeRateLegacy` before the sales/returns loaders; update `assertNotAlreadyImported`'s message to also mention `fact.Fact_ExchangeRate_Legacy` and migration 0042.
- [ ] **Step 4:** Replace the row-by-row `INSERT` loops in `loadFactSalesLegacy` / `loadFactReturnsLegacy` with `sql.Table` bulk inserts in batches (about 5,000 rows) — six years of facts is too slow one round trip per row. Keep the existing skip rule (no matching dim row) and column mapping unchanged.
- [ ] **Step 5:** Run the two unit tests; expect PASS. Run `bun run typecheck` (or the repo's tsc script).
- [ ] **Step 6: Commit** `feat(dwh): widen legacy import to 2020 and load legacy exchange rates`.

**Owner checkpoint:** apply 0042 and 0043, run `bun --env-file=.env.local scripts/dwh-legacy-2025-import.ts`, then run `SELECT MIN(DateKey), MAX(DateKey), COUNT(*) FROM fact.Fact_Sales_Legacy` (same for returns and the rates table) and share the results.

### Task 4: Window, range and preset maths

**Files:**
- Create: `lib/analitica-historica/window.ts`
- Test: `lib/analitica-historica/window.test.ts`

**Interfaces:**
- Produces:
  - `HIST_START_KEY: 20200101`, `HIST_END_KEY: number` (set to the real MAX date key found at the checkpoint; the initial `20260228` if unchanged), `keyToIso(key: number): string`, `isoToKey(iso: string): number`.
  - `resolveHistRange(dateRange: string): { startKey: number; endKey: number; empty: boolean }` — handles `custom:YYYY-MM-DD:YYYY-MM-DD`, `month:YYYY-MM`, `ytd:YYYY`, `30d` (30 days ending at `HIST_END_KEY`), `12m` (365 days ending at `HIST_END_KEY`), anything else = `12m`. Clamps to the window; swaps a reversed custom range; `empty` is true when nothing remains after clamping.
  - `histRangeWhere(range: { startKey: number; endKey: number }, alias: string, column?: string): string` -> `AND alias.column >= S AND alias.column <= E` (integers only).
  - `previousRange(range): { startKey: number; endKey: number } | null` — equal-length window immediately before; `null` when it would start before `HIST_START_KEY`.
  - `histPresetRange(preset: '30d' | 'month' | 'month-prev' | 'year' | '12m' | 'all'): string` — returns a concrete `custom:`/`month:` URL value anchored to `HIST_END_KEY` (e.g. `'month'` = the window's last month, `'year'` = Jan 1 of the window's last year to the end).
  - `resolveHistGranularityRange` is NOT needed: the client only ever writes `custom:`/`month:` values, so `granularity.ts` helpers apply unchanged.
- [ ] **Step 1:** Write tests: `resolveHistRange('month:2019-12')` is empty; `'month:2024-02'` ends `20240229` (leap year); `'custom:2026-03-10:2026-03-20'` is empty; reversed custom range is swapped; `'30d'` ends at `HIST_END_KEY`; `'garbage'` equals the `12m` result; `previousRange` of a range starting `20200101` is null and of `month:2025-03` is `20250201..20250228`; `histPresetRange('month')` round-trips through `resolveHistRange` to the window's last month.
- [ ] **Step 2:** Run `bun test lib/analitica-historica/window.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement with native `Date` in UTC (mirror `rangeStartDateKey`/`rangeEndDateKey` helpers in `app/api/dwh/lib/query-builder.ts` for the parsing regexes; do not call `buildDateWhereClause`, it uses `GETDATE()`).
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5: Commit** `feat(historica): window and range helpers`.

### Task 5: Legacy SQL fragments and request params

**Files:**
- Create: `lib/analitica-historica/sql.ts`, `lib/analitica-historica/params.ts`
- Test: `lib/analitica-historica/sql.test.ts`, `lib/analitica-historica/params.test.ts`

**Interfaces:**
- Consumes: Task 4's `resolveHistRange`, `histRangeWhere`; `dualAmountExpr`, `parseReturnsBasis`, `returnsDateColumn`, `ReturnsBasis` from `app/api/dwh/lib/query-builder.ts`.
- Produces:
  - `histUsdJoin(factAlias: string, dateColumn?: string, joinAlias?: string): string` — an `OUTER APPLY` selecting `RateSell` from `fact.Fact_ExchangeRate_Legacy` for `factAlias.dateColumn` (default `DateKey`, joinAlias `fx`); `histReturnsUsdJoin(factAlias = 'frl', joinAlias = 'fx')` = the same on `OriginalInvoiceDateKey`.
  - `histSalesWhere(range, alias = 'fsl'): string` = `AND alias.IsVoided = 0` + range on `DateKey`; `histReturnsWhere(range, basis: ReturnsBasis, alias = 'frl'): string` = `IsVoided = 0` + range on `returnsDateColumn(basis)`.
  - `parseHistParams(request: Request): { range: { startKey: number; endKey: number; empty: boolean }; basis: ReturnsBasis; searchParams: URLSearchParams }`.
  - `requireHistAccess(request: NextRequest): Promise<{ session } | NextResponse>` — wraps `getSessionFromRequest` + `hasDwhAccess` (401 no session, 403 no module).
- [ ] **Step 1:** Tests: `histUsdJoin('fsl')` references `Fact_ExchangeRate_Legacy` and not `Fact_ExchangeRate ` or `DocumentExchangeRate`; `histReturnsWhere(r, 'factura')` filters `OriginalInvoiceDateKey`, `'devolucion'` filters `DateKey`; both contain `IsVoided = 0`; `parseHistParams` defaults basis to `devolucion` and range to `12m`'s resolution; `requireHistAccess` returns 401 without a cookie and 403 for a non-admin without the module (follow `app/api/dwh/clientes/__tests__/route.scope.test.ts` for session mocking).
- [ ] **Step 2:** Run `bun test lib/analitica-historica/`; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5: Commit** `feat(historica): legacy SQL fragments and param parsing`.

### Task 6: Page shell, tabs registry, nav link

**Files:**
- Create: `app/(app)/analitica-historica/{page.tsx, analitica-historica-client.tsx, types.ts, lib/tab-keys.ts, components/hist-banner.tsx}`, placeholder `tabs/tab-*.tsx` for the six tabs (each renders its name until its task replaces it)
- Modify: `lib/nav.ts` (add `{ href: '/analitica-historica', label: 'Analítica histórica', description: 'Ventas y devoluciones del sistema anterior (2020 – feb 2026).' }` to the `Analítica` section), `lib/__tests__/nav.test.ts`
- Test: `app/(app)/analitica-historica/lib/__tests__/tab-keys.test.ts`, `app/(app)/analitica-historica/__tests__/analitica-historica-client.test.tsx`

**Interfaces:**
- Produces: `HIST_TAB_KEYS = ['resumen','ventas','devoluciones','clientes','productos','vendedores']`, `HistTabKey`, `HIST_TAB_LABELS`, `resolveHistTab(param: string | null): HistTabKey` (unknown -> `resumen`); `HistTabProps = { dateRange: string; currency: Currency; granularity: Granularity; returnsBasis: ReturnsBasis }` (same shape as `TabComponentProps` in `analitica-client.tsx`); `HistBanner` (copy from the spec: legacy system, 2020 – feb 2026, independent identities, brutas sin IVA, returns basis note, USD from the old ERP's rates).
- The client mirrors `AnaliticaClientInner` (`app/(app)/analitica/analitica-client.tsx`): URL-synced `tab`, `dateRange`, `granularity`, `currency`, `returnsBasis`; same `DATE_RANGE_OPTIONS` labels, but clicking a preset writes `histPresetRange(preset)`; the custom inputs `min`/`max` are the window bounds; month pager disabled outside the window; default `dateRange = histPresetRange('12m')`; `ReturnsBasisSelector` on resumen/ventas/devoluciones; granularity via `allowedGranularities`/`resolveGranularity` from `analitica/lib/granularity.ts`. Page: session -> `redirect('/login')`, no module -> `redirect('/inicio')`.

- [ ] **Step 1:** Tests: `resolveHistTab('historico')` is `resumen`; nav test expects the new link only for `dwh` access; client test (RTL, `screen` from `test/dom-setup` first, `posthog-js` mocked) clicks "Mes Actual" and expects the URL `dateRange` to equal `histPresetRange('month')`, and asserts the Bs/USD toggle is present.
- [ ] **Step 2:** Run `bun test lib/__tests__/nav.test.ts "app/(app)/analitica-historica"`; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run; expect PASS. Start `bun dev`, open `/analitica-historica` logged in with the module, confirm the six tab buttons render and the sidebar shows the link.
- [ ] **Step 5: Commit** `feat(historica): page shell, tabs registry and sidebar link`.

### Task 7: Resumen tab + API

**Files:**
- Create: `app/api/dwh/analitica-historica/resumen/route.ts`, `app/api/dwh/analitica-historica/resumen/__tests__/route.test.ts`
- Modify: `app/(app)/analitica-historica/tabs/tab-resumen.tsx`, `app/(app)/analitica-historica/types.ts`
- Test: `app/(app)/analitica-historica/tabs/__tests__/tab-resumen.test.tsx`

**Interfaces:**
- Produces: `GET /api/dwh/analitica-historica/resumen?dateRange&granularity&returnsBasis` -> `HistResumenResponse = { kpis: { salesGross: DualAmount; returns: DualAmount; salesNet: DualAmount; returnRate: number | null; units: number; activeCustomers: number; avgPrice: DualAmount | null }; trend: { key: string; label: string; salesGross: DualAmount; returns: DualAmount; salesNet: DualAmount; returnRate: number | null }[]; empty: boolean }`. Trend buckets use `bucketKeyExpr`/`bucketMode` (`app/api/dwh/lib/query-builder.ts`, `analitica/lib/granularity.ts`). `activeCustomers` = distinct `CustomerLegacyKey` with a non-voided sale in range. Money built from `dualAmountExpr` + `histUsdJoin`/`histReturnsUsdJoin`; USD `null` when no rate (`dualFromRow`).
- UI: mirror the Resumen ventas strip and the netas + devoluciones stacked chart with return-rate line (reuse `components/resumen/*`, `kpi-card.tsx`). No CxC/clientes-nuevos cards.

- [ ] **Step 1:** Route tests: 401 without session, 403 without module, 200 shape on a mocked pool; with a mocked recordset whose USD sum is `null`, the response's `salesGross.usd` is `null` (not 0); an `empty` range returns `empty: true` without querying.
- [ ] **Step 2:** Component test: a response with `usd: null` renders "Sin datos" in USD mode; `empty` renders the empty state.
- [ ] **Step 3:** Run both; expect FAIL.
- [ ] **Step 4:** Implement route (`export const dynamic = 'force-dynamic'`, `jsonWithCache`, `captureException` in `catch` like other routes) and tab.
- [ ] **Step 5:** Run; expect PASS. Manually compare KPIs for `custom:2025-01-01:2025-12-31` with `SELECT SUM(NetAmount) FROM fact.Fact_Sales_Legacy WHERE IsVoided = 0 AND DateKey BETWEEN 20250101 AND 20251231` (Bs must match exactly).
- [ ] **Step 6: Commit** `feat(historica): Resumen tab`.

### Task 8: Ventas tab + API

**Files:**
- Create: `app/api/dwh/analitica-historica/ventas/route.ts` (+ `__tests__/route.test.ts`)
- Modify: `app/(app)/analitica-historica/tabs/tab-ventas.tsx`, `types.ts`
- Test: `app/(app)/analitica-historica/tabs/__tests__/tab-ventas.test.tsx`

**Interfaces:**
- Produces: `GET .../ventas?dateRange&granularity&returnsBasis&groupBy=mes|cliente|linea|vendedor&parentValue&breakdownBy` -> `{ rows: HistVentasRow[]; groupBy; breadcrumb: { label: string; groupBy: string }[] }` with `HistVentasRow = { label: string; value: string | number; salesGross: DualAmount; returns: DualAmount; salesNet: DualAmount; returnRate: number | null; units: number }`. `groupBy=mes` buckets by `granularity` (`bucketKeyExpr`, labels via `bucketLabel`); `cliente`/`vendedor` group by the legacy keys (names from the legacy dims, "Sin vendedor" for null); `linea` groups by `ISNULL(p.LineCode,'SIN_LINEA')` with a producto breakdown via `parentValue`. Everything is the old `app/api/dwh/historico/route.ts` logic generalized to a range, basis and granularity: read it first and keep its returns subquery behaviour (`returnsAmountSubqueries`-style correlated sums, `IsVoided = 0`).
- UI: `GroupedDrilldownTable` (as `tab-historico.tsx` uses it), KPI row of the same gross/returns/net.

- [ ] **Step 1:** Route tests: auth 401/403; unknown `groupBy` -> 400 `{ error }`; `groupBy=linea` rows include a `SIN_LINEA` bucket for a null line; a row whose returns exceed gross yields negative `salesNet`.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement. **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Parity check: for `custom:2025-01-01:2025-12-31` the Ventas total gross in Bs equals the old tab's (still deployed until Task 13) and the SQL above; record the USD difference vs the old tab in the commit message, without forcing equality.
- [ ] **Step 6: Commit** `feat(historica): Ventas tab`.

### Task 9: Devoluciones tab + API

**Files:**
- Create: `app/api/dwh/analitica-historica/devoluciones/route.ts` (+ `__tests__/route.test.ts`)
- Modify: `tabs/tab-devoluciones.tsx`, `types.ts`; Test: `tabs/__tests__/tab-devoluciones.test.tsx`

**Interfaces:**
- Produces: `GET .../devoluciones?dateRange&granularity&returnsBasis&groupBy=mes|cliente|producto` -> `{ kpis: { returns: DualAmount; salesGross: DualAmount; returnRate: number | null; units: number }; rows: { label: string; value: string | number; returns: DualAmount; units: number; returnRate: number | null }[] }`. Model on `app/api/dwh/devoluciones/route.ts` (read it first) with the legacy tables, `histReturnsWhere(range, basis)` and `histReturnsUsdJoin`. Return rate = returns ÷ gross sales of the SAME rows' window (use the same convention as the main tab).

- [ ] **Step 1:** Route tests: `returnsBasis=factura` filters on `OriginalInvoiceDateKey` (assert the SQL passed to a mocked pool); a return with `HasInvoiceLink = 0` appears under `factura` basis at its own date (its `OriginalInvoiceDateKey` equals `DateKey` after import — assert the query does not add a `HasInvoiceLink = 1` condition); auth tests.
- [ ] **Step 2:** Run; FAIL. **Step 3:** Implement. **Step 4:** Run; PASS. Component test: basis selector present; `usd: null` shows "Sin datos".
- [ ] **Step 5: Commit** `feat(historica): Devoluciones tab`.

### Task 10: Clientes tab + API

**Files:**
- Create: `app/api/dwh/analitica-historica/clientes/route.ts` (+ tests), `lib/analitica-historica/cliente-pareto.ts` (+ test) only if `lib/productos/pareto.ts`'s `classifyPareto` cannot be reused as is (check first; prefer reuse)
- Modify: `tabs/tab-clientes.tsx`, `types.ts`; Test: `tabs/__tests__/tab-clientes.test.tsx`

**Interfaces:**
- Produces: `GET .../clientes?dateRange&returnsBasis&q` -> `{ rows: HistClienteRow[] }`, `HistClienteRow = { customerKey: number; code: string; name: string; firstInvoiceKey: number | null; lastInvoiceKey: number | null; invoices: number; salesGross: DualAmount; returns: DualAmount; salesNet: DualAmount; returnRate: number | null; units: number; sharePct: number | null; pareto: 'A' | 'B' | 'C' | null; status: 'activo' | 'sin_compras' }`. Universe = every customer with any non-voided sale in the full window; `sin_compras` = no sale in the selected range. First/last invoice are within the full window. Customers with only returns in the range are listed with negative `salesNet` and negative `sharePct`, no clamp (as the Productos phase 3 rule in AGENTS.md). Pareto via `classifyPareto` from `lib/productos/pareto.ts` over net in the active-currency-independent Bs ranking (document the choice in a comment). Null USD -> `null`.
- UI: table with search (`q`), status filter pills, `SearchableSelect` not needed.

- [ ] **Step 1:** Route tests: customer with returns only in range is returned with negative `salesNet`; a customer bought outside the range has `status: 'sin_compras'`; auth tests.
- [ ] **Step 2:** Run; FAIL. **Step 3:** Implement. **Step 4:** Run; PASS.
- [ ] **Step 5: Commit** `feat(historica): Clientes tab`.

### Task 11: Productos tab + API

**Files:**
- Create: `app/api/dwh/analitica-historica/productos/route.ts` (+ tests), `lib/analitica-historica/productos-filter.ts` (+ test)
- Modify: `tabs/tab-productos.tsx`, `types.ts`; Test: `tabs/__tests__/tab-productos.test.tsx`

**Interfaces:**
- Consumes: `classifyPareto` (`lib/productos/pareto.ts`), `normalizeStack`/bubble helpers only if cheap to reuse (skip bubble plot and customer accordion in v1), `productos/master-table.tsx` presentational props if they take plain rows (read `components/productos/master-table.tsx` first; if it is coupled to URL hooks, build a slim table instead).
- Produces: `parseHistProductosFilters(searchParams: URLSearchParams): { nivel: 'linea' | 'sublinea' | 'sku'; metric: 'ventas' | 'unidades'; categoria: string | null; lineas: string[]; sublineas: string[]; q: string | null }` and `histProductosFilterSql(filters, alias = 'p'): { sql: string; inputs: Record<string, string> }` (numbered `.input()` binds; `q` LIKE wildcards escaped; follow `lib/productos/item-filter.ts`). `GET .../productos?section=catalogo&...` -> `{ rows: HistProductoRow[] }` with `{ key; label; line?: string; subline?: string; salesNet; salesGross; returns; returnRate; units; unitsPerMonth: number | null; avgPrice: DualAmount | null; reachCustomers: number; pareto: 'A'|'B'|'C'|null; prevNet: DualAmount | null; trendPct: number | null }`. `prevNet`/`trendPct` use `previousRange`; null (never 0) when it returns null or the previous period has no base. `section=filtros` lists líneas/sublíneas/categorías. Unknown `section` -> 400. Null line -> `SIN_LINEA`.

- [ ] **Step 1:** Tests: filter parsing + SQL (wildcards in `q` escaped, binds numbered, nothing user-controlled interpolated); route: unknown section 400; a product with only returns in range shows negative net and Pareto `C`; `trendPct` is null when `previousRange` is null; auth tests.
- [ ] **Step 2:** Run; FAIL. **Step 3:** Implement. **Step 4:** Run; PASS.
- [ ] **Step 5: Commit** `feat(historica): Productos tab`.

### Task 12: Vendedores tab + API

**Files:**
- Create: `app/api/dwh/analitica-historica/vendedores/route.ts` (+ tests)
- Modify: `tabs/tab-vendedores.tsx`, `types.ts`; Test: `tabs/__tests__/tab-vendedores.test.tsx`

**Interfaces:**
- Produces: `GET .../vendedores?dateRange&granularity&returnsBasis` -> `{ rows: { salesRepKey: number | null; label: string; salesGross: DualAmount; returns: DualAmount; salesNet: DualAmount; returnRate: number | null; units: number; customersServed: number }[]; total: <same shape without key/label>; trend: { key: string; label: string; salesNet: DualAmount }[] }`. Attribution by the document's own `SalesRepLegacyKey`; null -> `salesRepKey: null`, label "Sin vendedor". `total` equals the Resumen `kpis` for the same query params. No goals/status.

- [ ] **Step 1:** Route tests: rows with null seller group under "Sin vendedor"; `sum(rows.salesGross.bs) === total.salesGross.bs`; auth tests.
- [ ] **Step 2:** Run; FAIL. **Step 3:** Implement. **Step 4:** Run; PASS.
- [ ] **Step 5: Commit** `feat(historica): Vendedores tab`.

### Task 13: Remove the old Histórico 2025 tab, redirect, docs

**Files:**
- Delete: `app/(app)/analitica/tabs/tab-historico.tsx`, `app/(app)/analitica/components/historico-banner.tsx` (after moving any reusable text to `hist-banner.tsx`), `app/api/dwh/historico/` (route + tests), `lib/dwh/historico-window.ts`, the `Historico*` types in `app/(app)/analitica/types.ts`
- Modify: `app/(app)/analitica/lib/tab-keys.ts` (remove `historico`), `analitica-client.tsx` (remove the import/entry; add: if `?tab=historico` then `router.replace('/analitica-historica')` — put the check where `tabParam` is read), `AGENTS.md` ("Histórico 2025" bullets, directory map, new section description incl. Fact_ExchangeRate_Legacy), `migrations/dwh/README.md` (0042/0043 entries), `INSTRUCTIONS.md` (how to re-run the legacy import: apply 0042 first), `content/help/` (new `analitica-historica` help page; allowlist the slug in `app/api/help/[page]/route.ts`; render it with `HelpPanel` in the new page)
- Test: `app/(app)/analitica/lib/__tests__/tab-keys.test.ts` (adjust), a test that `?tab=historico` triggers the redirect

- [ ] **Step 1:** Update tests first: `resolveActiveTab('historico')` is `resumen`; the redirect test.
- [ ] **Step 2:** Run `bun test`-affected files; FAIL. **Step 3:** Implement the removals and doc updates; `grep -rn "historico" app lib components` must show only the new section and the redirect.
- [ ] **Step 4:** Run `bun run typecheck && bun run lint && bun run test`; expect all green (the live-ERP integration scripts stay excluded).
- [ ] **Step 5: Commit** `refactor: replace Histórico 2025 tab with Analítica histórica`.
