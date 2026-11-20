# Clientes Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Analítica Clientes tab as an executive-first view (scope bar, KPI strip, four question sections, collapsed operational detail) with a two-axis customer taxonomy, chain→store trajectory, grupo/ruta breakdown and a scope-following product/SKU view.

**Architecture:** Phased in-place refactor of `tab-clientes.tsx` on the existing `/api/dwh/clientes` and `/api/dwh/productos` routes. Tab state moves into the URL (`lib/clientes-params.ts`, same pattern as `lib/productos-params.ts`). New data arrives as new `section=` values on `/api/dwh/clientes`; classification maths live in pure modules under `lib/clientes/`. Productos code is shared (extracted chart component, `ruta` filter), never copied.

**Tech Stack:** Next.js 16 App Router, Bun, TypeScript, Tailwind, Recharts, `mssql` (DWH pool), bun:test + React Testing Library on happy-dom.

**Spec:** `docs/superpowers/specs/2026-11-20-clientes-tab-redesign-design.md` (approved). UX review: `docs/clientes-tab-ux-review.md`.

## Global Constraints

- Test commands: unit/route `bun test --isolate <path>`; component tests import `screen` from `test/dom-setup` FIRST, call `cleanup` in `afterEach`, mock `posthog-js` with `mock.module`, load the component with dynamic `await import(...)` (AGENTS.md "Testing Notes"). DWH integration tests need `--timeout 30000`.
- Every API route checks `requireDwhAccess(request)` itself (no middleware); page gate stays `'dwh'`.
- DWH SQL: all user-controlled values through `.input()`; only validated tokens interpolated. Never join ERP and DWH in SQL.
- Customers attributed by the CURRENT `Dim_Customer` row (`IsCurrent = 1`) by `CustomerCode`; grupo = `RTRIM(ErpSegmentCode)`, ruta = `Dim_Zone.RouteNumber` (reuse `customerScope` in `lib/clientes/scope.ts`).
- Customer cards exclude consignment roots (`app/api/dwh/lib/consignment.ts`); sales cards include them and say so.
- Missing USD = `null` rendered "Sin datos"/"—", never 0. No prior period = Δ shown as muted "sin base", never 0 and never colored.
- Origen: `customerKindInYear(registeredDate, Y)` from `lib/dwh/cutover.ts` (`MIGRATION_CUTOVER_DATE = '2026-03-28'`), Y = year the range ends in; never stored.
- Granularity rules from `app/(app)/analitica/lib/granularity.ts` (`allowedGranularities`, `resolveGranularity`); weeks are ISO Monday–Sunday; current month measured through yesterday.
- Prior period via `buildPrevPeriodDateWhereClause` (`app/api/dwh/lib/query-builder.ts`).
- UI copy in Spanish; single word "Grupo" (never "Canal"); "Casa matriz" / "Tienda" / "Código".
- Accessibility: sort headers are `<button>` with `aria-sort`; segmented controls use `aria-pressed`; status never by color alone; text contrast ≥ 4.5:1 (no `text-gray-400` for readable text); every chart has a "Ver tabla" alternative.
- URL keys (defaults omitted): `dim` (`entidad`|`tienda`), `grupo`, `ruta`, `tienda` (`e:<LegalEntityKey>`|`t:<code>`, same as Productos), `origen` (`patrimonio`|`nuevo`), `ver` (`producto`|`grupo`), `nivel` (`linea`|`sublinea`|`sku`, same as Productos), `detalle=1`. Global keys `dateRange`, `granularity`, `returnsBasis`, currency are owned by `analitica-client.tsx` and not re-implemented.
- Existing Productos and Clientes tests must stay green unchanged except where a task says it edits them.
- Commit after each task, ending messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A range with no comparable previous period (`prevPeriodAvailable = false`): Estados Retenido/Enfriado/Perdido/Recuperado cannot be computed; sections show "Sin período anterior comparable", not zeros.
- Customers registered after year Y (`posterior`) or with `RegisteredDate` null: excluded from Origen counts without crashing.
- Entities with a null USD rate in some bucket: sums are `null` ("Sin datos"), sort puts them last, Δ is "sin base"; an empty set is 0.
- Chain edge cases: a store whose matriz is itself a store, an orphan, or a one-store chain is its own root and is not expandable; a chain with a store added in the period shows "tiendas nuevas", not hidden growth.
- Scope that matches zero customers (grupo + ruta with no overlap), customers with only returns (negative net, shown signed), and a `month` granularity on a single-bucket range: empty states and one-point charts render text, never `NaN%` or an empty plot.

