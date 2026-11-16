# Productos Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inline customer accordion under each Productos master-table row with concentration callout, filter pills and Overdue/return-risk flags.

**Architecture:** A pure `customer-breakdown` module shapes per-client rows from three grouped queries (period sales, period returns, 12-month order history) behind `section=clientes`; the UI lazily fetches per expanded row.

**Tech Stack:** Next.js 16, mssql, React Testing Library, bun test.

**Spec:** `docs/superpowers/specs/2026-11-16-productos-phase3-design.md` (plus Phase 1/2 specs for shared definitions)

## Global Constraints

- All subagents on Sonnet, never Opus. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- `null` stays null: "Sin datos"/"Sin historial", never $0, 0 % or an Overdue guess. SQL via `.input()`; reuse `catalogoKeys`, `itemFilterSql`/`bindItemFilter`/`returnsItemFilterSql`, `tiendaKeysSql`/`bindTienda`, `dualAmountExpr`, `usdConversionJoin`, `returnsUsdConversionJoin`, `buildDateWhereClause`, `buildReturnsDateWhereClause`.
- Client key: legal entity key; customers with no legal entity are their own client (so client nets sum to the item's net). Resolve through the customer's CURRENT row (SCD versions of a store count once).
- New catch blocks: `console.error` + `captureException`. `bunx eslint` 0 errors on touched files (no ref writes in render, no setState in effects). Component tests: `screen` from `test/dom-setup` first, `cleanup` in `afterEach`.
- Phase 1/2 behaviour unchanged; no Kg; no drill below client.

## Review Focus

- Item with one client; item with zero sales in range but history (no rows); clients with returns but no sales in the range are not listed (as Phase 1).
- Overdue exact boundary: `daysSince == 2 × gap` is NOT overdue; 2 orders or fewer -> `overdue: null`; all orders same day (gap 0) -> `overdue: null` (avoid divide/zero nonsense).
- Return-rate warning with item rate 0 (no warning), client rate > 4 % pill vs > 2× item marker are independent.
- `POS X / Y`: Y >= X always; Y counts tiendas with any sales in the range for that client, not only the item.
- History query ignores the selected range (last 12 months from today) but respects tienda/categoría/item filters and the item key.
- Expanded rows survive sorting/re-render; changing filters/range/currency discards stale cache (no ghost data).

---

### Task 1: `section=clientes` endpoint and pure breakdown module

**Files:**
- Create: `lib/productos/customer-breakdown.ts` (pure), `lib/productos/__tests__/customer-breakdown.test.ts`
- Modify: `app/api/dwh/productos/route.ts` (new `section=clientes` handler + three query builders), `app/(app)/analitica/types.ts` (`ClienteRow`, `ClientesResponse`)
- Test: `app/api/dwh/productos/__tests__/route.clientes.test.ts` (reuse the mocking pattern of `route.catalogo.test.ts`)

**Interfaces:**
- Consumes: Phase 1/2 helpers listed in Global Constraints, `RETURN_RATE_WARN` (export a copy-free import from where it lives; if it lives in a component file, move the constant to `lib/productos/` and re-export from the component so nothing else breaks).
- Produces:
  - constants `OVERDUE_LOOKBACK_MONTHS = 12`, `OVERDUE_MIN_ORDERS = 3`, `OVERDUE_FACTOR = 2`, `RETURN_WARN_MULTIPLE = 2`
  - `interface ClienteRaw { id: string; name: string; groupCode: string | null; groupName: string | null; posItem: number; posTotal: number; gross: Dual; returns: Dual; units: number; orders: number; firstOrderKey: number | null; lastOrderKey: number | null }`
  - `interface ClienteRow { id: string; name: string; group: { code: string; name: string } | null; posItem: number; posTotal: number; net: Dual; sharePct: number | null; units: number; avgPrice: Dual; returnRate: number | null; returnWarn: boolean; highReturn: boolean; orders: number; lastOrderDate: string | null; daysSinceLastOrder: number | null; avgGapDays: number | null; overdue: boolean | null }`
  - `buildClienteBreakdown(raw: ClienteRaw[], opts: { currency: Currency; todayKey: number }): { rows: ClienteRow[]; itemNet: Dual; itemReturnRate: number | null; top3SharePct: number | null }` — rows sorted by net in the active currency desc (null last), `sharePct` of the item net in that currency (null if item net <= 0 or the client net null), `top3SharePct` over the top three non-null positive nets / item net (null when item net <= 0), `highReturn = returnRate > RETURN_RATE_WARN`, `returnWarn = returnRate > 2 × itemReturnRate && itemReturnRate > 0`, overdue rules per spec (date math on DateKeys YYYYMMDD in UTC).
  - `interface ClientesResponse { nivel: Nivel; key: string; itemNet: Dual; itemReturnRate: number | null; top3SharePct: number | null; rows: ClienteRow[] }`

- [ ] **Step 1: Failing tests (pure):** concentration math with 4 clients; fewer than 3 clients; overdue at exactly 2× gap (false), just above (true), 2 orders (null), same-day orders (null), `daysSince` from `todayKey`; warn marker with item rate 0; highReturn at exactly 4 % (false); USD mode with null USD nets sorts last and shares null; client nets add up to `itemNet`.
- [ ] **Step 2: Failing route tests:** 400 for unknown nivel / missing key; item key bound as `@itemKey` and compared with `catalogoKeys(nivel,'p')`; filters (`lineas`, `q`, `grupo`, tienda `e:`/`t:`, categoría) bound on the sales, returns AND history queries; the history query uses a 12-month window from today and ignores `dateRange`; client key falls back to the customer code when there is no legal entity; response shape; catch -> 500 + captureException.
- [ ] **Step 3: Run** `bun test --isolate --env-file=.env.local lib/productos app/api/dwh/productos` — FAIL.
- [ ] **Step 4: Implement.** Sales query groups by client and returns `posItem` (`COUNT(DISTINCT cur.CustomerCode)`), gross/units; returns query by client; a separate "all purchases" query for `posTotal` (distinct current customer codes per client with any sale in the range; honours tienda only); history query returns `COUNT(DISTINCT fs.DateKey)`, `MIN`, `MAX` per client. Merge by client id in TS. Group badge = the root customer's current segment (join `Dim_Segment` through `le.RootCustomerCode`'s IsCurrent row), fallback the customer's own current segment. Run the independent queries concurrently on separate request objects.
- [ ] **Step 5: Run** `bunx tsc --noEmit -p .`, `bunx eslint` (touched files), the same bun test command — PASS. Commit `feat(productos): customer breakdown endpoint`.

