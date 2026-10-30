# Analítica: Resumen and Seguimiento redesign

Source: two hand-drawn sketches from the business (Resumen, Seguimiento) plus the
mockups reviewed and approved in the brainstorm session of 2026-10-29
(`.superpowers/brainstorm/6368-1793298078/content/resumen-v5-clientes.html`,
`seguimiento-v2.html`; wireframes with fake numbers).

## Intent

- **Resumen** is a quick, accurate overview of the whole business. Someone opening
  it should understand what is happening in sales, returns, customers and
  receivables without drilling into other tabs.
- **Seguimiento** is for the supervisor or sales manager (Gerente de ventas), who
  must see when a seller is underperforming in one or several KPIs.

## Goals

### Resumen (top to bottom)

1. **Ventas strip**: three cards, Ventas brutas | Devoluciones | Neto. Each shows
   USD (sin IVA), unidades, clientes/tiendas and precio promedio (USD / unidad;
   author's reading of the sketch note "Precio promedio – cliente"). Devoluciones
   also shows its rate (devoluciones / brutas) next to the USD figure.
2. **Clientes**: three cards, Total, Activos, Nuevos.
   - Total: customers in the master. (Author's guess.)
   - Activos: customers with at least one invoice in the period, plus % of total.
     (Author's guess.)
   - Nuevos: customers registered in the period (`RegisteredDate`). (Author's guess.)
3. **Cuentas por cobrar**: four cards, Saldo inicial, + Facturación, − Cobros,
   = Pendiente. (Author's reading of the sketch: the "Total" row is saldo inicial +
   facturación; Pendiente is what remains after cobros.)
4. **Chart, full page width**: stacked bars where netas + devoluciones = brutas
   (netas solid, devoluciones hatched), plus a line for the devolución rate on a
   secondary right-hand % axis. Hover shows brutas, neta, devoluciones USD and rate.
   This replaces the current "Gráficos de brutas".

Removed from Resumen: the Clientes box (maestro / activos / %) of the sketch,
antigüedad de saldos, and mayor concentración de créditos. The existing month-pace
strip is **removed from Resumen** (decided by the user); it stays only on Seguimiento.

### Seguimiento

The new Seguimiento **replaces** the current tab but keeps these elements of it, as
they work today: seller profiles, a seller's customer list, each customer's invoices,
and the customers' weekly activation (per customer, which ISO weeks have an invoice,
e.g. invoice in week 42, week 43, ...). Less is more: anything else in the old tab
(scorecard extras, cards) that is not listed in this document or above may be dropped.

**Brutas, devoluciones and netas are all KPIs** the user wants to see, each in USD and
units. Goals and attainment are measured against **brutas**. Data runs through the **previous day**, not today. (The mockups
show only netas in places; they are wireframes. The built tab shows all three.)

1. **Cuadrícula** (author's reading of "cuadrícula o algo similar"): one row per
   seller, one column per KPI (ventas USD, unidades, clientes activos, clientes
   nuevos, precio promedio, proyección USD). Cells are coloured green / yellow / red
   against goal or pace. The route number is shown next to the seller (the sketch
   asks for "zona en # de ruta"). **Units are shown as absolute numbers
   (sold / goal), not percentages.** Clicking a seller opens that seller's detail.
2. **Real block** (per selected seller), weekly columns Sem 1..5 + Total: clientes
   asignados, clientes activos, % activos, unidades netas, USD netos, precio promedio.
   The current week is partial and stops yesterday.
3. **Estimado block**: projection in units and USD against goal.
4. **Categorías**: netas by product / category and projection per category.
5. **Clientes nuevos**: the seller's new customers with their net sales.
6. **Month-to-month chart at the end**: USD netos as bars, unidades netas as a line
   on a right-hand axis; follows the selected seller (Total if none); current month
   marked partial; hover shows both values and the change vs the previous month.

## Non-goals

- No change to the data warehouse schema is assumed; if a figure cannot be had from
  existing `dim`/`fact` tables, flag it rather than inventing a source.
- No new auth modules; both tabs stay gated on `'dwh'`.
- No goals for route or group roots (unchanged from today's Seguimiento).

## Anti-goals

- Showing `null`/missing data as 0 (same invariant as the recipe and statement
  modules: "Sin datos", never `$0`).
- Measuring goals against netas on Seguimiento. Goals and attainment are brutas;
  devoluciones are shown beside them, not subtracted from attainment.
- Percentages for units in the grid.
- Extra elements nobody asked for ("less is more").

## Constraints

- Follow `AGENTS.md`: DWH queries through `getDwhPool()` with `.input()`, customers
  attributed by the CURRENT `Dim_Customer` row, ventas netas = brutas − devoluciones
  with returns windowed by `OriginalInvoiceDateKey`, no date library (use
  `lib/dates.ts`), `SearchableSelect` for long pickers, PostHog events as elsewhere.
- Pure logic in `lib/` with unit tests; components tested with React Testing Library
  per the repo's conventions.
- Sellers see the same numbers as today's Seguimiento root for the same month
  (consignment handling unchanged).

## Decisions made by the author (not agreed in conversation)

- Month-to-month chart window: **last 12 months ending in the reference month**,
  not tied to the tab's date-range filter. (Author's call; the user was asked and
  approved the mockup without answering.)
- Chart granularity on Resumen: follows the tab's selected date range; bars by month
  for long ranges, by day or week for short ones, builder to pick thresholds.
- Colour thresholds for the cuadrícula: green >= pace/goal, yellow within 15% below,
  red further below. Builder may refine from the existing `seller-verdict.ts` rules.

## Further calls by the author (from the builder check; not agreed in conversation)

- Net units are buildable: `fact.Fact_Returns` has `ProductKey` and `QuantityReturned`
  (migration 0010). Return quantity/USD is attributed to the original invoice date
  (`OriginalInvoiceDateKey`), converted at the factura's rate, so net + returns = brutas
  in every bucket, including the Resumen chart.
- Seguimiento figures stay brutas, so they match today's Seguimiento for the same
  month (same attribution and consignment handling); devoluciones are added beside them.
- **Route and group views adopt the same UX as the seller level** (decided by the
  user): a weekly matrix of metrics, a dropdown listing customers, the weekly
  activation grid, and each customer's invoices. Route/group roots still carry no
  goals, as today.
- **Accessible colours**: the grid's green/yellow/red must meet WCAG AA contrast
  (text and cell background), and status must never rely on colour alone (add an
  icon or text/arrow). Applies to light and dark themes.
- Cuentas por cobrar on Resumen: the user decided **pendiente is the real balance**:
  every open invoice counts, ignoring how saldo inicial, facturación and cobros add up.
  Facturación may be with or without IVA; builder picks the simplest consistent basis
  and labels it. The cards are shown as in the mockup; no reconciliation or gap line.
- Resumen Clientes cards: Total = `IsCurrent = 1` customers, Activos = invoiced in the
  period, Nuevos = `RegisteredDate` in the period. Consignment-root customers excluded,
  as in Seguimiento. Group/route filters apply where the tab has them.
- "Clientes / tiendas" on each Ventas card = distinct customers with that card's
  activity (brutas: invoiced; devoluciones: with a return; neto: with net sales > 0).
- Weeks Sem 1..5: ISO weeks via `iso-weeks.ts`, clipped to the reference month.
- Cut-off: Seguimiento runs through yesterday; Resumen keeps its current cut-off.
  On day 1 of a month Seguimiento shows the new month with nothing elapsed
  (existing `resolveReferenceMonth` behaviour, pinned by `reference-month.test.ts`).
- Grid cells with no goal (activos, precio promedio) are uncoloured; a seller with no
  goal for a coloured KPI shows grey, never red.

## Open items

None. (The cut-off last line of the Resumen sketch was dropped by the user.)

## Left to the builder

- How to reuse or retire the existing Seguimiento KPI cards, seller
  profile scorecard and `seller-verdict.ts`; keep what serves the goals above.
- Exact queries, component structure, responsive behaviour, print layout.
- Whether the weekly "Real" table and the grid share one data fetch.
