# Productos Master Table (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Productos drill table and Profundidad table with a unified, sortable master table (with Pareto) driven by a sticky URL-synced control bar.

**Architecture:** A new `section=catalogo` endpoint returns one row per item (línea / sublínea / SKU). Pure modules own Pareto and item filtering. The tab reads/writes its controls through a URL hook; the grupo matrix and trend chart follow the bar's filters.

**Tech Stack:** Next.js 16 App Router, mssql (DWH), Recharts (untouched), bun test, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-productos-master-table-design.md`

## Global Constraints

- Kg is out of scope. No accordion, no new charts (Phases 2/3).
- DWH SQL only on `dim.*`/`fact.*`; every user value via `.input()`; LIKE wildcards in `q` escaped.
- Returns use the devolución-date basis, USD at the original factura's rate (reuse `returnsAmountSubqueries`, `buildReturnsDateWhereClause`, `dualAmountExpr`, `usdConversionJoin`).
- `null` USD renders "Sin datos", never `$0`; Pareto never invents a class for a null value.
- Pareto: A while cumulative share BEFORE the item is < 80%, B while < 95%, else C; net <= 0 -> C.
- Return-rate highlight above 4% (amber 4-8%, red above 8% is my call; keep thresholds in one named constant).
- Tienda filter keeps working via `lib/productos/tienda-filter.ts` (`e:`/`t:`); do not touch Clientes/Devoluciones.
- Existing date range, currency, returns-basis URL params and the global `granularity` (time bucket) param keep their meaning; the new level switch is `nivel`.
- Component tests: import `screen` from `test/dom-setup` first, `cleanup` in `afterEach`, `bun run test:components`.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Pareto on a single item, all-equal values, all-zero/negative values, empty set -> no crash, sensible classes.
- `q` containing `%`, `_`, `[`, quotes -> escaped/parametrised, never an SQL error or accidental wildcard.
- SKU level with no filters returns every active SKU (no TOP cap) without timing out the route handler's pool (single grouped query, returns joined once, not a correlated subquery per row).
- Item with sales but zero returns -> returns 0 (not null); item with returns but no sales in range is not listed.
- Filters combine (lineas AND sublineas AND grupo AND q AND tienda AND categoria) and apply to BOTH the sales and the returns side.
- URL hook: unknown/garbled params fall back to defaults; changing a control never drops `tab`/`dateRange`/`currency`.
- Trend-segment click sets lineas=[linea] and nivel=sublinea.

---

### Task 1: Pareto module

**Files:**
- Create: `lib/productos/pareto.ts`
- Test: `lib/productos/__tests__/pareto.test.ts`

**Interfaces:**
- Produces: `type ParetoClass = 'A' | 'B' | 'C'`; `classifyPareto(items: { key: string; value: number | null }[]): Map<string, ParetoClass | null>`; `PARETO_A = 0.8`, `PARETO_B = 0.95`.

- [ ] **Step 1: Failing tests:** `[60,25,10,5]` -> cumulative share before each item is 0, .60, .85, .95 -> A, A, B, C; ties keep stable order by key; single item -> A; all-equal four items (25% each) -> A,A,A,B? (before: 0,.25,.5,.75 -> all A) assert exactly that; value <= 0 -> C and excluded from the total; `null` value -> `null` class and excluded; empty -> empty map; duplicate keys not expected (document).
- [ ] **Step 2: Run** `bun test lib/productos/__tests__/pareto.test.ts` — FAIL.
- [ ] **Step 3: Implement** `classifyPareto` (sort descending by value, stable on key; total over positive values; total 0 -> every non-null item C).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(productos): pareto classification`.

### Task 2: Item filter module

**Files:**
- Create: `lib/productos/item-filter.ts`
- Test: `lib/productos/__tests__/item-filter.test.ts`

**Interfaces:**
- Produces:
  - `interface ItemFilter { lineas: string[]; sublineas: string[]; grupo: string | null; q: string | null }`
  - `parseItemFilter(params: URLSearchParams): ItemFilter` (comma lists, trimmed, empties dropped, max 50 entries per list, `q` trimmed and capped at 80 chars, blank -> null)
  - `itemFilterSql(f: ItemFilter, o?: { product?: string; fact?: string }): string` — AND-prefixed fragment over product alias (default `p`) and fact alias (default `fs`): `ISNULL(p.LineName,'Sin línea') IN (@linea0,...)`, `ISNULL(p.SubLineName,'Sin sublínea') IN (@sublinea0,...)`, grupo as `fs.CustomerKey IN (SELECT tk.CustomerKey FROM dim.Dim_Customer tk JOIN dim.Dim_Customer cur ON cur.CustomerCode = tk.CustomerCode AND cur.IsCurrent = 1 WHERE RTRIM(cur.ErpSegmentCode) = @grupo)`, q as `(p.ProductCode LIKE @q ESCAPE '\' OR p.ProductName LIKE @q ESCAPE '\')`
  - `bindItemFilter(req, f)` (inputs `linea0..`, `sublinea0..`, `grupo`, `q` already wrapped `%...%` with `\ % _ [` escaped)
  - `returnsItemFilterSql(f)`: same predicates over `pr`/`fr` for the returns side.

- [ ] **Step 1: Failing tests** for parse (lists, trimming, caps, blank q), SQL contains each predicate only when set and no raw values, binds produce expected input names/values, wildcard escaping of `50%_[x]\`, injection-shaped `q` (`'; DROP TABLE x;--`) appears only as a bound value.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(productos): item filter module`.

### Task 3: `catalogo` + `filtros` endpoints, group-share follows the filter

**Files:**
- Modify: `app/api/dwh/productos/route.ts` (add `section=catalogo`, `?filtros=1`; remove default drill + `section=profundidad` branches only if Task 5's grep confirms no other consumers — otherwise leave them)
- Modify: `lib/productos/queries.ts` (`GroupShareQueryOptions` gains `filter: ItemFilter`; drop the "linea required for sublinea/sku" throws and the `linea`/`sublinea` scope in favour of `filter`)
- Modify: `app/(app)/analitica/types.ts` (add `CatalogoRow`, `CatalogoResponse`, `ProductosFiltrosResponse`)
- Modify: `scripts/dwh/__tests__/consolidation-queries.test.ts` (adapt `fetchGroupShare` calls to the new options; type-correct even if not runnable locally)
- Test: `app/api/dwh/productos/__tests__/route.catalogo.test.ts` (new, reuse the mocking pattern of `route.filters.test.ts`)

**Interfaces:**
- Consumes: `classifyPareto` (T1), `parseItemFilter`/`itemFilterSql`/`bindItemFilter`/`returnsItemFilterSql` (T2), `parseTienda`/`tiendaKeysSql`/`bindTienda`.
- Produces:
  - `interface CatalogoRow { key: string; label: string; code: string | null; linea: string; sublinea: string; salesGross: Dual; returns: Dual; salesNet: Dual; units: number; monthCount: number; avgUnitsPerMonth: number; avgPrice: Dual; returnRate: number | null; clientCount: number; posCount: number; sharePct: number | null; pareto: ParetoClass | null }` where `Dual` is the existing `{ bs: number; usd: number | null }` type
  - `interface CatalogoResponse { rows: CatalogoRow[]; nivel: 'linea'|'sublinea'|'sku' }`
  - `interface ProductosFiltrosResponse { lineas: string[]; sublineas: { linea: string; sublinea: string }[]; grupos: { code: string; name: string }[] }`
  - the `grupos` section accepts `nivel` (alias of `groupBy`) and the item-filter params; `fetchGroupShare(pool, { dateWhere, level, filter, tienda, categoria })`.

- [ ] **Step 1: Failing tests** in `route.catalogo.test.ts`: per `nivel` the SQL groups by the right expression and rows map to `CatalogoRow` (gross, returns, net = gross − returns via `subtractDual`, `avgPrice = gross/units`, `returnRate = returnsBs/grossBs` null when gross 0, `avgUnitsPerMonth = units/monthCount`, `sharePct` of total net in the active data); Pareto assigned from net (Bs, or USD when all rows have USD — implementer: classify on `salesNet.usd` when the request has `currency=usd`, else Bs; add the `currency` param); filters from `lineas/sublineas/grupo/q/tienda/categoria` appear in BOTH the sales and the returns SQL with binds; `?filtros=1` returns the three lists; an item with sales and no returns has returns 0; no `TOP` in the SQL.
- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local app/api/dwh/productos` — new tests FAIL.
- [ ] **Step 3: Implement.** One grouped sales query per nivel (include `COUNT(DISTINCT le.LegalEntityKey)`, `COUNT(DISTINCT fs.CustomerKey)` — note this counts SCD customer keys; count POS as `COUNT(DISTINCT cur.CustomerCode)` via the current-row join so a store that changed version counts once — and `COUNT(DISTINCT d.YearMonth)`), one grouped returns query merged by item key in TypeScript. Do not use per-row correlated subqueries.
- [ ] **Step 4: Run** `bunx tsc --noEmit -p .` and the route tests — PASS; existing `route.filters.test.ts` still passes (adjust only where the removed/changed branches require, keeping their intent).
- [ ] **Step 5: Commit** `feat(productos): catalogo and filtros endpoints`.

### Task 4: URL state hook, MultiSelect, sticky bar

**Files:**
- Create: `app/(app)/analitica/lib/productos-params.ts` (pure parse/serialize + `useProductosParams()` hook)
- Create: `lib/components/multi-select.tsx`
- Create: `app/(app)/analitica/components/productos/control-bar.tsx`
- Test: `app/(app)/analitica/lib/__tests__/productos-params.test.ts`, `lib/components/__tests__/multi-select.test.tsx`, `app/(app)/analitica/components/__tests__/productos-control-bar.test.tsx`

**Interfaces:**
- Produces:
  - `type Nivel = 'linea'|'sublinea'|'sku'`; `type Metric = 'ventas'|'unidades'`
  - `interface ProductosParams { nivel: Nivel; metric: Metric; tienda: string | null; categoria: string | null; lineas: string[]; sublineas: string[]; grupo: string | null; q: string }`
  - `parseProductosParams(sp: URLSearchParams): ProductosParams` (defaults `nivel='linea'`, `metric='ventas'`; invalid -> default), `applyProductosParams(sp: URLSearchParams, patch: Partial<ProductosParams>): URLSearchParams` (omits defaults/empties, preserves every other param), `useProductosParams(): [ProductosParams, (patch: Partial<ProductosParams>) => void]` (uses `useSearchParams` + `router.replace(..., { scroll: false })`)
  - `MultiSelect({ options: {value,label}[]; value: string[]; onChange(v: string[]): void; placeholder: string; ariaLabel?: string })` — searchable checkbox list in a popover
  - `ControlBar` props: `{ params; onChange(patch); tiendas; categorias; lineaOptions; sublineaOptions; grupoOptions }`; sticky (`sticky top-0 z-20`), contains the nivel segmented switch, metric toggle, the existing `SearchableSelect` tienda picker, categoría select, two `MultiSelect`s, grupo select, debounced (250 ms) search input.

- [ ] **Step 1: Failing tests:** params parse/apply round-trip, defaults omitted, garbled `nivel=zzz` -> default, `apply` keeps `tab`/`dateRange`/`currency`; MultiSelect select/deselect/filter-by-typing; ControlBar clicking Sublínea calls `onChange({ nivel: 'sublinea' })`, typing in search debounces to one `onChange({ q })`.
- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local app/(app)/analitica/lib lib/components app/(app)/analitica/components/__tests__` — FAIL. **Step 3: Implement.** **Step 4: Run** + `bun run test:components` — PASS.
- [ ] **Step 5: Commit** `feat(productos): url-synced control bar`.

### Task 5: Master table and tab integration

**Files:**
- Create: `app/(app)/analitica/components/productos/master-table.tsx`, `app/(app)/analitica/components/productos/pareto-badge.tsx`
- Modify: `app/(app)/analitica/tabs/tab-productos.tsx` (use `useProductosParams` + `ControlBar`; fetch `section=catalogo`, `?filtros=1`; matrix fetch uses `nivel` + filter params; trend-segment click -> `onChange({ lineas: [linea], nivel: 'sublinea' })`; remove the drill table, breadcrumb state, Profundidad fetch/section and `DepthTable` usage)
- Delete (only after `grep -rn` shows no other importer): `app/(app)/analitica/components/productos/depth-table.tsx` and its tests; unused types `ProductosRow`/`ProfundidadLineaRow` etc. and the old route branches from Task 3 if now unused; check `e2e/` for tests touching the removed UI and update them
- Test: `app/(app)/analitica/components/__tests__/productos-master-table.test.tsx`

**Interfaces:**
- Consumes: `CatalogoRow`/`CatalogoResponse` (T3), `ProductosParams`/`Metric`/`Nivel` and `ControlBar` (T4), `Currency` (`'bs'|'usd'` per existing `analitica/types`).
- Produces: `MasterTable({ rows: CatalogoRow[]; currency: Currency; metric: Metric; nivel: Nivel; loading: boolean; error: string | null })`; `RETURN_RATE_WARN = 0.04`, `RETURN_RATE_ALERT = 0.08` exported from `master-table.tsx`; `ParetoBadge({ value: ParetoClass | null })`.

- [ ] **Step 1: Failing component tests:** renders columns in the specified order; default sort follows `metric` (ventas -> net desc, unidades -> units desc); clicking a header toggles asc/desc; Pareto badge A/B/C and "—" for null; return rate cell amber above 4%, red above 8%, neutral at 4% exactly; `salesNet.usd === null` in USD mode renders "Sin datos" (never `$0`); breadcrumb pills `Línea › Sublínea` only at `nivel='sku'`; reach text `X clientes · Y tiendas`; empty and error states.
- [ ] **Step 2: Run** `bun run test:components` — FAIL. **Step 3: Implement** the table and integrate the tab; delete dead code per the list. **Step 4: Run** `bunx tsc --noEmit -p .`, `bun run test:components`, `bun test --isolate --env-file=.env.local app/api/dwh lib/productos` — all PASS.
- [ ] **Step 5: Commit** `feat(productos): unified master table with pareto`. Then update `AGENTS.md` (Directory Map: `lib/productos/{pareto,item-filter}.ts`, `components/productos/{control-bar,master-table}`; Productos bullet: nivel/metric/filters, catalogo endpoint, Pareto definition, removed Profundidad/drill table) in a second commit `docs: productos master table`.
- [ ] **Step 6: Manual check (controller, not implementer):** open `/analitica?tab=productos`, switch nivel, apply each filter, confirm table totals equal the previous tab's Línea totals for the same range, Pareto A items cover ~80% of net.