### Task 2: Accordion UI, row expansion, bubble click expands

**Files:**
- Create: `app/(app)/analitica/components/productos/customer-accordion.tsx`, `app/(app)/analitica/lib/use-clientes-breakdown.ts` (lazy fetch + cache keyed by URL, abort-safe)
- Modify: `app/(app)/analitica/components/productos/master-table.tsx` (chevron column, `expandedKeys`/`onToggle` props, renders the accordion row via a `renderExpanded(row)` prop so the table stays presentational; click on the row toggles; `aria-expanded`/`aria-controls`), `app/(app)/analitica/tabs/tab-productos.tsx` (own `expandedKeys` state; pass `renderExpanded` building the clientes URL from the same `filterParams` as catalogo plus `nivel`/`key`; bubble `onSelect` expands + highlights + scrolls; clear expansion when nivel/filters/range/currency change)
- Modify: `AGENTS.md` (Directory Map + Productos bullet: accordion, `section=clientes`, Overdue rule/constants, lazy fetch)
- Test: `app/(app)/analitica/components/__tests__/productos-customer-accordion.test.tsx`, extend `productos-master-table.test.tsx`

**Interfaces:**
- Consumes: `ClientesResponse`/`ClienteRow` (Task 1), `Currency`, existing format helpers (`moneyLabel`, `qty`, `pct`/`signedPct` from `productos-format.ts`).
- Produces: `CustomerAccordion({ state: { status: 'loading' | 'error' | 'ready'; data?: ClientesResponse; error?: string }; currency: Currency })` (owns pill state); `useClientesBreakdown(url: string | null): State` (null url = idle); MasterTable props `expandedKeys: ReadonlySet<string>`, `onToggleRow(key: string): void`, `renderExpanded(row: CatalogoRow): React.ReactNode`.

- [ ] **Step 1: Failing tests:** accordion — callout text with `top3SharePct` (and hidden when null), pills filter rows (Alta devolución = `highReturn`, Vencido = `overdue === true`), empty-filter message, `POS X / Y`, "Sin historial" for `overdue: null`, `Vencido` badge, warning marker + accessible label, "Sin datos" for null USD price/net, loading and error states; table — chevron toggles `aria-expanded`, expanded row renders `renderExpanded` output in a full-width row under it, other rows unaffected, sort keeps expansion by key; hook — fetches once per URL and reuses cache, aborts on URL change.
- [ ] **Step 2: Run** `bun run test:components` — FAIL. **Step 3: Implement.** **Step 4: Run** `bunx tsc --noEmit -p .`, `bunx eslint` on touched files (0 errors), `bun test --isolate --env-file=.env.local lib/productos app/api/dwh "app/(app)/analitica/lib" __tests__/unit/productos`, `bun run test:components` — PASS.
- [ ] **Step 5: Commit** `feat(productos): inline customer accordion`, then `docs: productos phase 3` for the AGENTS.md update.
