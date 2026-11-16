# Productos Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add period-over-period trend, a momentum/return-risk bubble plot, a 100%-share toggle on the trend chart, and a metric-aware collapsible client-group matrix to the Productos tab.

**Architecture:** `catalogo` gains prior-period net per item (second grouped query merged in TS); `fetchGroupShare` gains units. A pure `bubble-data` module shapes plot points. UI components consume existing `ProductosParams` (+ one new `matriz` flag).

**Tech Stack:** Next.js 16, mssql, Recharts (ScatterChart/ZAxis), bun test, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-productos-phase2-design.md` (and Phase 1 spec `2026-11-16-productos-master-table-design.md`)

## Global Constraints

- `null` stays null: "Sin datos", never 0 or 0%; trend % null when no comparable period or prior net <= 0.
- All SQL via `.input()`; reuse `itemFilterSql`/`bindItemFilter`/`tiendaKeysSql`/`bindTienda`, `buildPrevPeriodDateWhereClause`, `dualAmountExpr`, `usdConversionJoin`.
- Phase 1 behaviour, thresholds (RETURN_RATE_WARN 0.04 / ALERT 0.08) and Pareto definition unchanged. No row expansion, no Kg.
- New catch blocks call `console.error` + `captureException` like the rest of route.ts.
- Component tests: import `screen` from `test/dom-setup` first, `cleanup` in `afterEach`, `bun run test:components`. Lint (`bunx eslint` on touched files) must report 0 errors (react-hooks rules: no ref writes in render, no setState in effects).
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. All subagents run on Sonnet, never Opus.

## Review Focus

- Previous-period query uses the SAME filters as current and the same item key expression; item with no prior sales -> `prevNet` null, `trendPct` null.
- `buildPrevPeriodDateWhereClause` returns null (closed past YTD) -> no prior query, all trends null, UI says why (no crash).
- Bubble chart with 0 plottable items, 1 item, all-equal X, huge outlier Y (clamped), > 150 items (capped, note shown).
- Heat shading never relies on colour alone (value + % text always shown); zero-row-total handled.
- Collapsed matrix does not fetch? (acceptable either way) but the URL flag round-trips and defaults omitted.

---

### Task 1: Period-over-period in `catalogo`

**Files:**
- Modify: `app/api/dwh/productos/route.ts` (`handleCatalogo`: second grouped sales query over the previous period window with identical filters and key expression; merge by key; compute `prevNet`, `trendPct`)
- Modify: `app/(app)/analitica/types.ts` (`CatalogoRow` gains `prevNet: Dual | null; trendPct: number | null`)
- Test: `app/api/dwh/productos/__tests__/route.catalogo.test.ts`

**Interfaces:**
- Produces: `CatalogoRow.prevNet` (prior-period NET = prior gross − prior returns, same basis as `salesNet`; null when no prior sales row for the item or no comparable period) and `CatalogoRow.trendPct: number | null` = `(net − prevNet) / prevNet` in the request's `currency` (null when prevNet <= 0, null in that currency, or net null).
- Prior-period returns: include them (net must be comparable) using the same returns query pattern over the previous window (`buildPrevPeriodDateWhereClause(dateRange, 'fr')` on the returns side).

- [ ] **Step 1: Failing tests:** prev window SQL appears on both sales and returns queries with the same filter binds; `trendPct` for net 150 vs prev 100 = 0.5 (bs) and USD variant; prevNet null / trendPct null when item absent in prior period; all null when `buildPrevPeriodDateWhereClause` returns null (use `dateRange=ytd:<past year>`; read how YTD ranges are spelled in query-builder tests); prev net <= 0 -> null; USD null on either side -> null in usd mode.
- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local app/api/dwh/productos` — FAIL.
- [ ] **Step 3: Implement** (reuse the catalogo sales/returns query builders parameterised by date WHERE strings; do not copy-paste the SQL).
- [ ] **Step 4: Run** `bunx tsc --noEmit -p .` and the route tests — PASS.
- [ ] **Step 5: Commit** `feat(productos): period-over-period trend in catalogo`.

### Task 2: Group-share units

**Files:**
- Modify: `lib/productos/queries.ts` (`fetchGroupShare` also selects `SUM(fs.QuantitySold) AS Units`), `lib/productos/group-share.ts` (`GroupShareRaw.units`, `GroupShareCell.units` + `unitShare`, `GroupShareRow.totalUnits`, `GroupShareColumn.units`; keep existing fields and the zero-sales-row omission rule for the sales metric), `app/(app)/analitica/types.ts` if the response type mirrors them
- Modify: `scripts/dwh/__tests__/consolidation-queries.test.ts` (type-correct adaptation only; cannot run locally)
- Test: `lib/productos/__tests__/group-share.test.ts` (extend), `app/api/dwh/productos/__tests__/route.filters.test.ts` (grupos mock rows gain `Units`)

**Interfaces:**
- Produces: matrix cells carry both metrics: `{ salesBs, salesUsd, share, units, unitShare }`; rows `totalUnits`; columns `units` (for ordering by the active metric the UI sorts itself).

