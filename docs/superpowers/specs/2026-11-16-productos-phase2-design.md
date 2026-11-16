# Productos Phase 2: bubble plot, period-over-period, matrix redesign, share toggle — design

Status: approved by user 2026-11-16. Builds on `2026-11-16-productos-master-table-design.md` (Phase 1). Phase 3 (customer accordion) and Kg remain out of scope.

## Goals
- `catalogo` rows gain `prevNet: Dual | null` and `trendPct: number | null` (net vs the prior equal period via `buildPrevPeriodDateWhereClause`; null when there is no comparable period — e.g. a closed past YTD — or the prior net is <= 0; shown as "Sin datos", never 0%). Master table gains a "Δ vs. período anterior" column.
- Bubble plot (Recharts scatter): X = avg units/month, Y toggle = trend % | return rate %, size = net sales, colour = Pareto class (A/B/C). Tooltip: name, velocity, trend, return rate, net sales. Click scrolls to the item's master-table row and highlights it (no expansion: Phase 3). Items with a null Y are left off and counted in an "N sin datos" note; at most the top 150 items by net sales are plotted (note shown when truncated).
- Trend chart: Absolute | 100% share toggle (client-side normalisation of each bucket; the server data is unchanged; local UI state).
- Group-share matrix: follows the bar's metric (Ventas netas | Unidades), cell = value in bold + row share % muted, heat shading proportional to the row share, row total column, collapsible card whose open/closed state is in the URL (`matriz=0` closed; default open).

## Non-goals
Customer accordion, row expansion, Kg, changing Phase 1 definitions (Pareto, reach, return-rate thresholds).

## Definitions / my calls
- Trend % = (net − prevNet) / prevNet in the ACTIVE currency (USD null if either side lacks USD).
- Previous period reuses the same filters (tienda, categoría, lineas, sublineas, grupo, q) as the current one.
- Bubble Y trend is clamped for display at ±200% (tooltip shows the real value).
- Matrix `units` row share = units / row units total; zero-total rows are omitted as today.

## Tests
Route (prev-period SQL present on catalogo, null cases, filters bound on prev query), group-share (units, shares), pure bubble-data builder (null handling, cap, clamp), component tests (table Δ column, bubble chart data/legend/click, share toggle normalisation, matrix metric/collapse/shading).
