# Analítica Resumen + Seguimiento Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Analítica Resumen tab as a short business overview and the Seguimiento tab as a supervisor view (seller/route/group grid, weekly matrix, customers, activation, invoices, 12-month history), showing brutas, devoluciones and netas.

**Architecture:** Both tabs keep their existing API routes and add fields/sections; pure logic stays in `lib/seguimiento/` and `app/(app)/analitica/lib/` with unit tests, UI in `app/(app)/analitica/components/`. Returns are always attributed to the ORIGINAL invoice date so net + returns = brutas in every bucket. Goals stay measured against brutas.

**Tech Stack:** Next.js 16 App Router, Bun (`bun test`), `mssql` against `DWH_AlimentosNY`, Recharts, React Testing Library on happy-dom, Drizzle/SQLite (goals, untouched).

**Spec:** `docs/superpowers/specs/2026-10-29-resumen-seguimiento-redesign-design.md` (mockups: `.superpowers/brainstorm/6368-1793298078/content/resumen-v5-clientes.html`, `seguimiento-v2.html`)

Work on a feature branch (`feat/analitica-redesign`), not `main`. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Global Constraints

- Follow `AGENTS.md`: DWH queries via `getDwhPool()`, every user-controlled value through `.input()`; customers attributed by the CURRENT `Dim_Customer` row (`IsCurrent = 1`); no date library (use `lib/dates.ts` / `lib/seguimiento/iso-date.ts`); `SearchableSelect` for any long picker.
- Returns: `buildReturnsDateWhereClause(..., 'factura')` + `returnsUsdConversionJoin`; netas = brutas − devoluciones.
- Missing data is `null` and renders "Sin datos"/"—", never `$0` (`Dual.usd` null only when every row is null, the existing `sumDuals` convention).
- Seguimiento: all figures through **yesterday**; goals/attainment against **brutas**; units shown as absolutes (sold / goal), never percentages; weeks are ISO weeks via `lib/seguimiento/iso-weeks.ts`, amounts clipped to the reference month; consignment-root customers excluded as today.
- Both tabs stay gated on `'dwh'` (page and API); no new modules.
- Grid status colours meet WCAG AA (4.5:1 text vs background) in light and dark, and status is never colour-only (icon + text).
- No DWH schema change. Test commands: `bun test --isolate <file>` (units/components); full run `bun run test`.

## Review Focus

- Customer or root with returns but zero units/sales → average price `—`, return rate `null` (no NaN/Infinity, no `0%`).
- Return rows with no exchange rate → returns USD `null`/partial, never silently `0`; net USD follows the same rule.
- First day of a month: reference month is the previous one (`resolveReferenceMonth`); weeks after `asOf` render blank, not 0.
- Seller with no goal → grey "Sin meta" cell, never red and never "0%"; route/group rows have no goals at all.
- Month-to-month history: the partial current month is flagged, months with no data are gaps not zeros, and the series excludes the same consignment customers as the grid totals.

---

### Task 1: Resumen API — extra KPIs

**Files:**
- Modify: `app/api/dwh/resumen/route.ts`, `app/(app)/analitica/types.ts` (`ResumenKPIs`)
- Modify: `app/(app)/analitica/lib/net-sales.ts`
- Test: `app/api/dwh/resumen/__tests__/` (extend the existing route test following its mocking pattern), `app/(app)/analitica/lib/__tests__/net-sales.test.ts`

**Interfaces:**
- Produces in `ResumenKPIs`: `unitsReturned: number`, `customersWithReturns: number`, `customersNet: number` (customers with net sales > 0), `customersTotal: number` (`IsCurrent = 1`, not inactive, consignment roots excluded), `customersNew: number` (`RegisteredDate` in range, not `IsMigrationBatch`), `receivableOpening: DualAmount | null` (latest `Fact_AR_Snapshot` on/before the day before the range starts), `billed: DualAmount` (= `salesGross`, labelled "sin IVA" in UI; `collected` and `receivable` already exist).
- Produces `averagePrice(amount: DualAmount, units: number): DualAmount | null` in `net-sales.ts` (null when `units <= 0`).

