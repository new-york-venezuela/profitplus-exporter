# Clientes tab: nuevos vs patrimonio — design

Date: 2026-10-15. Status: design approved by the user in chat (scope: Clientes tab only).

## Goal
Better visibility and KPIs for new vs patrimonio customers in "Cobertura de clientes": compare the two groups, show whether
patrimonio is holding, show whether new customers stick, and make the kind a first-class switch/filter.

## Definitions
- **Kind** (unchanged, `lib/dwh/cutover.ts`): patrimonio = registered before Jan 1 of the range's year or in the 2026-03-28 batch;
  nuevo = registered in that year otherwise. No registration date = no kind (only under "Todos").
- **Active in the period** (unchanged): >= 1 non-voided invoice in the range; registered after the range end = not applicable.
- **Previous period**: same-length window immediately before the range, the exact rule of the Ventas KPI row
  (`buildPrevPeriodDateWhereClause`, moved to `query-builder.ts` and shared). A past closed YTD year has none: comparisons hide.
- **Constancia ("sticking")**, by visit frequency N (7/15/30 days): the last 3 windows of N days ending today; window i holds the
  invoices whose age in days d satisfies i*N <= d < (i+1)*N. A window is met with >= 1 invoice.
  - `constante`: 3 of 3 met; `irregular`: 1-2 met; `perdido`: 0 met.
  - `observacion`: registered less than 3N days ago (too early to judge). `sin_frecuencia`: no visit frequency.

## Layout (CoberturaClientes)
1. Switch `Todos | Patrimonio | Nuevos` with counts; scopes the existing KPIs, the table and the holding/funnel panels.
2. Panel "Nuevos vs Patrimonio" (always both columns, ignores the switch): customers, % activos en el período, ventas del período,
   ventas por cliente activo, visitas vencidas, sin ventas 30+ días, and the constancia split (% constantes).
3. Panel "¿Se mantiene el patrimonio?": active % and sales vs the previous period (delta), "Se enfriaron" (bought in the previous
   period, not in this one) with a button that filters the table to them.
4. Panel "¿Se quedan los nuevos?": funnel Registrados -> Compraron alguna vez -> Constantes, with the rest split into Irregulares,
   Perdidos, En observación and Sin frecuencia; median days from registration to first purchase.
5. Table: Tipo badge (colour consistent with the switch), columns Registro, Ventas del período, Constancia (badge), Días a 1ª compra
   (new customers); xlsx export gets the same columns.

## Data / API
`GET /api/dwh/clientes/cobertura` rows gain: `registeredDate`, `firstSaleDateKey`, `daysToFirstSale`, `salesPeriod` (Bs/USD),
`salesPrev` (null when no previous window), `boughtPrev`, `stickiness`. Response gains `prevPeriodAvailable`. Queries: first sale
(MIN DateKey) in OwnSales, period/previous-period sales sums in PeriodSales, and one extra query with each customer's distinct invoice
days of the last 90 days (3 x the longest interval). All classification/summary maths live in `lib/clientes/kind-kpis.ts` (pure).

## Testing
Unit: stickiness windows (boundaries at N-1/N days, observacion, sin_frecuencia), summaries (denominators, deltas, funnel, median),
prev-period helper unchanged behaviour (ventas tests keep passing). Route: new fields, hidden comparison when no previous window.
Component: switch scoping, panels, "Se enfriaron" filter, badges.
