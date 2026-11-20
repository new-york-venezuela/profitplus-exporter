# Clientes tab redesign: design

Status: draft for approval. Date: 2026-11-20.
Companion: `docs/clientes-tab-ux-review.md` (the UX review this builds on).

## Intent and why

A director or commercial manager opens the Clientes tab to answer four questions quickly, without reading a wall of panels and a 14-column table:

1. How are sales changing per customer and per store, including chains rolled up to their casa matriz (e.g. Gama) and each individual store?
2. Which channel, client category, group or route drives the most revenue, momentum, retention or churn?
3. Which products (category, línea, sublínea, SKU) are lagging or cooling, at the chain, store, group or route in scope?
4. Is existing revenue holding (patrimonio), are new clients sticking, and which accounts, stores or SKUs recently churned or cooled so sales can act?

Today the tab holds most of the retention data (patrimonio/nuevos panels, churn table, Pareto, Cobertura) but with no hierarchy, no period-over-period trajectory, no channel breakdown, no product view, a silent mismatch of grains, and a monthly-only trend that ignores the app's date granularity.

## Goals

- Executive-first layout: sticky scope bar, KPI strip + main trend, four question sections, then collapsed operational detail.
- Every control states what it scopes. One place for period, comparison, currency, nivel (Casa matriz | Tienda), grupo and ruta, all synced to the URL.
- Sales growth answered by customer/chain/store, by channel/group/route and by product, drillable línea → sublínea → SKU, with the product view following the Clientes scope.
- Reuse the app's existing date range, granularity (`lib/granularity.ts`), returns-basis selector, chart grammar and Productos machinery.
- Respect the currency toggle everywhere, or label a locked currency.
- Missing data is "Sin datos" / "—", never 0 (the app-wide invariant).

## Non-goals

