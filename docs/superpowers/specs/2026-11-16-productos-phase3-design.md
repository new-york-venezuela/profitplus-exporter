# Productos Phase 3: inline customer accordion — design

Status: approved by user 2026-11-16. Builds on Phase 1 (`2026-11-16-productos-master-table-design.md`) and Phase 2 (`2026-11-16-productos-phase2-design.md`). Kg stays out of scope.

## Goals
Expanding a master-table row (click on the row or its chevron) shows, directly under it, a customer breakdown for that item at the active `nivel` (a línea row lists customers who bought that línea, etc.):
- **Callout:** "Los 3 principales clientes concentran X % de las ventas netas de este ítem".
- **Pills:** `Todos` | `Alta devolución (>4 %)` | `Vencido / en riesgo`.
- **Table, net sales descending**, one row per **client** (legal entity; customers with no legal entity are their own client so net totals add up to the item's): client name + group badge (the ROOT customer's current group, fallback the customer's); `POS activos X / Y` (X = tiendas buying this item in the range, Y = tiendas of that client buying anything from us in the range); net sales + share of the item; units; avg realised price (gross ÷ units); return rate with a warning marker when > 2× the item's own rate; reorder status = days since last order + `Vencido` flag.
- Several rows can be open at once; data is fetched lazily on expand and cached per (item key, filters, range, currency). Clicking a bubble in the plot now expands (and scrolls to) its row.

## Non-goals
Drilling below the client, Kg, editing anything.

## Definitions / my calls (approved)
- **Overdue** uses a 12-month lookback ending today, independent of the selected range: orders = distinct invoice DateKeys for the client × item (same item key expression and the bar's filters). `avgGapDays = (lastOrder − firstOrder) / (orders − 1)` (exact average gap, computed from count/min/max in SQL); `Vencido` when `daysSinceLastOrder > 2 × avgGapDays`; with fewer than 3 orders the status is "Sin historial" (`overdue: null`), never flagged. Constants `OVERDUE_LOOKBACK_MONTHS = 12`, `OVERDUE_MIN_ORDERS = 3`, `OVERDUE_FACTOR = 2` are named and exported.
- "Alta devolución" pill = client return rate > `RETURN_RATE_WARN` (0.04, the Phase 1 constant); the row warning marker = rate > 2 × item rate (and rate > 0).
- Everything follows currency, devolución-date returns at the original factura's rate, the tienda (`e:`/`t:`) filter and the item filters; null USD shows "Sin datos", never $0.

## API
`GET /api/dwh/productos?section=clientes&nivel&key=<item key>&dateRange&currency&tienda&categoria&lineas&sublineas&grupo&q` -> `ClientesResponse { nivel; key; itemNet: Dual; itemReturnRate: number | null; top3SharePct: number | null; rows: ClienteRow[] }`. `key` uses the same key expressions as `catalogo` (`catalogoKeys`). Unknown `nivel`/missing `key` -> 400.

## Tests
Pure module (concentration, overdue boundary at exactly 2×, <3 orders, zero gap, warning ratio, sorting, null USD), route (SQL shape: item key bound, filters on sales/returns/history, 12-month window, client key fallback, 400s, 200 with all rows), components (accordion pills filter, callout text, chevron toggle/aria-expanded, lazy fetch + cache, bubble click expands).
