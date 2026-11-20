# Clientes tab: UX/UI summary

Code-only review (`app/(app)/analitica/tabs/tab-clientes.tsx`, `components/cobertura-clientes.tsx`, `components/kind-panels.tsx`, `components/cartera-filter-bar.tsx`). The app was not run, so layout and visual notes come from the markup.

## Structure (top to bottom)

| # | Block | Component | Data scope |
|---|---|---|---|
| 1 | **Grupo y ruta** filter bar | `CarteraFilterBar` | Scopes the whole tab |
| 2 | **Cobertura de clientes** | `CoberturaClientes` | One row per customer code |
| 2a | Imprimir and Exportar Excel buttons, Todos / Patrimonio / Nuevos switch | | |
| 2b | 3 panels: Nuevos vs patrimonio, ¿Se mantiene el patrimonio?, ¿Se quedan los nuevos? | `kind-panels` | |
| 2c | 2 KPI groups (8 cards): Cobertura and Visitas y período | | |
| 2d | Filter row: vendedor, estado, visita, constancia, 2 checkboxes | | |
| 2e | 14-column table | | |
| 3 | **Nivel de análisis** toggle (Entidad / Tienda) | `tab-clientes` | Pareto, trend and churn only |
| 4 | Line chart: clientes activos and tasa de abandono (dual axis) | Recharts | By entity or store |
| 5 | Table: clientes perdidos | | By entity or store |
| 6 | Table: Segmentación Pareto with an A/B/C filter and sortable columns | | By entity or store |

## What works well

- **Status is never shown by color alone.** Badges (Patrimonio/Nuevo, constancia, estado, visita) carry text labels. The ▲▼ arrows sit next to green/red deltas, and funnel bars carry numbers.
- **Missing data is honest.** Missing values show "Sin datos" or "—", never `$0`.
- **Good cross-panel interaction.** "Ver en la tabla" in the holding panel sets the Patrimonio and cooled filters, and a dismissible chip shows the active state.
- **Cobertura has solid basics.** Real `<button>`s, `aria-sort` on headers, `aria-pressed` on the kind switch, table roles on the comparison panel, a print layout (one page per seller), Excel export, and PostHog events on both.
- **Tooltips explain jargon.** KPI `title`s define "Visitas vencidas" and "Sin compras en el período".
- **Partly smooth loading.** The filter bar and Cobertura stay mounted when grupo or ruta changes, so only the lower block reloads.

## Problems

### Information architecture
1. **Overloaded page, backwards order.** The first screen is the heaviest block (3 panels, 8 KPIs, 6 filters, a 14-column table). Charts and the Pareto only appear after scrolling past it.
2. **"Nivel de análisis" is in the wrong place.** It says "Aplica a todo lo de abajo" but renders below Cobertura and does not change Cobertura.
3. **Two grains, no visual cue.** Cobertura is per customer code. The chart, churn table and Pareto are per entity or store. Filtering by "Patrimonio" does not affect the Pareto.
4. **Uneven date-range rules.** Last sale uses all history, averages use 12 months, and only two items use the selected range. This needs a paragraph of explanation.
5. **Repeated metrics.** "Clientes nuevos" appears as a KPI, in the kind switch count and in the comparison panel. "Sin compras en el período" is both a KPI and a checkbox, next to "Incluir inactivos", which is easy to confuse with it.
6. **"USD/mes" ignores the currency toggle.** Other columns follow it, so a user in Bs sees mixed currencies.

### State, filters and navigation
7. **Filters live in local `useState` only.** Nothing is in the URL, so reload, tab switch or sharing loses grupo, ruta, nivel, kind, seller and the rest. Productos syncs to the URL.
8. **No "clear filters" control.** There are 6+ independent filters, and only the cooled chip can be dismissed.
9. **Loading causes layout jumps.** The whole lower block is replaced by "Cargando…" and old data is dropped.
10. **Crude errors.** Three copy-pasted fetch hooks. A failed request shows a red box with no retry.

### Tables
11. **Cobertura table is very wide (14 columns).** Horizontal scroll, no sticky header or first column, rows not clickable (no customer detail), full list rendered with no pagination or virtualization.
12. **Pareto table is less accessible than Cobertura.** Sort is `onClick` on `<th>` (no keyboard, no `aria-sort`), no search, and `key={r.name}` collides on duplicate names.
13. **Churn table is thin.** No sorting, no limit, no export, no seller, so it is hard to act on. Keyed by `name-index`.
14. **Only Cobertura can export or print.** The Pareto and churn tables have neither.

### Visual consistency
15. **Three toggle styles.** Entidad/Tienda and A/B/C are blue-600 pills without `aria-pressed`. Todos/Patrimonio/Nuevos is gray-900 with `aria-pressed`. Action buttons are a third style.
16. **Low contrast.** `text-gray-400` (about 2.5:1) is used for customer codes, the "Se enfriaron" hint and empty states. Much explanatory copy is `text-xs text-gray-500`.
17. **Chart has no text alternative.** Dual axis, red/blue only, no axis titles, tooltip is the only way to read values. Seguimiento's history chart has an sr-only table.
18. **Inconsistent labels.** "Entidad", "cadena", "casa matriz" and "cliente" are used for related ideas. Main analytics uses "Casa matriz | Tienda".
19. **Dense Spanish copy.** The Pareto subtitle packs the definition, thresholds and returns-attribution rule into one small paragraph.

## Recommendations (by impact)

| Priority | Change |
|---|---|
| **High** | Move "Nivel de análisis" into the top filter bar next to grupo/ruta and label what it affects. Put a short summary first (few KPIs and the trend chart). Collapse the Cobertura detail table behind a section header. |
| **High** | Sync all filters (grupo, ruta, nivel, kind, seller, status, visit, constancia) to the URL as Productos does. Add "Limpiar filtros". |
| **High** | Make USD/mes follow the currency toggle, or label it "USD" explicitly. |
| **Medium** | Add a customer drill-down on Cobertura rows. Make header and first column sticky. Add pagination or virtualization. |
| **Medium** | Bring the Pareto and churn tables to Cobertura's standard: header buttons with `aria-sort`, stable keys, search. Add seller to churn, plus export for both. |
| **Medium** | Unify toggle and button components, and use `aria-pressed` everywhere. |
| **Medium** | Keep previous data while reloading, and add a retry button on errors. |
| **Low** | Remove duplicated metrics (the "Clientes nuevos" KPI vs the panels; the checkbox vs the "Sin compras" KPI). |
| **Low** | Raise gray-400 text contrast, add an sr-only data table to the chart, standardize "Casa matriz" vs "Tienda" wording. |
| **Low** | Extract a shared `useDwhSection` hook for the three copy-pasted fetch effects. |

## Doc drift

`AGENTS.md` says the group/route filters scope "the whole tab". In practice Cobertura filters its already-fetched rows client-side, while the Pareto, trend and churn data are re-fetched with the filters.