---

## Phase 1: Layout, state, shared components (front-end + trend granularity)

### Task 1: URL params for the Clientes tab

**Files:**
- Create: `app/(app)/analitica/lib/clientes-params.ts`
- Test: `app/(app)/analitica/lib/__tests__/clientes-params.test.ts`

**Interfaces:**
- Produces:
  - `type Dim = 'entidad' | 'tienda'`, `type Origen = 'todos' | 'patrimonio' | 'nuevo'`, `type Ver = 'total' | 'producto' | 'grupo'`
  - `interface ClientesParams { dim: Dim; grupo: string | null; ruta: string | null; tienda: string | null; origen: Origen; ver: Ver; nivel: Nivel; detalle: boolean }` (`Nivel` imported from `./productos-params`)
  - `parseClientesParams(sp: URLSearchParams): ClientesParams`
  - `applyClientesParams(sp: URLSearchParams, patch: Partial<ClientesParams>): URLSearchParams` (defaults omitted, other params kept)
  - `activeFilterCount(p: ClientesParams): number` (counts grupo, ruta, tienda, origen≠todos)
  - `dimToApi(dim: Dim): 'cliente_entidad' | 'cliente_tienda'`
  - `useClientesParams(): { params: ClientesParams; setParams(patch: Partial<ClientesParams>): void }` (router.replace, `scroll: false`, same shape as `useProductosParams`)

- [ ] **Step 1: Write failing tests** `parses defaults for empty params`, `omits defaults when applying`, `keeps unrelated params (dateRange, tab)`, `ignores malformed values (dim=x, ver=x, nivel=x)`, `activeFilterCount counts grupo+ruta+origen`, `dimToApi maps both values`.
- [ ] **Step 2: Run** `bun test --isolate "app/(app)/analitica/lib/__tests__/clientes-params.test.ts"` → FAIL (module missing).
- [ ] **Step 3: Implement** mirroring `lib/productos-params.ts` (`scalar`/`list` helpers pattern, validation against allowed arrays).
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(clientes): URL params for the Clientes tab`.

### Task 2: Shared UI primitives

**Files:**
- Create: `app/(app)/analitica/components/clientes/segmented-control.tsx`, `data-table.tsx`, `delta-badge.tsx`, `app/(app)/analitica/lib/clientes-export.ts`
- Test: `app/(app)/analitica/components/__tests__/clientes-primitives.test.tsx`

**Interfaces:**
- Produces:
  - `SegmentedControl<T extends string>(props: { value: T; options: { value: T; label: string; count?: number }[]; onChange(v: T): void; ariaLabel: string })` — each option a `<button aria-pressed>`, style = existing gray-900 selected look.
  - `DataTable<Row>(props: { columns: Column<Row>[]; rows: Row[]; rowKey(r: Row): string; defaultSort?: { key: string; dir: 'asc' | 'desc' }; searchText?(r: Row): string; exportFile?: { name: string; toRecord(r: Row): Record<string, string | number | null> }; emptyMessage: string; renderExpanded?(r: Row): React.ReactNode; isExpandable?(r: Row): boolean; pageSize?: number })` with `Column<Row> = { key: string; label: string; align?: 'left' | 'right'; sortValue?(r: Row): string | number | null; render(r: Row): React.ReactNode; title?: string }`. Sort headers are `<button>` + `aria-sort`; null sort values always last; sticky header; wrapper `overflow-x-auto`; search box when `searchText` given; "Exportar CSV" button when `exportFile` given; chevron button `aria-expanded` when `isExpandable`.
  - `DeltaBadge(props: { current: number | null; previous: number | null; format?: 'pct' | 'abs' })` → `▲ +4.2%` / `▼ −3.1%` / muted `sin base` when either is null or previous is 0.
  - `downloadCsv(filename: string, records: Record<string, string | number | null>[]): void` (client-side; uses `buildCsv` from `lib/csv.ts`, Blob + anchor). **Call:** CSV with BOM (opens in Excel) rather than xlsx, since `buildXlsx` is server-side.

- [ ] **Step 1: Write failing tests**: `SegmentedControl marks the selected option aria-pressed and calls onChange`, `DataTable sorts by header click and sets aria-sort`, `DataTable puts null sort values last in both directions`, `DataTable search filters rows`, `DataTable shows emptyMessage when no rows`, `DataTable expand toggles renderExpanded`, `DeltaBadge shows sin base for null or zero previous (never 0%)`, `DeltaBadge shows arrow and sign`.
- [ ] **Step 2: Run** `bun test --isolate "app/(app)/analitica/components/__tests__/clientes-primitives.test.tsx"` → FAIL.
- [ ] **Step 3: Implement** the four files per the interfaces; no network or data logic inside them.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(clientes): shared segmented control, data table, delta badge, csv export`.

