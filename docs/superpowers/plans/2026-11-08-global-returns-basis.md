# Global Returns Basis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One global "Devoluciones" basis selector (default por fecha de devolución) on Resumen, Ventas and Devoluciones; every other Analítica tab counts returns by devolución date only.

**Architecture:** `analitica-client.tsx` owns a `returnsBasis` URL param (like `dateRange`) and passes it to tabs as a prop; the three selector tabs forward it to their API routes, which already build return windows through `buildReturnsDateWhereClause` / `returnsDateColumn`. All other routes drop the explicit `'factura'` argument and any hard-coded `OriginalInvoiceDateKey` period bucket. USD conversion keeps using the factura's rate.

**Tech Stack:** Next.js 16 App Router, React 19, Bun test (+ React Testing Library on happy-dom), mssql, Recharts.

**Spec:** `docs/superpowers/specs/2026-11-08-global-returns-basis-design.md`

## Global Constraints

- URL param: `returnsBasis=devolucion|factura`; absent or invalid means `devolucion`.
- Selector visible only on tabs `resumen`, `ventas`, `devoluciones`; hidden tabs never forward the param and their routes never read it.
- USD for returns stays converted at the original factura's rate (`returnsUsdConversionJoin` unchanged).
- A missing USD value stays `null`, never `0`.
- The period bucket of a return (month/week/day) must use the same date column that windows it.
- Labels: reuse `RETURNS_BASIS_LABEL` (`por fecha de factura` / `por fecha de devolución`).
- Run tests with `bun test --isolate --env-file=.env.local <path>`; component tests follow the `test/dom-setup` convention in AGENTS.md.

## Review Focus

1. `?returnsBasis=garbage` or an empty value → behaves as `devolucion` (never throws, never `factura`).
2. A stale `?returnsBasis=factura` while on Seguimiento/Clientes/Productos/Finanzas/Histórico/Vendedor 360 → their SQL still uses `DateKey`.
3. Tabs stay mounted when hidden (see `mountedTabs`): switching the selector on Resumen then visiting Ventas must show the same basis, and a mounted tab must refetch when the prop changes.
4. Window vs bucket mismatch: a return counted in a total but missing from its month/week series (window on one column, bucket on the other).
5. Histórico 2025 boundary: a 2026-dated return on a 2025 factura is excluded; a 2025-dated return on a 2024 factura is included.

---

### Task 1: Core basis helpers default to devolución

**Files:**
- Modify: `app/api/dwh/lib/query-builder.ts:140-166` (doc comment, `parseReturnsBasis`, `buildReturnsDateWhereClause`)
- Test: `app/api/dwh/lib/__tests__/query-builder.test.ts`

**Interfaces:**
- Produces: `parseReturnsBasis(value: string | null): ReturnsBasis` → `'factura'` only for the exact string `'factura'`, otherwise `'devolucion'`. `buildReturnsDateWhereClause(dateRange: string, tableName: string, basis: ReturnsBasis = 'devolucion'): string`.

- [ ] **Step 1: Write failing tests** in `query-builder.test.ts`: `parseReturnsBasis(null)`, `('')`, `('garbage')`, `('devolucion')` each return `'devolucion'`; `parseReturnsBasis('factura')` returns `'factura'`; `buildReturnsDateWhereClause('month:2026-11','fr')` contains `fr.DateKey` and not `OriginalInvoiceDateKey`; with `'factura'` it contains `fr.OriginalInvoiceDateKey`. Update any existing assertion that expects the old `factura` default.
- [ ] **Step 2: Run** `bun test --isolate --env-file=.env.local app/api/dwh/lib/__tests__/query-builder.test.ts`; expected FAIL on the new default.
- [ ] **Step 3: Implement** the signature changes above and rewrite the doc comment so `'devolucion'` is documented as the default and `'factura'` as the per-factura reconciliation basis.
- [ ] **Step 4: Run the same test**; expected PASS.
- [ ] **Step 5: Commit** `feat(dwh): returns basis defaults to devolución date`.

### Task 2: Global param, selector and tab prop