- [ ] **Step 1: Write failing tests** — `averagePrice({bs:100,usd:10}, 4)` → `{bs:25,usd:2.5}`; `averagePrice(..., 0)` → `null`; `usd:null` stays null. Route test: response `kpis` contains every new field for a mocked recordset; `receivableOpening` is `null` when no snapshot exists before the range.
- [ ] **Step 2: Run** `bun test --isolate app/api/dwh/resumen app/(app)/analitica/lib/__tests__/net-sales.test.ts` — expect FAIL (fields/function missing).
- [ ] **Step 3: Implement** the new queries in the route (one extra `Promise.all` entry; reuse the existing date-where builders and consignment exclusion from `app/api/dwh/lib/consignment.ts`) and `averagePrice`. Opening snapshot reuses `LATEST_SNAPSHOT_QUERY` style with `<= previous-day key`.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat(resumen): customers, returns units and opening balance KPIs`.

### Task 2: Resumen UI

**Files:**
- Create: `app/(app)/analitica/components/resumen/ventas-strip.tsx`, `clientes-cards.tsx`, `cxc-cards.tsx`, `sales-returns-chart.tsx`
- Modify: `app/(app)/analitica/tabs/tab-resumen.tsx`
- Delete: `app/(app)/analitica/components/resumen-pace.tsx`
- Test: `app/(app)/analitica/components/resumen/__tests__/*.test.tsx`, rewrite `app/(app)/analitica/tabs/__tests__/tab-resumen.test.tsx`

**Interfaces:**
- Consumes: Task 1 `ResumenKPIs`, `ResumenResponse.monthlyTrend`/`trendMode`, `bucketLabels`/`bucketTitle` from `../lib/granularity`, `moneyLabel`, `KpiCard`.
- Produces: `VentasStrip({kpis, currency})` (3 cards: Ventas brutas | Devoluciones with rate | Neto; each USD, unidades, clientes/tiendas, precio promedio), `ClientesCards({kpis})` (Total / Activos with % of total / Nuevos), `CxcCards({kpis, currency})` (Saldo inicial, + Facturación, − Cobros, = Pendiente; Pendiente is `kpis.receivable` as is, with no reconciliation or gap line), `SalesReturnsChart({rows, trendMode, currency}: {rows: MonthlyTrendRow[]; trendMode: BucketMode; currency: Currency})` — full width.

- [ ] **Step 1: Write failing tests** — `ventas-strip`: with brutas 100000/12400 u/90 clientes the card shows "Precio promedio" `8.06`; devoluciones card shows `4.0%`; `receivable: null` renders "Sin datos" in Pendiente (not `$0`). `sales-returns-chart`: a bucket with `salesGross.bs = 0` produces a rate of `null` (no NaN in the rendered series); legend text "Tasa de devolución" present; returns series is distinguishable without colour (pattern id present). `tab-resumen`: renders the four sections in order, and no "Día laborable" strip, no aging chart, no "Mayor concentración".
- [ ] **Step 2: Run** `bun test --isolate "app/(app)/analitica/components/resumen" "app/(app)/analitica/tabs/__tests__/tab-resumen.test.tsx"` — FAIL.
- [ ] **Step 3: Implement** the components and recompose `tab-resumen.tsx`: stacked `Bar`s (`stackId="s"`: net solid, returns hatched via an SVG `<pattern>`), `Line` on a second `YAxis yAxisId="rate"` (percent), `ResponsiveContainer width="100%"`; tooltip shows brutas, neta, devoluciones, rate. Keep loading/error/empty states; keep the existing `Currency` toggle behaviour.
- [ ] **Step 4: Run** the same command — PASS. Run `bun run test:components` for regressions.
- [ ] **Step 5: Commit** `feat(resumen): redesigned overview strip, clientes, cxc and stacked chart`.

### Task 3: Resumen — drop sections not in the design (rejectable)

**Files:** Modify `app/(app)/analitica/tabs/tab-resumen.tsx`; Test: `tab-resumen.test.tsx`.

The spec's Resumen is only the four sections of Task 2; Top 10 clientes, Top 10 productos and "Desempeño por vendedor" are not in it. This task removes them from the tab (API fields stay; other tabs may use them).

- [ ] **Step 1:** Add a test asserting none of "Top 10 clientes", "Top 10 productos", "Desempeño por vendedor" render. **Step 2:** run, FAIL. **Step 3:** delete the three blocks and now-unused imports/helpers. **Step 4:** run, PASS. **Step 5:** commit `refactor(resumen): remove sections outside the new design`.

### Task 4: Seguimiento aggregation with returns (pure)

**Files:**
- Modify: `lib/seguimiento/types.ts`, `lib/seguimiento/aggregate.ts`
- Test: `lib/seguimiento/__tests__/aggregate.test.ts` (create)

**Interfaces:**
- Produces in `aggregate.ts`: `CustomerLineReturns { customerCode: string; line: string | null; units: number; returns: Dual }`, `CustomerWeekAmounts { customerCode: string; yearWeek: string; units: number; sales: Dual; returnUnits: number; returns: Dual }`, `netOf(sales: Dual, returns: Dual): Dual` (usd null iff `sales.usd` null, else `sales.usd − (returns.usd ?? 0)`). `SeguimientoInput` gains `lineReturns: CustomerLineReturns[]`, `weekAmounts: CustomerWeekAmounts[]`.
- `RootMetrics` gains `returns: Dual`, `returnUnits: number`, `net: Dual`, `netUnits: number`, `returnRate: number | null` (returns.bs / sales.bs, null when sales.bs is 0), `routeLabels: string[]` (distinct "Ruta N" of the root's customers, natural order).
- `WeekCell` gains `sales: Dual`, `units: number`, `returns: Dual`, `returnUnits: number`, `net: Dual`, `avgPrice: Dual | null` (clipped to the month; summed over non-consignment customers).
- `SeguimientoCustomer` gains `returns: Dual`, `returnUnits: number`, `net: Dual`.
- Existing fields (sales/units/attainment/projection/quota) keep today's brutas meaning.

- [ ] **Step 1: Write failing tests** — fixture with two customers (one consignment-flagged): `total.returns` excludes the flagged customer; `net = sales − returns`; `returnRate` null when sales 0; customer with returns USD all-null gives `returns.usd === null` and `net.usd` equals `sales.usd`; weeks after `asOf` have zero amounts and `pct: null`; `routeLabels` for a seller with routes 7 and 12 is `['Ruta 7','Ruta 12']`; existing attainment values unchanged for the same inputs.
- [ ] **Step 2: Run** `bun test --isolate lib/seguimiento` — FAIL.
- [ ] **Step 3: Implement** by extending `Row` with returns/week amounts and `buildMetrics`/`toCustomer`; add `netOf`.
- [ ] **Step 4: Run** — PASS (also `bun run test:unit` for other `lib/seguimiento` consumers such as `seller-profile`).
- [ ] **Step 5: Commit** `feat(seguimiento): returns, net and weekly amounts in the aggregate`.

### Task 5: Seguimiento queries and API

**Files:**
- Modify: `lib/seguimiento/queries.ts`, `lib/seguimiento/types.ts`, `app/api/dwh/seguimiento/route.ts`
- Test: `lib/seguimiento/__tests__/queries.test.ts` (create; fake `ConnectionPool` capturing SQL + inputs), extend route test if one exists

**Interfaces:**
- Consumes: Task 4 `CustomerLineReturns`, `CustomerWeekAmounts`.
- Produces in `queries.ts`: `fetchLineReturns(pool, month): Promise<CustomerLineReturns[]>`, `fetchWeekAmounts(pool, month): Promise<CustomerWeekAmounts[]>` (grouped by `Dim_Date.YearWeek`, window = the month only), `fetchHistory(pool, scope, endMonth, excludeCodes): Promise<HistoryPoint[]>` with `HistoryScope = { kind: 'total' } | { kind: RootKind; value: string }` and `HistoryPoint { month: string; sales: Dual; units: number; returns: Dual; returnUnits: number }` (12 months ending `endMonth`, months with no rows omitted).
- Produces: `GET /api/dwh/seguimiento?section=history&kind=&rootValue=&dateRange=` → `{ points: HistoryPoint[] }` (`'history'` added to `SECTIONS`; `rootValue` optional → total). Main response now feeds `lineReturns` and `weekAmounts` into `buildSeguimiento`.

- [ ] **Step 1: Write failing tests** — each fetcher's SQL uses `OriginalInvoiceDateKey` for returns (via `returnsUsdConversionJoin`) and the `TO_CURRENT_CUSTOMER` join; `fetchHistory` passes `rootValue` and each exclude code via `.input()` (no interpolation; assert the SQL text contains no code literal); invalid month throws; route returns 400 for `section=history` with a malformed `rootValue` (reuse `CUSTOMER_CODE_RE`-style allowlist).
- [ ] **Step 2: Run** `bun test --isolate lib/seguimiento app/api/dwh/seguimiento` — FAIL.
- [ ] **Step 3: Implement** the queries (return columns per `migrations/dwh/0010_fact_returns.sql`; skip voided rows as the sales queries do) and the route branch. `fetchHistory` filters by seller key / zone code / segment code of the CURRENT customer row.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(seguimiento): returns, weekly amounts and history queries`.

### Task 6: Grid status rules (pure)

**Files:**
- Create: `lib/seguimiento/grid-status.ts`; Test: `lib/seguimiento/__tests__/grid-status.test.ts`

**Interfaces:**
- Produces: `type GridLevel = 'ok' | 'warn' | 'bad' | 'none'`; `gridStatus(projected: number | null, goal: number | null): { level: GridLevel; icon: '✓' | '!' | '✕' | '–'; label: 'En meta' | 'Cerca' | 'Bajo meta' | 'Sin meta' }` (ratio = projected / goal: ≥ 1 ok, ≥ 0.85 warn, else bad; goal null/≤ 0 or projected null → none); `STATUS_STYLES: Record<GridLevel, { light: { fg: string; bg: string }; dark: { fg: string; bg: string } }>`; `contrastRatio(fg: string, bg: string): number` (WCAG relative-luminance formula, hex input).

- [ ] **Step 1: Write failing tests** — `gridStatus(1000, 1000)` → ok; `gridStatus(850, 1000)` → warn; `gridStatus(849, 1000)` → bad; `gridStatus(500, null)` and `gridStatus(null, 1000)` → none/"Sin meta"; `contrastRatio('#000000','#ffffff')` = 21; every `STATUS_STYLES` pair in light and dark has `contrastRatio ≥ 4.5`.
- [ ] **Step 2: Run** `bun test --isolate lib/seguimiento/__tests__/grid-status.test.ts` — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(seguimiento): accessible grid status rules`.

### Task 7: Seguimiento UI — grid, weekly matrix, detail

**Files:**
- Create: `app/(app)/analitica/components/seguimiento/seller-grid.tsx`, `weekly-matrix.tsx`
- Modify: `app/(app)/analitica/tabs/tab-seguimiento.tsx`
- Delete when unused: `goal-kpi-card.tsx`, `RootCard`/`RootTable` from `root-views.tsx`, their tests
- Keep untouched: `seller-profile.tsx` (opened from "Ver perfil"), `CustomerList`, `WeekDots`/`WeekStrip`, `MonthPaceStrip`, `QuotaEditor`, the excluded-consignment section
- Test: `components/seguimiento/__tests__/seller-grid.test.tsx`, `weekly-matrix.test.tsx`, rewrite `tabs/__tests__/tab-seguimiento.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–6 types and `gridStatus`/`STATUS_STYLES`.
- Produces: `SellerGrid({ roots, total, kind, currency, selected, onSelect }: { roots: SeguimientoRoot[]; total: RootMetrics; kind: RootKind; currency: Currency; selected: string | null; onSelect: (value: string) => void })` — one row per root; columns: root (+ `routeLabels` for sellers), Brutas USD (with `gridStatus` on projected vs goal), Devoluciones USD (+ rate), Netas USD, Unidades (`sold / goal`, absolute), Clientes activos (current week `n / assigned`), Nuevos (`n / quota`), Precio prom., Proyección USD. `WeeklyMatrix({ root, headers, currency }: { root: RootMetrics; headers: WeekHeader[]; currency: Currency })` — rows: clientes asignados, activos, % activos, brutas (USD, unidades), devoluciones (USD, unidades), netas (USD, unidades), precio promedio; columns Sem 1..5 + Total; plus the Estimado block (projected units and USD vs goal) and the category list from `root.mix`.
- The same detail (matrix → Estimado → categorías → Clientes nuevos → `CustomerList` with activation dots and per-customer invoices → history chart slot from Task 8) renders for the selected root of **every** kind (vendedor, ruta, grupo). Goals/status only for `vendedor`; "Ver perfil" and "Editar metas" remain on sellers.

- [ ] **Step 1: Write failing tests** — grid: a seller at 62% shows the "Bajo meta" text and "✕" (status exists without relying on colour); seller with no goal shows "Sin meta", not red; units cell reads `1,960 / 3,200`; `kind='ruta'` rows show no status; clicking a row calls `onSelect(root.value)`. Matrix: future weeks blank; Total column equals the sum of the week columns for brutas USD; `—` when avg price is null. Tab: selecting a route renders the matrix and the customer list; the old goal cards ("Unidades vendidas" GoalKpiCard) no longer render; "Ver perfil" still opens `SellerProfile`.
- [ ] **Step 2: Run** `bun test --isolate "app/(app)/analitica/components/seguimiento" "app/(app)/analitica/tabs/__tests__/tab-seguimiento.test.tsx"` — FAIL.
- [ ] **Step 3: Implement** the components and rewire `tab-seguimiento.tsx` (selection state replaces `expandedRoot`; keep generation-guarded drill-down fetches and the quota save flow as they are). Status cell sets inline `color`/`backgroundColor` from `STATUS_STYLES` through CSS variables so light/dark both apply.
- [ ] **Step 4: Run** the same command plus `bun run test:components` — PASS; remove dead exports flagged by `bunx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(seguimiento): grid and weekly matrix for seller, route and group`.

### Task 8: Month-to-month history chart

**Files:**
- Create: `app/(app)/analitica/components/seguimiento/history-chart.tsx`
- Modify: `app/(app)/analitica/tabs/tab-seguimiento.tsx`
- Test: `components/seguimiento/__tests__/history-chart.test.tsx`

**Interfaces:**
- Consumes: Task 5 `HistoryPoint`, `GET ...?section=history`.
- Produces: `HistoryChart({ points, currency, partialMonth }: { points: HistoryPoint[]; currency: Currency; partialMonth: string })` — brutas USD bars (left axis) and brutas units line (right axis), full width, current month labelled "(parcial)"; tooltip shows brutas, devoluciones, neta (USD and units) and the change vs the previous month. The tab fetches it for the selected root, or the total when none is selected, last 12 months ending in the reference month (not tied to the date-range filter).

- [ ] **Step 1: Write failing tests** — month absent from `points` is a gap in the series (no zero entry); `partialMonth` label contains "parcial"; empty `points` renders "Sin datos"; the change vs previous month is `null` for the first point. **Step 2:** run `bun test --isolate "app/(app)/analitica/components/seguimiento/__tests__/history-chart.test.tsx"` — FAIL. **Step 3:** implement and wire the fetch (generation-guarded like the lines drill-down). **Step 4:** run — PASS. **Step 5:** commit `feat(seguimiento): 12-month history chart`.

### Task 9: Docs and final verification

**Files:** Modify `AGENTS.md` ("Seguimiento (Analítica tab)", "Analítica tabs (consolidated)", Directory Map entries for new files), `content/help/analitica-definiciones.md` (Seguimiento = brutas + devoluciones + netas; Resumen cards).

- [ ] **Step 1:** Update the docs to match what was built (no behaviour claims the code does not have).
- [ ] **Step 2:** Run `bun run test`, `bunx tsc --noEmit` and `bun run lint`; all must pass.
- [ ] **Step 3:** Start the app (`bun dev`) and, for a real month, check: Resumen strip brutas − devoluciones = neto; the Seguimiento grid's brutas for a seller equals the old Seguimiento figure for the same month (git stash or compare to production if the local ERP copy is stale — see memory note that local data is not production fact).
- [ ] **Step 4: Commit** `docs: describe the redesigned Resumen and Seguimiento`.