### Task 3: Scope bar replacing the filter bar

**Files:**
- Create: `app/(app)/analitica/components/clientes/scope-bar.tsx`, `app/(app)/analitica/lib/use-clientes-filter-options.ts`
- Delete: `app/(app)/analitica/components/cartera-filter-bar.tsx` and `components/__tests__/cartera-filter-bar.test.tsx` (its behavior moves here)
- Test: `app/(app)/analitica/components/__tests__/clientes-scope-bar.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`ClientesParams`, `activeFilterCount`), Task 2 (`SegmentedControl`).
- Produces: `useClientesFilterOptions(): ClientesFiltersResponse` (fetches `/api/dwh/clientes?section=filters` once, empty on failure, as the old bar did); `ScopeBar(props: { params: ClientesParams; onChange(patch: Partial<ClientesParams>): void; referenceYear: number })` — sticky (`sticky top-0 z-10`), contains Casa matriz | Tienda (`dim`), Grupo and Ruta `SearchableSelect`s, Origen segmented control (Todos | Patrimonio | Nuevos) with "Año de referencia: {referenceYear}", "Limpiar filtros (N)" button shown when N > 0, and a one-line scope note per control ("afecta: todo", "afecta: tablas y resumen").

- [ ] **Step 1: Write failing tests**: `ScopeBar shows reference year next to Origen`, `ScopeBar calls onChange with grupo patch`, `Limpiar filtros resets grupo, ruta, tienda, origen and is hidden at zero filters`, `ScopeBar dim switch is aria-pressed`.
- [ ] **Step 2: Run** the file → FAIL.
- [ ] **Step 3: Implement** both files; remove the old bar and test; fix imports left dangling (only `tab-clientes.tsx` uses it).
- [ ] **Step 4: Run** the new test plus `bun run test:components` filtered to touched files → PASS.
- [ ] **Step 5: Commit** `feat(clientes): sticky scope bar with URL state`.

### Task 4: Trend on the shared granularity rules

**Files:**
- Modify: `app/api/dwh/clientes/route.ts` (`trendQuery`, `handleTrend`), `app/(app)/analitica/analitica-client.tsx` (`GRANULARITY_TABS` add `'clientes'`), `app/(app)/analitica/types.ts` (`ClientesTrendRow.yearMonth` → `bucketKey`, label added)
- Create: `app/(app)/analitica/components/clientes/activity-trend-chart.tsx`
- Test: `app/api/dwh/clientes/__tests__/route.trend.test.ts`, `components/__tests__/clientes-activity-trend-chart.test.tsx`

**Interfaces:**
- Consumes: `parseTrendBucket(searchParams, dateRange)` from `app/api/dwh/lib/trend-bucket.ts`.
- Produces: `GET /api/dwh/clientes?section=trend&granularity=day|week|month` returns `{ rows: { bucketKey: string; label: string; activeCustomers: number; churnRate: number | null }[] }`; activos and churn are per bucket vs the previous bucket (existing `PrevMonth` CTE generalised to the bucket key). `ActivityTrendChart(props: { rows: ClientesTrendRow[]; granularity: Granularity; loading: boolean; error: string | null; onRetry(): void })`: solid line (activos, left axis titled "Clientes activos"), dashed line (abandono, right axis titled "Tasa de abandono"), direct end labels, "Ver tabla" toggle rendering a `<table>`, one-bucket case renders the two numbers as text instead of a plot, previous data stays dimmed while `loading`.

- [ ] **Step 1: Write failing tests**: route: `week granularity groups by ISO week key and keeps scope binds`, `month with a single-bucket range returns one row`, `default granularity follows resolveGranularity`; chart: `Ver tabla shows the values`, `single bucket renders text not a chart`, `error shows a retry button that calls onRetry`.
- [ ] **Step 2: Run** both files → FAIL.
- [ ] **Step 3: Implement** the route change by replacing the `YearMonth` expression with `trend.keyExpr('d')` over `dim.Dim_Date` joined on `DateKey` (as `ventas` route does), keeping `minYearMonth` replaced by the range start key; build the label via the helpers `granularity.ts` already exports for bucket labels.
- [ ] **Step 4: Run** the new tests plus existing `route.test.ts` and `route.scope.test.ts` (update their trend expectations only where the key renamed) → PASS.
- [ ] **Step 5: Commit** `feat(clientes): trend follows granularity, accessible chart`.

### Task 5: Page shell, stale-while-loading, collapsible detail

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-clientes.tsx`
- Create: `app/(app)/analitica/lib/use-dwh-section.ts`, `components/clientes/question-section.tsx`
- Test: `app/(app)/analitica/tabs/__tests__/tab-clientes.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `useDwhSection<T>(url: string | null): { data: T | null; loading: boolean; error: string | null; retry(): void }` — keeps previous `data` while loading a new URL, aborts in-flight requests, replaces the three copy-pasted fetch hooks in `tab-clientes.tsx` (Productos' `useSection` is left alone). `QuestionSection(props: { question: string; children: ReactNode })` renders an `<h2>` with the question text. `TabClientes` renders: `ScopeBar`, Q1 (trend chart now; KPI strip arrives in Task 11), Q2/Q3 placeholders absent until their tasks, Q4 containing the existing kind panels, and `Detalle operativo` (Cobertura + Pareto + Perdidos) inside a `<details>` bound to `detalle`.

- [ ] **Step 1: Write failing tests**: `renders ScopeBar and the Q1 heading`, `keeps previous data visible while a filter change reloads`, `grupo change sends grupo to the API URL`, `Detalle operativo is collapsed by default and opens when detalle=1`, `error shows retry`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; local `useState` for grupo/ruta/dimension replaced by `useClientesParams`; `CoberturaClientes` receives `grupo`/`ruta` from params as today.
- [ ] **Step 4: Run** the new test and the existing Clientes tests (`cobertura-clientes.test.tsx`, `route*.test.ts`) → PASS.
- [ ] **Step 5: Commit** `feat(clientes): executive layout shell and stale-while-loading`.

### Task 6: Pareto and Perdidos on the shared table; Cobertura polish

**Files:**
- Modify: `tabs/tab-clientes.tsx`, `components/cobertura-clientes.tsx`, `components/kind-panels.tsx`
- Test: `components/__tests__/cobertura-clientes.test.tsx` (extend), `tabs/__tests__/tab-clientes.test.tsx` (extend)

**Interfaces:**
- Consumes: `DataTable`, `downloadCsv`.
- Produces: Pareto and Perdidos tables rendered through `DataTable` (stable `rowKey` = name + code; search; CSV export; Pareto segment filter as `SegmentedControl` with counts); Cobertura header column "USD/mes" becomes "USD/mes (siempre USD)"; `text-gray-400` readable text replaced by `text-gray-600`; the "Imprimir" and "Exportar Excel" behavior unchanged. Making USD/mes follow the currency toggle needs a Bs monthly average in `/api/dwh/clientes/cobertura`; that is deferred (label only for now) and noted in the Task 18 docs.

- [ ] **Step 1: Write failing tests**: `Pareto header buttons expose aria-sort`, `Pareto search filters rows`, `Perdidos can be exported (downloadCsv called)`, `duplicate customer names render two rows`, `Cobertura USD/mes header states the fixed currency`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** all Clientes component tests → PASS.
- [ ] **Step 5: Commit** `refactor(clientes): shared table for Pareto and Perdidos, a11y fixes`.

---

## Phase 2: Taxonomy, KPI strip, trajectory, product view

### Task 7: Customer taxonomy (pure)

**Files:**
- Create: `lib/clientes/estado.ts`
- Test: `lib/clientes/__tests__/estado.test.ts`

**Interfaces:**
- Produces:
  - `type Estado = 'nuevo_periodo' | 'retenido' | 'recuperado' | 'enfriado' | 'perdido' | 'sin_ventas'`
  - `interface EstadoInput { firstInvoiceKey: number | null; lastInvoiceKey: number | null; boughtInPeriod: boolean; boughtInPrev: boolean; periodStartKey: number; periodEndKey: number; visitIntervalDays: number | null; todayKey: number }`
  - `classifyEstado(i: EstadoInput): Estado | null` — `null` when the customer is not part of P or P-1 and not `sin_ventas`/`perdido` relevant (not shown). Rules from the spec table: `nuevo_periodo` = first invoice ever inside P; `retenido` = P and P-1; `recuperado` = P, not P-1, earlier purchases exist; `enfriado` = P-1 not P; `perdido` = `enfriado` and days since last invoice > 3 × `visitIntervalDays`, or with no interval, no purchase in P, P-1 or the equal period before P-1; `sin_ventas` = never invoiced.
  - `interface Bridge { base: number; enfriados: number; perdidos: number; nuevos: number; recuperados: number; actual: number }` and `buildBridge(estados: (Estado | null)[]): Bridge` (`base = retenido+enfriado+perdido`, `actual = retenido+nuevo_periodo+recuperado`).

- [ ] **Step 1: Write failing tests** (table-driven, one per Estado): `nuevo_periodo when first invoice is inside P`, `retenido`, `recuperado`, `enfriado when last invoice is within 3 windows`, `perdido past 3 windows`, `perdido with no frequency after 2 empty periods`, `sin_ventas`, `null when prev period unavailable is handled by caller (boughtInPrev false and no history returns null)`, `buildBridge reconciles base and actual`.
- [ ] **Step 2: Run** `bun test --isolate lib/clientes/__tests__/estado.test.ts` → FAIL.
- [ ] **Step 3: Implement** as pure functions, no I/O.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(clientes): customer estado taxonomy and bridge`.