- [ ] **Step 1: Failing tests** for units aggregation, `unitShare` summing to 1 per row, rows with sales > 0 but zero units, and unchanged sales shares.
- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local lib/productos app/api/dwh` — FAIL. **Step 3: Implement.** **Step 4: Run** + `bunx tsc --noEmit -p .` — PASS.
- [ ] **Step 5: Commit** `feat(productos): units in group-share matrix`.

### Task 3: Master-table Δ column and bubble plot

**Files:**
- Create: `lib/productos/bubble-data.ts` (pure), `app/(app)/analitica/components/productos/bubble-plot.tsx`
- Modify: `app/(app)/analitica/components/productos/master-table.tsx` (Δ vs. período anterior column after "Ventas netas"; rows get `id={`prod-row-${key}`}` and a `highlightKey?: string | null` prop applying a highlight class), `app/(app)/analitica/tabs/tab-productos.tsx` (render the plot card between the trend chart and the matrix; click handler sets `highlightKey` state and `scrollIntoView` on the row)
- Test: `lib/productos/__tests__/bubble-data.test.ts`, `app/(app)/analitica/components/__tests__/productos-bubble-plot.test.tsx`, extend `productos-master-table.test.tsx`

**Interfaces:**
- Consumes: `CatalogoRow` (T1 fields), `Currency`, `Metric`.
- Produces:
  - `type BubbleY = 'trend' | 'returnRate'`
  - `interface BubblePoint { key: string; label: string; x: number; y: number; yReal: number; size: number; pareto: ParetoClass | null; trendPct: number | null; returnRate: number | null; net: number }`
  - `buildBubbleData(rows: CatalogoRow[], yMode: BubbleY, currency: Currency, opts?: { cap?: number; clampPct?: number }): { points: BubblePoint[]; missing: number; truncated: number }` — cap default 150 by net desc; clamp default 2 (±200%) applies to the trend axis only (`y` clamped, `yReal` real); items with null Y or net <= 0 / null net count in `missing` (net <= 0 can't size a bubble) and are not plotted.
  - `BubblePlot({ rows, currency, onSelect(key: string): void })` with its own local Y toggle (Tendencia vs. período anterior | Tasa de devolución), reference lines at the medians? NO — keep to a plain axes + a zero line for trend; legend for A/B/C colours; note texts "N sin datos" and "Mostrando los 150 principales" when applicable; tooltip content per spec.

- [ ] **Step 1: Failing tests:** `buildBubbleData` (null Y -> missing, cap/truncated count, clamp with yReal kept, empty input, single item, net<=0 excluded, USD mode uses usd net and drops null-USD items to missing); component: renders legend entries, notes, calls `onSelect` with the key on bubble click (Recharts scatter in happy-dom may not render SVG shapes — test the data/props via a thin presentational seam or mock `recharts` like other chart tests in the repo; look for an existing pattern first), Y toggle switches the axis label; master table Δ cell: `+12,5 %`/`−8,0 %` formatting through the existing pct helper with sign, "Sin datos" for null trend, highlight class on `highlightKey`.
- [ ] **Step 2: Run** `bun run test:components` and the lib test — FAIL. **Step 3: Implement.** **Step 4: Run** + `bunx tsc --noEmit -p .` + `bunx eslint` on touched files — PASS.
- [ ] **Step 5: Commit** `feat(productos): period-over-period column and bubble plot`.

### Task 4: Trend 100% toggle and collapsible metric-aware matrix

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-productos.tsx` (trend card: Absolute | 100 % toggle (local state, `stackOffset="expand"` or pre-normalised data — implementer's choice; tooltip keeps real units; Y axis shows %), matrix card collapsible via `matriz` param, passes `metric` and heat shading)
- Modify: `app/(app)/analitica/lib/productos-params.ts` (`ProductosParams.matriz: boolean`, default true, URL `matriz=0` when closed; omit default; garbled -> default) + its tests
- Modify: `app/(app)/analitica/components/productos/group-share-matrix.tsx` (props `metric: Metric`, `currency`; cell: value bold + share % muted; background `rgba(<accent>, share*0.35)`-style shading proportional to row share, text always shown; row total column; columns ordered by the active metric descending; "Sin datos" for null USD value)
- Test: extend `productos-params.test.ts`, add `app/(app)/analitica/components/__tests__/productos-group-share-matrix.test.tsx`, a small test for the 100% normalisation helper (extract a pure `normalizeStack(rows, keys)` into `lib/productos/` or the chart's folder and unit-test it: zero-total bucket stays zeros, sums to 1 otherwise)

**Interfaces:**
- Consumes: Task 2's cells (`units`, `unitShare`, `totalUnits`), `Metric`.

- [ ] **Step 1: Failing tests** (params round-trip incl. `matriz=0`; matrix shows units + unit share in 'unidades' and net + share in 'ventas'; shading style present and proportional (compare two cells); collapse hides the body but keeps the header and toggles the URL param via the supplied callback; normalizeStack cases).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `bunx tsc --noEmit -p .`, `bunx eslint` (touched files, 0 errors), `bun test --isolate --env-file=.env.local app/api/dwh lib/productos "app/(app)/analitica/lib"`, `bun run test:components` — PASS.
- [ ] **Step 5: Commit** `feat(productos): 100% share toggle and collapsible metric-aware matrix`; then update `AGENTS.md` Productos bullet + Directory Map (bubble-data, bubble-plot, trendPct/prevNet, matrix metric/collapse, `matriz` param) in `docs: productos phase 2`.