- No new fact tables or DWH migrations unless a phase proves it cannot be done from the existing dims/facts.
- No change to what Productos or Analítica histórica show.
- No redesign of Seguimiento, Resumen or other tabs.
- No new visual identity: keep the existing Tailwind gray/blue tokens (the UI/UX skill's generated palette, fonts and landing pattern are not adopted).
- No "casa matriz" model changes: the entity roll-up rule already in `Dim_Customer` / `LegalEntityKey` stays as is.

## Anti-goals (failure even if it technically works)

- A tab that is still a wall of equal-weight blocks.
- Two product-trend implementations that can disagree.
- A control that looks global but is local (the current "Nivel de análisis").
- A metric shown as `0` or green/red without a label when data is missing or the base is absent.
- Breaking the tab mid-migration: every phase ships on its own.

## Constraints

- Next.js 16 App Router, Bun, Tailwind. No new date library (`lib/dates.ts`). Recharts for charts.
- Auth/module gating stays on `'dwh'`, enforced in page and API independently.
- DWH queries use `.input()` for all user-controlled values. Never join ERP and DWH in SQL.
- Customers are attributed by the CURRENT `Dim_Customer` row. Consignment roots stay excluded where Seguimiento excludes them.
- Returns by devolución date by default, USD at the original factura's rate; the global `returnsBasis` applies only where it does today.
- Spanish UI copy; new naming standardised to "Casa matriz" / "Tienda" / "Código de cliente".
- Accessibility: text contrast ≥ 4.5:1, `aria-pressed`/`aria-sort`, buttons for sort headers, a visible data-table alternative for each chart, no color-only status.

## Approaches considered

- **A. Phased in-place refactor (chosen).** Rebuild `tab-clientes.tsx` section by section on the existing routes; add queries to existing routes as phases need them. Ships incrementally; cost is a transient mix of old and new blocks.
- **B. New tab beside the old one behind a flag.** Clean layout but two tabs to maintain, all-or-nothing delivery, duplicated registry and tests.
- **C. One new `/overview` endpoint.** One snapshot and round trip, but a heavy single query, one slow section blocks the tab, and it forks Productos logic.

Chosen: A, because it ships value early (phase 1 needs no SQL), keeps one source of truth with Productos, and never leaves the tab broken. Revisit C only for a section that proves too slow, and only for that section.

## Design

### Layout (top to bottom)

1. **Sticky scope bar.** Período (+ "vs período anterior"), granularity toggle (only allowed buckets), moneda, nivel (Casa matriz | Tienda), grupo, ruta, "Limpiar filtros" with active count. Each control carries a short scope note ("afecta: todo" / "afecta: solo tablas"). All state in the URL, defaults omitted, like `lib/productos-params.ts`.
2. **Q1: ¿Cómo evolucionan las ventas?** KPI strip of five cards (Ventas, Clientes activos, Patrimonio retenido, Nuevos que se quedan, Perdidos + enfriados), each with value, Δ vs comparison period and a window tag ("período" / "12m" / "histórico"). Below it the main trend and a "Ver por: Total | Producto | Grupo" breakdown with nivel línea ▸ sublínea ▸ SKU, click-to-drill, and a ranked table with a per-row customer accordion.
3. **Q2: Trayectoria por cliente / cadena.** Table of casa matriz rows expandable to their stores (Ventas, Δ%, unidades, pedidos, última compra, estado). The nivel toggle sets the starting level, not a second table.
4. **Q3: Grupo / ruta.** Rows ranked by Δ$ with a share-of-total bar; columns: ventas, Δ%, activos, nuevos vs patrimonio, abandono.
5. **Q4: Retención y fugas.** Patrimonio holding, new-client funnel, se enfriaron, perdidos, and "SKUs en caída" linking into Productos pre-filtered. Counts link to the detail table ("Ver en tabla").
6. **Detalle operativo (collapsed).** Cobertura (14 columns), Pareto and Perdidos, on one shared table component: sort buttons with `aria-sort`, search, sticky header and first column inside an `overflow-x-auto` wrapper, Excel export on each, stable row keys.

### Product breakdown follows the Clientes scope

The product trend and ranked table honour casa matriz / tienda / grupo / ruta. If "Gama" is selected, the product breakdown is Gama's products. Drill rules match Productos (`trendClickPatch`: línea → sublíneas → SKUs → `q=<code>`). Both directions work: customer → its products here, product → its customers via the Productos accordion. Both tabs call one shared hook and one shared chart/table component.

### Dates and charts

- Reuse the shared date-range picker, granularity toggle and returns-basis selector; URL carries `dateRange`, `granularity`, `returnsBasis`.
- `useClientesTrend` currently returns monthly only (`yearMonth`); it moves to the granularity rules in `lib/granularity.ts` (≤31 days: day/week/month; ≤366: week/month; longer: month). Weeks are ISO Monday–Sunday, labelled like Seguimiento ("Sem 12").
- Chart grammar: lines or stacked bars via the shared chart wrapper; rates as a dashed line on a titled secondary axis; direct end labels; a "Ver tabla" toggle with the values.
- "Activo" is per bucket, so weekly actives are fewer than monthly; the bucket is labelled on the axis and KPI cards keep the period total.
- Comparison period uses `buildPrevPeriodDateWhereClause`.

### UX rules applied everywhere

- Δ is always paired with an arrow and sign; no prior period shows muted "sin base", never 0.
- One segmented-control component (`aria-pressed`), one table component, one button style set.
- Loading keeps previous data dimmed instead of replacing it; errors have a retry button.
- Currency toggle applies to all monetary columns (including USD/mes), or the header says which currency is fixed.

## Phases

| Phase | Scope | Backend |
|---|---|---|
| 1 | Sticky scope bar, URL state, shared table/toggle components, currency fix, reordered layout using existing data, trend moved onto granularity | None |
| 2 | KPI strip with Δ; chain → store trajectory table; product/SKU trend block following scope | New `section` on `/api/dwh/clientes` (per entity and store, current vs previous period); `grupo` and `ruta` filters on `/api/dwh/productos` |
| 3 | Grupo / ruta breakdown | New `section` by `Dim_Segment` and route |
| 4 | "SKUs en caída" in Q4 linking to Productos | Reuses `prevNet` / `trendPct` |

Each phase is independently shippable and gets its own implementation plan.

## Decided with the user

- Product breakdown follows the Clientes scope.
- Approach A (phased in-place refactor).
- Sales growth is answered by product and drillable to SKU like Productos.
- Date selectors, granularity and chart grammar stay consistent with the other tabs.

## Calls made by Claude (not yet confirmed)

- Five KPI cards as listed.
- Phase order above (layout first, then trajectory and product, then channel, then SKU list).
- Keep existing Tailwind gray/blue tokens rather than the skill's generated palette.
- Cobertura's 14 columns stay but move under "Detalle operativo", collapsed by default.

## Calls settled after builder review (Claude's, please check)

- **KPI definitions.** One shared definition per metric, reused by the KPI cards, the trajectory table and the detail tables. Patrimonio retenido, Nuevos que se quedan and Perdidos + enfriados reuse `lib/kind-kpis.ts` unchanged. Customer cards exclude consignment roots (as Seguimiento and the existing Clientes cards do); sales cards include consignment (as Resumen's Ventas cards do) and each card states its basis. Window tags: "período" = the selected range, "12m" = rolling 12 months ending at the range end, "histórico" = all-time.
- **Active per bucket.** Weekly/daily "activos" are computed per bucket and labelled; KPI cards keep the period total. The current month is measured through yesterday, as in Seguimiento.
- **Own-dimension filters.** A breakdown section ignores its own dimension's filter (Q3 by grupo ignores the grupo filter, Q3 by ruta ignores the ruta filter) and highlights the selected row, so it never collapses to one row.
- **Chain Δ%.** The chain row shows total Δ% (current membership, per the current-row attribution rule) and a separate "tiendas nuevas" count, so growth from adding a store is visible and not mistaken for like-for-like growth.
- **"Estado" column.** Reuses the existing constancia states (constante, irregular, perdido, en observación, sin frecuencia) and the Cobertura status badge.
- **Breakdown series cap.** "Ver por" series reuse the Productos rule: top 10 by the active metric + "Otras".
- **Productos.** Phase 2 adds `grupo`/`ruta` to the `/api/dwh/productos` API only. Productos' own UI is unchanged; regression tests on existing Productos routes must stay green. Shared hook/chart extraction must keep Productos' tests passing unchanged.
- **Currency.** Phase 1 labels USD/mes as fixed USD (no backend change). Making it follow the toggle is deferred to phase 2 with the other query changes.
- **Export and "Ver en tabla".** Export covers the filtered rows. "Ver en tabla" sets URL filter params and scrolls to the table.

## Customer taxonomy: two axes (agreed with the user)

Replaces today's overlapping "nuevo / se enfriaron / perdidos / perdido (constancia) / sin ventas 30+ días" wording with one model. Every number links to the customers behind it, each list row shows its Estado and the date that caused it, and a "¿Cómo se define?" popover states the rules.

**Axis 1: Origen** (fixed per customer, relative to the year Y the selected range ends in; uses `customerKindInYear` and `MIGRATION_CUTOVER_DATE = 2026-03-28`, never stored):
- **Patrimonio**: registered before Jan 1 of Y, or in the migration batch (registered on 2026-03-28).
- **Nuevo**: registered during Y, not in the migration batch.
- **Posterior**: registered after Y (only when viewing past years); hidden or shown as "Posterior".
- The tab shows "Año de referencia: Y" beside the Origen control, since a customer registered in 2026 is Nuevo in 2026 and Patrimonio in 2027.

**Axis 2: Estado en el período** (mutually exclusive per customer, against the selected period P and the previous equal period P-1):

| Estado | Rule |
|---|---|
| Nuevo en el período | First invoice ever falls in P |
| Retenido | Bought in P and in P-1 |
| Recuperado | Bought in P, not in P-1, had earlier purchases |
| Enfriado | Bought in P-1, not in P |
| Perdido | Enfriado and still silent past its limit: 3 visit windows, or 2 whole periods if it has no visit frequency |
| Sin ventas aún | Registered, never invoiced |

"Nuevo" is the Origen tag; "Nuevo en el período" is the Estado. A customer registered this year who first buys in P is both. Origen splits every Estado count.

**Q4 layout:** a customer bridge (base anterior − enfriados − perdidos + nuevos + recuperados = base actual) and a matching sales bridge, both reconciling with the KPI strip (Perdidos + enfriados in the strip equals the Q4 rows). Below it, Estado rows with Patrimonio / Nuevo / Total, sales and Δ, and an actionable list (customer or store, seller, last purchase, lost sales, Estado). This replaces the separate patrimonio panel, new-customer funnel and "Perdidos" table. Per-customer Estado needs one query in phase 2.

## Canal = grupo (agreed with the user)

"Canal" and "grupo" are the same dimension: `Dim_Segment.SegmentName` of the customer's current `ErpSegmentCode`. The UI uses one word, **Grupo**, everywhere (scope bar filter, Q3 section, "Ver por: Grupo"). Route stays a separate dimension. No new derived dimension is needed.

## Open for the builder

- Exact SQL for the per-entity/store previous-period comparison and the channel breakdown (use existing `Dim_Segment`, `Dim_Customer`, `Fact_Sales`/`Fact_Returns`; no new tables unless proven necessary).
- Component names and file layout under `components/clientes/`.
- Whether the shared product trend hook lives in `lib/productos/` or `app/(app)/analitica/lib/`.
- Test plan per phase (component tests per `test/dom-setup`, route tests for new sections).
- Docs to update after each phase: `AGENTS.md` (Clientes section, directory map) and `content/help/` if a Clientes help page exists.

## Addendum (2026-11-20): product view replaced by per-customer evolution

The "Ver por: Producto" breakdown (product trend + ranked master table + customer accordion) duplicated Productos and split the product view away from the customer table. It is removed. Instead every row of the Q2 trajectory table (casa matriz, one-store chain, store) opens an **Evolución** panel: that customer's product evolution, toggling Línea | SKU, Líneas | Barras and Ventas | Unidades, with a table alternative. It reuses `/api/dwh/productos?section=porLineaMes` scoped with `tienda=<filterKey>`, so no backend change. The product-drill URL keys (`nivel`, `lineas`, `sublineas`, `q`) are no longer managed by the Clientes tab. "SKUs en caída" stays in Q4.