### Task 8: `section=estados` API

**Files:**
- Modify: `app/api/dwh/clientes/route.ts`; Create: `lib/clientes/estados-sql.ts`
- Modify: `app/(app)/analitica/types.ts`
- Test: `app/api/dwh/clientes/__tests__/route.estados.test.ts`

**Interfaces:**
- Consumes: `classifyEstado`, `customerKindInYear`, `customerScope`, `buildPrevPeriodDateWhereClause`, consignment exclusion.
- Produces: `GET /api/dwh/clientes?section=estados&dateRange&grupo&ruta` → `ClientesEstadosResponse { available: boolean; referenceYear: number; rows: EstadoRow[]; bridge: Bridge }` with `EstadoRow { customerCode; customerName; entityKey: number | null; entityName: string | null; sellerName: string | null; routeNumber: number | null; groupName: string | null; origen: 'patrimonio' | 'nuevo' | 'posterior' | null; estado: Estado; lastInvoiceKey: number | null; reasonDateKey: number | null; salesPeriod: Money; salesPrev: Money }` (`Money` = `{ bs: number | null; usd: number | null }`). `estados-sql.ts` exports `estadosQuery(scopeWhere: string, periodWhere: string, prevWhere: string): string` returning per-`CustomerCode` aggregates (first/last invoice key, sales in P and P-1 in Bs and USD, current dim attributes). `available: false` and empty rows when no previous period exists.