**Files:**
- Create: `app/(app)/analitica/lib/returns-basis.ts`, `app/(app)/analitica/components/returns-basis-selector.tsx`
- Modify: `app/(app)/analitica/analitica-client.tsx` (`TabComponentProps`, param parsing near line 128, toolbar, tab render near line 423)
- Test: `app/(app)/analitica/lib/__tests__/returns-basis.test.ts`, `app/(app)/analitica/components/__tests__/returns-basis-selector.test.tsx`

**Interfaces:**
- Produces: `DEFAULT_RETURNS_BASIS: ReturnsBasis = 'devolucion'`; `resolveReturnsBasis(param: string | null): ReturnsBasis`; `RETURNS_BASIS_TABS: ReadonlySet<TabKey>` = `{resumen, ventas, devoluciones}`; `<ReturnsBasisSelector value={ReturnsBasis} onChange={(b: ReturnsBasis) => void} />`. `TabComponentProps` gains `returnsBasis: ReturnsBasis`. `ReturnsBasis` is imported from `app/(app)/analitica/types.ts`.
- Consumes: Task 1 semantics (default `devolucion`).

- [ ] **Step 1: Write failing tests.** `returns-basis.test.ts`: `resolveReturnsBasis` for `null`, `''`, `'garbage'` → `'devolucion'`, `'factura'` → `'factura'`; `RETURNS_BASIS_TABS` contains exactly the three keys. Selector test: renders two buttons labelled via `RETURNS_BASIS_LABEL`, the active one has `aria-pressed="true"`, clicking the other calls `onChange` with its value.
- [ ] **Step 2: Run both tests**; expected FAIL (modules missing).
- [ ] **Step 3: Implement** the two files. The selector is the group markup currently in `tab-ventas.tsx:584-598` (same `role="group"`, `aria-label="Fecha de atribución de devoluciones"`, `aria-pressed`, label text, not colour alone) moved out as a component.
- [ ] **Step 4: Wire `analitica-client.tsx`:** `returnsBasis = resolveReturnsBasis(searchParams.get('returnsBasis'))`; render `<ReturnsBasisSelector>` in the toolbar only when `RETURNS_BASIS_TABS.has(activeTab)`, `onChange` → `updateParams({ returnsBasis: b })`; pass `returnsBasis` to every `<TabComponent>`. Do not store it in localStorage.
- [ ] **Step 5: Run the new tests and `bunx tsc --noEmit`**; expected PASS. Tabs that ignore the prop need no change (extra props are allowed by `TabComponentProps` consumers via destructuring only what they use).
- [ ] **Step 6: Commit** `feat(analitica): global returns basis param and selector`.

