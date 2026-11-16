# Productos: unified master table, sticky bar, Pareto (Phase 1 of 3) — design

Status: approved by user 2026-11-16. Phase 1 only. Source prompt: user's "Redesign and Upgrade the Product & SKU Analytics Tab".

## Roadmap (agreed order)
1. **Phase 1 (this doc):** sticky control bar, unified master table, Pareto.
2. Phase 2 (own design later): Volume & Mix chart, momentum/return-risk bubble plot, client-type matrix redesign (metric toggle, row-share shading, collapsible).
3. Phase 3 (own design later): inline customer accordion (per-customer net/units/price/returns, active POS X/Y, reorder cadence + Overdue, concentration callout).

## Decisions from the user
- **Kg dropped** (no weight data in `Dim_Product`/ERP feed): no Kg metric, no `$/kg`.
- Ordering as above. Stack stays Next.js + Recharts + Tailwind (already in the repo).

## Goals (Phase 1)
- Sticky bar: **nivel** switch Línea | Sublínea | SKU (SKU = all active SKUs company-wide, no forced drill); **metric** toggle Ventas netas | Unidades; filters: entidad/tienda picker (existing), categoría (existing), línea multi-select, sublínea multi-select, grupo de cliente ("client type", = customer's CURRENT `ErpSegmentCode`), text search (SKU code or name). All synced to the URL; existing date range, currency (Bs/USD) and returns basis (devolución date) are unchanged.
- One master table replacing the drill table and the Profundidad table. Columns: item identity (+ `Línea › Sublínea` pills at SKU level); Pareto badge A/B/C; net + % of total; gross + returns (red subtext); return rate (amber/red above 4%); units; avg units/month; avg realised price; reach `X clientes · Y tiendas`. Client-side sortable; default sort by the active metric, descending.
- The grupo matrix (`section=grupos`) and the trend chart keep working: the matrix follows `nivel` and the bar's filters; clicking a trend segment sets the línea filter to that línea and `nivel` to Sublínea.

## Non-goals (Phase 1)
- Row expansion / customer accordion (Phase 3), new charts, matrix redesign (Phase 2), period-over-period deltas (Phase 2 bubble plot), Kg.

## Definitions (my calls, to be corrected if wrong)
- Client = legal entity (`Dim_LegalEntity`), POS/tienda = distinct customer code; "reach" counts both.
- Return rate = returns ÷ gross (Bs), devolución-date basis, USD at the original factura's rate (existing helpers).
- Avg realised price = gross sales ÷ units sold (return units are not in the sales fact, so it is not net/net). Avg units/month = units ÷ distinct months with sales in range (as today's Profundidad).
- **Pareto** ranks items by net sales in the active currency over the full filtered set: A = items while the cumulative share before them is < 80%, B = < 95%, else C. Items with net <= 0 are C; items with no USD value in USD mode get no class ("—", never a guess). Computed server-side over all items (no TOP-N truncation).
- Metric toggle drives default sort and the highlighted column only; Pareto always uses net sales.
- Null USD renders "Sin datos", never $0 (existing invariant).

## Approaches
A (chosen): one new endpoint `section=catalogo` returns one row per item; Pareto in a pure module. B (rejected): merge the existing drill (TOP 30) and Profundidad (TOP 15) endpoints in the browser — truncated lists make Pareto wrong.

## Design
- `GET /api/dwh/productos?section=catalogo&nivel=linea|sublinea|sku&dateRange&tienda&categoria&lineas=a,b&sublineas=a,b&grupo=<code>&q=<text>` -> `{ rows: CatalogoRow[]; nivel }`. Item key: linea = LineName; sublinea = `LineName|SubLineName`; sku = trimmed ProductCode. Null names use the existing `Sin línea`/`Sin sublínea` labels.
- `GET ...?filtros=1` -> `{ lineas: string[]; sublineas: { linea: string; sublinea: string }[]; grupos: { code: string; name: string }[] }`.
- Filters are one pure module (`lib/productos/item-filter.ts`: parse + SQL fragment + `.input()` binds, numbered inputs for lists, LIKE wildcards escaped), shared by `catalogo` and `fetchGroupShare`. `fetchGroupShare` no longer requires a drill scope: `level` plus optional filters.
- Old default drill and `section=profundidad` branches, their client code, `DepthTable` and the drill table are removed if no other consumer exists (implementer greps; keep what is still used).
- URL state in a small hook (`useProductosParams`) that reads `useSearchParams` and writes with `router.replace` preserving other params (`tab`, `dateRange`, ...); defaults omitted from the URL.

## Tests
Pareto (thresholds, ties, zero/negative/null), item filter (parse, SQL, binds, wildcard escape, injection-shaped input), route (`catalogo` per nivel, filters bound, `filtros=1`, returns side filtered), URL hook, bar and table components (sort, badges, amber threshold, "Sin datos").