- [ ] **Step 1: Write failing tests** (mock pool as in `route.scope.test.ts`): `binds grupo and ruta through the shared scope`, `classifies rows and builds a reconciling bridge`, `available false when no previous period`, `excludes consignment roots`, `null USD stays null`, `posterior customers get origen posterior and are not counted in origen splits`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the section branch in `GET` after `section=churned`; classify in TypeScript from the SQL aggregates.
- [ ] **Step 4: Run** the new test plus existing route tests → PASS.
- [ ] **Step 5: Commit** `feat(clientes): estados section`.

### Task 9: `section=trayectoria` API (chain → stores)

**Files:**
- Modify: `app/api/dwh/clientes/route.ts`; Create: `lib/clientes/trayectoria-sql.ts`, `lib/clientes/trayectoria.ts`
- Test: `app/api/dwh/clientes/__tests__/route.trayectoria.test.ts`, `lib/clientes/__tests__/trayectoria.test.ts`

**Interfaces:**
- Produces:
  - `GET ...section=trayectoria` → `{ available: boolean; rows: TrayectoriaRow[] }`, `TrayectoriaRow { key: string; parentKey: string | null; kind: 'entidad' | 'tienda'; name: string; code: string | null; sales: Money; salesPrev: Money; units: number; unitsPrev: number | null; orders: number; lastOrderKey: number | null; estado: Estado | null; newStoresCount: number }` (entity rows have `parentKey: null`; store rows carry the entity key; a root with no other store has no children).
  - `rollUpTrayectoria(stores: StoreAggregate[]): TrayectoriaRow[]` (pure: groups stores under `LegalEntityKey`, an orphan or self-matriz store is its own root, `newStoresCount` = stores whose first invoice is in P).
- Chain Δ% is total (current membership); `newStoresCount` shown separately.