### Task 3: Ventas reads the global basis

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-ventas.tsx` (state at ~200, toggle markup ~584-604, fetch deps ~262-363, key at ~738)
- Test: existing `app/(app)/analitica/tabs/__tests__` Ventas test if present, otherwise `app/(app)/analitica/components/__tests__/tab-ventas-basis.test.tsx`

**Interfaces:**
- Consumes: `TabComponentProps.returnsBasis` (Task 2). The route `app/api/dwh/ventas/route.ts` already accepts `returnsBasis`; its `parseReturnsBasis` default is now `devolucion` through Task 1.

- [ ] **Step 1: Write failing test:** render `TabVentas` with `returnsBasis="devolucion"` and a mocked `fetch`; assert every request URL contains `returnsBasis=devolucion`; rerender with `"factura"` and assert new requests contain `returnsBasis=factura`; assert no element with `aria-label="Fecha de atribución de devoluciones"` is rendered inside the tab.
- [ ] **Step 2: Run it**; expected FAIL.
- [ ] **Step 3: Implement:** take `returnsBasis` from props, delete the `useState` and the toggle markup, keep the explanatory sentence (the `factura`/`devolucion` text at ~600-603) as a static note under the tab header. All existing effect dependency arrays keep `returnsBasis`.
- [ ] **Step 4: Run the test and `bun run test:components`**; expected PASS.
- [ ] **Step 5: Commit** `refactor(ventas): use the global returns basis`.

### Task 4: Resumen honours the basis and labels it

**Files:**
- Modify: `app/api/dwh/resumen/route.ts` (GET ~364-420, `monthlyTrendQuery` ~34-55), `app/(app)/analitica/types.ts` (`ResumenResponse` ~115), `app/(app)/analitica/tabs/tab-resumen.tsx` (props ~28, fetch ~46, deps ~66, cards/chart header)
- Test: `app/api/dwh/resumen/__tests__/route.test.ts`, a Resumen component test next to the existing ones

**Interfaces:**
- Produces: `ResumenResponse.returnsBasis: ReturnsBasis`. `monthlyTrendQuery(dateWhere, returnsDateWhere, bucket, returnsColumn: 'DateKey' | 'OriginalInvoiceDateKey')`.
- Consumes: `parseReturnsBasis`, `returnsDateColumn`, `buildReturnsDateWhereClause` from `query-builder.ts`.

- [ ] **Step 1: Write failing route tests** with the existing mocked pool: request without the param → all issued SQL windows returns on `fr.DateKey` and the trend join uses `fr.DateKey`; request with `returnsBasis=factura` → `fr.OriginalInvoiceDateKey` in both the window and the trend join; response JSON has `returnsBasis`. Add a component test: Resumen shows text containing `RETURNS_BASIS_LABEL[basis]` on the Ventas/Devoluciones/Neto card group, and refetches (URL contains `returnsBasis=`) when the prop changes.
- [ ] **Step 2: Run both**; expected FAIL.
- [ ] **Step 3: Implement route:** read `parseReturnsBasis(searchParams.get('returnsBasis'))`; build `returnsDateWhere` with it (replace the hard-coded `'factura'` at line 378); thread `returnsDateColumn(basis)` into `monthlyTrendQuery` so the bucket join at line 52 uses it; include `returnsBasis` in the response. Prior-period comparison queries must window returns on the same column. USD joins untouched.
- [ ] **Step 4: Implement tab:** send `returnsBasis` in the fetch URL, add it to the effect deps, show the basis label on the cards and the chart caption.
- [ ] **Step 5: Run tests**; expected PASS.
- [ ] **Step 6: Commit** `feat(resumen): returns by devolución or factura date with basis label`.

### Task 5: Devoluciones honours the basis

**Files:**
- Modify: `app/api/dwh/devoluciones/route.ts` (GET ~190-290 and the drill-down at ~272), `app/(app)/analitica/tabs/tab-devoluciones.tsx` (all `URLSearchParams` at ~206, 233, 260, 287, 326 and their deps)
- Test: `app/api/dwh/devoluciones/__tests__/route.test.ts`, tab fetch test

**Interfaces:**
- Consumes: `parseReturnsBasis`, `buildReturnsDateWhereClause` (Task 1); `TabComponentProps.returnsBasis` (Task 2).

- [ ] **Step 1: Write failing tests:** route with no param windows `fr` on `DateKey` (unchanged behaviour); with `returnsBasis=factura` windows on `fr.OriginalInvoiceDateKey`, including the drill-down query; sales denominators (`fs`, `fs2`) windows are identical in both cases. Tab test: every fetch URL carries `returnsBasis` and refetches on change.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement:** replace `buildDateWhereClause(dateRange, 'fr')` with `buildReturnsDateWhereClause(dateRange, 'fr', basis)` for returns windows only; update the header comment of the route; add `returnsBasis` to the response types `DevolucionesResponse` / `DevolucionesKpisResponse`; in the tab append the param to every request and dep array and show the basis label next to the heading.
- [ ] **Step 4: Run tests**; expected PASS.
- [ ] **Step 5: Commit** `feat(devoluciones): follow the global returns basis`.

### Task 6: Clientes, Productos, Finanzas, Vendedor 360 use devolución date

**Files:**
- Modify: `app/api/dwh/clientes/route.ts:368`, `app/api/dwh/productos/route.ts:421` (+ comment at 44), `app/api/dwh/finanzas/route.ts:142` (`fxJoin(..., 'OriginalInvoiceDateKey')` at 54 stays: it is the USD rate join), `app/api/dwh/vendedor-360/route.ts` (already windows on `DateKey`; fix the comments only)
- Test: each route's existing `__tests__/route*.test.ts`

**Interfaces:**
- Consumes: Task 1 default.

- [ ] **Step 1: Write failing tests:** for each of clientes, productos and finanzas, a request including `returnsBasis=factura` still produces returns windows on `fr*.DateKey` (assert no window predicate on `OriginalInvoiceDateKey`; the USD rate join may still mention it). Adjust any existing expectation that encodes the `factura` window.
- [ ] **Step 2: Run**; expected FAIL for the three routes.
- [ ] **Step 3: Implement:** delete the explicit `'factura'` argument so they take the default; correct the comments that say returns are windowed by the factura's date.
- [ ] **Step 4: Run the four route test files**; expected PASS.
- [ ] **Step 5: Commit** `feat(analitica): clientes, productos and finanzas count returns by devolución date`.

### Task 7: Histórico 2025 windows returns by devolución date

**Files:**
- Modify: `lib/dwh/historico-window.ts:7-8` (`HISTORICO_RETURNS_WINDOW`), `app/api/dwh/historico/route.ts` (joins at ~50 and ~54, `returnsMonthFilter` at ~247, header comments)
- Test: `app/api/dwh/historico/__tests__/route.window.test.ts`

**Interfaces:**
- Produces: `HISTORICO_RETURNS_WINDOW` = `AND frl.DateKey BETWEEN ${HISTORICO_FROM_KEY} AND ${HISTORICO_TO_KEY}`; the monthly return subqueries join `dim.Dim_Date dr ON dr.DateKey = frl.DateKey`. USD stays `legacyReturnsUsdConversionJoin` (factura rate).

- [ ] **Step 1: Write failing tests** in `route.window.test.ts`: the issued SQL window for returns references `frl.DateKey`; the month bucket join uses `frl.DateKey`; the legacy USD join still uses `OriginalInvoiceDateKey`. Add a pure test on `HISTORICO_RETURNS_WINDOW`.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** the three edits above and update the file comments.
- [ ] **Step 4: Run both historico test files**; expected PASS.
- [ ] **Step 5: Commit** `feat(historico): 2025 returns windowed by devolución date`.

### Task 8: Seguimiento queries use devolución date

**Files:**
- Modify: `lib/seguimiento/queries.ts` (returns window calls at ~196, ~220, ~286; bucket joins `JOIN dim.Dim_Date d ON d.DateKey = fr.OriginalInvoiceDateKey` at ~237 and ~330; comment at ~85)
- Test: `lib/seguimiento/__tests__/` queries test (or `app/api/dwh/seguimiento/__tests__/route.test.ts`)

**Interfaces:**
- Consumes: Task 1 default. Bucket joins become `d.DateKey = fr.DateKey`; `returnsUsdConversionJoin` unchanged.

- [ ] **Step 1: Write failing tests:** the SQL built for the month returns, the weekly returns and the history returns contains `fr.DateKey` for both the window and the `Dim_Date` bucket join and no `OriginalInvoiceDateKey` outside `returnsUsdConversionJoin`; a returns row dated in the month for a prior-month factura appears in that month's week bucket.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** by removing the `'factura'` arguments and changing the two bucket joins; update the comment at ~85.
- [ ] **Step 4: Run seguimiento tests and `bun run test:unit` for `lib/seguimiento`**; expected PASS.
- [ ] **Step 5: Commit** `feat(seguimiento): returns by devolución date`.

### Task 9: Documentation

**Files:**
- Modify: `AGENTS.md` ("Ventas brutas / netas" bullet and the Seguimiento/Histórico paragraphs that say returns follow the factura's date), `content/help/analitica-definiciones.md`, `docs/ventas-netas-analysis.md`

- [ ] **Step 1:** Rewrite each statement of the old rule: default is devolución date; `factura` basis exists only via the global selector on Resumen/Ventas/Devoluciones; USD at the factura's rate; Histórico window is by devolución date.
- [ ] **Step 2: Run** `grep -rn "OriginalInvoiceDateKey\|fecha de factura" AGENTS.md content docs/ventas-netas-analysis.md`; every remaining mention must describe the selector or the USD rate.
- [ ] **Step 3: Commit** `docs: returns basis defaults to devolución date`.

### Task 10: Full verification

- [ ] **Step 1:** Run `bunx tsc --noEmit`, `bun run test:unit`, `bun run test:components`; expected all PASS.
- [ ] **Step 2:** Against the local restored database, open `/analitica?tab=resumen` and confirm: selector visible on Resumen/Ventas/Devoluciones, hidden on the others; default shows devolución date; switching to factura changes the returns figures and the label; the choice survives a tab switch and reload.