- [ ] **Step 1: Write failing tests**: `rollUp groups stores under their entity`, `orphan and self-matriz store is its own root`, `one-store chain has no children`, `newStoresCount counts stores first invoiced in the period`, `route: scope binds and USD null stays null`, `route: returns-only store has negative net`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** using `dualAmountExpr`, `usdConversionJoin`, `returnsAmountSubqueries` as `customerQuery` does, at store grain, then roll up in TypeScript.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(clientes): chain to store trajectory section`.

### Task 10: KPI strip

**Files:**
- Create: `lib/clientes/kpis.ts`, `components/clientes/kpi-strip.tsx`
- Test: `lib/clientes/__tests__/kpis.test.ts`, `components/__tests__/clientes-kpi-strip.test.tsx`

**Interfaces:**
- Consumes: `ClientesEstadosResponse`, `TrayectoriaRow[]`, `patrimonioHolding`/`newCustomersFunnel` from `app/(app)/analitica/lib/kind-kpis.ts` (unchanged).
- Produces: `buildKpis(input: { estados: ClientesEstadosResponse | null; trayectoria: TrayectoriaRow[] | null; currency: Currency }): KpiCardData[]` returning five cards (`ventas`, `activos`, `patrimonio`, `nuevos`, `perdidos`), each `{ id; label; value: string; current: number | null; previous: number | null; windowTag: 'período' | '12m' | 'histórico'; basis: string; onClickFilter?: Partial<ClientesParams> }`; `KpiStrip(props: { cards: KpiCardData[]; onFilter(patch: Partial<ClientesParams>): void })` using `DeltaBadge`; ventas card basis "incluye consignación", customer cards "sin consignación".

- [ ] **Step 1: Write failing tests**: `ventas sums store rows in the active currency and null when any USD is null`, `perdidos card equals enfriados + perdidos of the bridge`, `activos has previous from the bridge base`, `strip renders window tags and basis text`, `no previous period shows sin base`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; wire into `TabClientes` Q1 above the trend using `useDwhSection` for `estados` and `trayectoria`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(clientes): KPI strip with deltas`.

### Task 11: Q2 trajectory table

**Files:**
- Create: `components/clientes/trajectory-table.tsx`
- Modify: `tabs/tab-clientes.tsx`
- Test: `components/__tests__/clientes-trajectory-table.test.tsx`

**Interfaces:**
- Consumes: `DataTable` (expandable rows), `DeltaBadge`, `TrayectoriaRow`.
- Produces: `TrajectoryTable(props: { rows: TrayectoriaRow[]; currency: Currency; dim: Dim; selectedKey: string | null; onSelect(key: string | null): void })`. Columns: name (chain rows expand to stores), Ventas, Δ%, Unidades, Pedidos, Última compra, Estado badge, "tiendas nuevas" chip; `dim = tienda` flattens to stores; selecting a row sets `tienda=e:<key>`/`t:<code>` so the scope (and product view) follows; rows sorted by Δ$ descending by default; CSV export.

- [ ] **Step 1: Write failing tests**: `chain row expands to its stores`, `one-store chain is not expandable`, `Δ shows sin base when previous is null`, `selecting a row calls onSelect`, `tiendas nuevas chip appears only when greater than zero`, `dim tienda lists stores flat`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** and mount as Q2 "¿Cómo evolucionan clientes y tiendas?".
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(clientes): trajectory table Q2`.

### Task 12: Q4 retention section replaces panels and Perdidos

**Files:**
- Create: `components/clientes/retention-section.tsx`
- Modify: `tabs/tab-clientes.tsx`, `components/cobertura-clientes.tsx` (remove embedded kind panels, keep `KindBadge`/`StickinessBadge`), `components/kind-panels.tsx`
- Delete: `KindComparisonPanel`, `PatrimonioHoldingPanel`, `NewFunnelPanel` exports and the Perdidos table in `tab-clientes.tsx` once unused
- Test: `components/__tests__/clientes-retention-section.test.tsx`, update `cobertura-clientes.test.tsx`

**Interfaces:**
- Consumes: `ClientesEstadosResponse`, `DataTable`, `SegmentedControl`.
- Produces: `RetentionSection(props: { data: ClientesEstadosResponse | null; currency: Currency; origen: Origen; onOrigen(o: Origen): void })`: customer bridge line, sales bridge line (from `salesPrev`/`salesPeriod` sums by Estado), Estado rows with Patrimonio / Nuevo / Total columns, each count a button that filters the actionable list below ("Ver en tabla" via `estado` filter state), list columns customer or store, seller, last purchase, ventas perdidas, Estado, reason date; "¿Cómo se define?" `<details>` with the spec's two tables; when `available` is false shows "Sin período anterior comparable".

- [ ] **Step 1: Write failing tests**: `bridge reconciles with KPI perdidos+enfriados`, `clicking a count filters the list to that estado`, `origen switch splits rows`, `unavailable previous period shows the message and no zeros`, `definition popover lists all six estados`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; remove dead code and its tests; Cobertura keeps its own kind switch and status filters.
- [ ] **Step 4: Run** all Clientes component and route tests → PASS.
- [ ] **Step 5: Commit** `feat(clientes): retention section replaces kind panels and churn table`.

### Task 13: `ruta` filter on Productos API and shared trend card

**Files:**
- Modify: `lib/productos/item-filter.ts` (add `ruta: number | null`, SQL via `Dim_Zone.RouteNumber` of the current row, `.input('ruta', …)`, using `parseRuta` from `lib/clientes/scope.ts`), `app/api/dwh/productos/route.ts`
- Create: `components/productos/trend-card.tsx` (extracted from `tabs/tab-productos.tsx`, the `porLineaMes` BarChart block with the `Absoluto | 100 %` toggle and `trendClickPatch` click)
- Modify: `tabs/tab-productos.tsx` (use `TrendCard`)
- Test: `lib/productos/__tests__/item-filter.test.ts` (extend), `app/api/dwh/productos/__tests__/route.filters.test.ts` (extend), existing `route.trend.test.ts` unchanged

**Interfaces:**
- Produces: `ItemFilter.ruta`; `TrendCard(props: { data: PorLineaMesResponse | null; loading: boolean; error: string | null; nivel: Nivel; metric: Metric; onSeriesClick(patch: Partial<ProductosParams> | null): void })`. `grupo` already exists on Productos (`ErpSegmentCode`), so only `ruta` is new; Productos' own UI gets no ruta control.

- [ ] **Step 1: Write failing tests**: `item-filter parses ruta digits and ignores malformed`, `ruta SQL uses the current row and binds @ruta`, `route passes ruta through to every section query`, `no ruta leaves SQL unchanged`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; extraction is a pure move: existing `productos-*` tests must pass without edits.
- [ ] **Step 4: Run** `bun test --isolate lib/productos app/api/dwh/productos` and `bun run test:components` → PASS.
- [ ] **Step 5: Commit** `feat(productos): ruta filter and shared trend card`.

### Task 14: Q1 product breakdown following the scope

**Files:**
- Create: `components/clientes/product-breakdown.tsx`, `lib/clientes/product-url.ts`
- Modify: `tabs/tab-clientes.tsx`
- Test: `components/__tests__/clientes-product-breakdown.test.tsx`, `lib/clientes/__tests__/product-url.test.ts`

**Interfaces:**
- Consumes: `TrendCard`, `MasterTable` (unchanged, same props as Productos), `parseTienda` filter keys.
- Produces: `productosScopeQuery(p: ClientesParams, dateRange: string, granularity: Granularity, currency: Currency): URLSearchParams` (maps `tienda`, `grupo`, `ruta`, `nivel` to the Productos API); `ProductBreakdown(props: { params: ClientesParams; dateRange: DateRange; granularity: Granularity; currency: Currency; onParams(patch): void })` shown when `ver=producto`: `TrendCard` + ranked table (item, ventas, Δ%, unidades, alcance) with the customer accordion; line→sublínea→SKU drill via `trendClickPatch`; "Ver por" `SegmentedControl` (Total | Producto; Grupo appears in Task 16).

- [ ] **Step 1: Write failing tests**: `scope query carries tienda, grupo and ruta`, `selecting a chain row changes the product request`, `drill from línea sets nivel sublinea`, `Otras click does nothing`, `no data shows Sin datos not zero`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(clientes): scope-following product breakdown`.

---

## Phase 3: Grupo / ruta breakdown

### Task 15: `section=grupos` API

**Files:**
- Modify: `app/api/dwh/clientes/route.ts`; Create: `lib/clientes/grupos-sql.ts`
- Test: `app/api/dwh/clientes/__tests__/route.grupos.test.ts`

**Interfaces:**
- Produces: `GET ...section=grupos&by=grupo|ruta` → `{ available: boolean; rows: GrupoRow[] }`, `GrupoRow { key: string; name: string; sales: Money; salesPrev: Money; shareOfTotal: number | null; activos: number; activosPrev: number | null; nuevos: number; patrimonio: number; churnRate: number | null }`. The section ignores the filter of its own dimension (`by=grupo` ignores `grupo`, `by=ruta` ignores `ruta`) but applies the other and the Origen scope.

- [ ] **Step 1: Write failing tests**: `by=grupo ignores the grupo filter but binds ruta`, `by=ruta ignores ruta`, `shareOfTotal sums to 1 within rounding`, `null USD stays null`, `empty scope returns empty rows not NaN`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** reusing the Task 8 customer aggregates grouped by the customer's current `ErpSegmentCode` or `RouteNumber`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(clientes): grupo and ruta breakdown section`.

### Task 16: Q3 table and "Ver por Grupo" trend

**Files:**
- Create: `components/clientes/group-table.tsx`
- Modify: `app/api/dwh/clientes/route.ts` (`section=trendGrupo`), `components/clientes/product-breakdown.tsx` (rename to `breakdown-block.tsx` if Task 14's file now serves three views), `tabs/tab-clientes.tsx`
- Test: `components/__tests__/clientes-group-table.test.tsx`, `app/api/dwh/clientes/__tests__/route.trendgrupo.test.ts`

**Interfaces:**
- Produces: `GroupTable(props: { rows: GrupoRow[]; by: 'grupo' | 'ruta'; currency: Currency; selectedKey: string | null; onSelect(key: string | null): void })` ranked by Δ$ with a share-of-total bar in the Ventas cell and the selected row highlighted; `GET ...section=trendGrupo&granularity` → stacked series by grupo per bucket (top 10 + "Otras", same rule as Productos' `porLineaMes`); the "Ver por" control gains `Grupo`.

- [ ] **Step 1: Write failing tests**: `rows sorted by Δ$ descending`, `share bar has accessible text (percent) not color only`, `selected row highlighted and onSelect sets grupo`, `trendGrupo caps at 10 series plus Otras`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; mount as Q3 "¿Qué grupo o ruta mueve las ventas?" with a Grupo | Ruta `SegmentedControl`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(clientes): grupo/ruta table Q3 and trend by grupo`.

---

## Phase 4: SKUs en caída and finish

### Task 17: "SKUs en caída" in Q4

**Files:**
- Create: `components/clientes/falling-skus.tsx`
- Modify: `components/clientes/retention-section.tsx`
- Test: `components/__tests__/clientes-falling-skus.test.tsx`

**Interfaces:**
- Consumes: Productos `section=catalogo` at `nivel=sku` with the Clientes scope (`productosScopeQuery`), rows `trendPct`, `prevNet`.
- Produces: `FallingSkus(props: { params: ClientesParams; dateRange; granularity; currency })`: the 10 SKUs with the most negative `trendPct` among rows with `prevNet > 0` (null `trendPct` excluded, never shown as 0), each linking to `/analitica?tab=productos&q=<code>&tienda=…&grupo=…&ruta=…&dateRange=…` (same keys Productos parses).

- [ ] **Step 1: Write failing tests**: `lists the most negative trendPct first`, `excludes rows without a prior base`, `link carries scope and dateRange`, `empty scope shows Sin datos`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(clientes): falling SKUs list linked to Productos`.

### Task 18: Docs, cleanup, full regression

**Files:**
- Modify: `AGENTS.md` (Directory Map entries for `lib/clientes/*`, `components/clientes/`, `lib/clientes-params.ts`; Analítica tabs "Clientes" bullet rewritten for the two-axis taxonomy, scope bar, sections, URL keys; note that group/route scope now also applies to Cobertura via URL), `content/help/` Clientes page if one exists, `docs/clientes-tab-ux-review.md` (add "Resolved by" note)
- Delete: unused exports and tests left by Tasks 5, 6 and 12

- [ ] **Step 1:** Run `bun run test:unit` and `bun run test:components`; list any failures.
- [ ] **Step 2:** Fix failures caused by this work; do not edit unrelated tests.
- [ ] **Step 3:** Update the docs above so they match the shipped behavior (no stale mentions of `CarteraFilterBar`, Perdidos table or the three panels).
- [ ] **Step 4:** Run `bun run lint` and `bunx tsc --noEmit` → no errors.
- [ ] **Step 5: Commit** `docs(clientes): update AGENTS.md and cleanup after redesign`.
