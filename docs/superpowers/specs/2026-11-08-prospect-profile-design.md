# Prospect profile (Analítica sub-tab) — design

## Intent and why

When a new prospect appears (a store that is not yet a customer), the owner wants to say
"customers like this sell about N units a week, made up of these products, and earn about $X a week
on our price point." Today this is done by hand: look at nearby stores, weekly volume, product mix,
and guess a margin from the store type. The owner's pricing is high, so area (income level)
matters a lot: big stores in wealthy areas give many facings and sell 100+ units a week.

The tool answers: given a prospect's store type and area, what do comparable existing customers
sell, and what would the prospect earn?

## Decisions (the owner's)

- **Lives in Analítica as a new sub-tab** next to Clientes ("Perfil de prospecto"). Gated on the
  existing `'dwh'` module like every Analítica tab (page and API both check).
- **Layout A**: inputs on top, then one headline answer (expected values with a range), then
  typical product mix, then the closest peers listed underneath.
- **Inputs on the prospect screen** (nothing stored per customer, nothing new in SQLite):
  1. **Store type** = the customer group (`Dim_Segment.SegmentName` of the current `ErpSegmentCode`),
     e.g. Supermercado, Bodegón, Farmacia, Abasto.
  2. **Area** = a route (`Dim_Customer.ZoneCode`, zones with `IsRoute = 1`). The user either picks a
     route from a list or drops a pin on the map and the app proposes the nearest route.
  3. **Margin** = one percentage typed per evaluation, not saved. Applies to the prospect only.
- **Outputs**: expected weekly units (with a range), typical product mix, expected weekly benefit
  for the store, and the closest peers (name, route, type, weekly units, benefit).
- **KISS**: no per-customer facings or margin entry. **Benefit per m² of shelf is out of the first
  version** (facings only exist in WhatsApp photos from drivers). It can come later if facings are
  ever entered.
- The owner will fix customers that have no route (today 25 sit in the generic `CCS` "Caracas" zone,
  which are probably the chains/largest accounts). The tool must not depend on that being done, but
  should tell the user how many customers were left out for lack of a route.

## Goals

- A quick, believable answer to "what would a customer like this do for us / for them".
- Comparable peers visible so the owner can sanity-check the headline.

## Non-goals / anti-goals

- Not a forecast or a scoring model; no machine learning. A wrong-looking number the owner cannot
  trace back to named peers is a failure even if the maths is right.
- Does not write anything to the ERP, DWH or SQLite.
- No facing/shelf-space modelling, no per-customer margin storage.
- Does not claim precision it lacks: with ~9 customers per route, small peer sets must be shown as
  small (peer count visible, range shown, a clear note when fewer than a handful of peers).

## Data available (verified read-only on the local copy, 2026-11-08; counts are not production facts)

- ~194 active customers in `dim.Dim_Customer` (current rows); 163 of 193 ERP customers have
  coordinates in `saCliente.campo1` (parse via `lib/geo/coordinates.ts`).
- Customer groups: Supermercado ~90, Farmacia 22, Abasto 15, Independientes 13, Restaurante 11,
  Bodegón 10, Cadena 8, Panadería 8, Hipermercado 5, others small.
- ~20 routes (`CCSnnn`), 2–27 customers each; average weekly units per customer differ a lot by route
  (≈3 on Ruta 8, ≈38 on Ruta 7, ≈47 on Ruta 14), so route carries real signal.
- Weekly units per customer are heavy-tailed (average ≈20, max ≈633, Cadena max). Sales data starts
  2026-03-16. Customers buy ~5 distinct products on average.
- `fact.Fact_Sales` has `QuantitySold`, `NetAmount`, `UnitCost`, `COGSAmount`; `dim.Dim_Product` has
  `LineName` (Panadería/Pastelería/Pizza are the sellable lines; ignore Materia Prima, Empaque, etc.).
- `ciudad` is "Caracas" for nearly everyone, so it is useless as an area. Sales-area polygons exist
  in SQLite but only one test area exists; routes are the usable area.

## Constraints

- Follow AGENTS.md: DWH reads only through `getDwhPool()` with `.input()` for user values; no ERP
  tables from `app/api/dwh/*`; consignment roots excluded the same way as Seguimiento
  (`app/api/dwh/lib/consignment.ts`); returns counted by devolución date; amounts in USD never raw
  BSD, and missing data is `null`/"Sin datos", never 0.
- Reuse the existing tab registry (`app/(app)/analitica/lib/tab-keys.ts`), the date-range pattern
  and the map/pin components from `/mapa` where they fit; use `SearchableSelect` for any long list.
- Pure logic (peer selection, aggregation, nearest route, benefit maths) in `lib/` with unit tests,
  matching the existing `lib/seguimiento` / `lib/clientes` style.

## Left to the builder (flagged as my calls so the owner can review them)

These are my defaults; none was discussed with the owner:

- **Peer definition**: same store type first; within it rank by route match, then by distance from
  the pin if one was dropped. Fall back to neighbouring routes or the whole type when a route has
  too few peers, and say so on screen.
- **Time window**: weekly figures are averaged over the last ~12 complete weeks (not since launch),
  counting a customer only from its first invoice week, so new customers are not diluted by empty weeks.
- **Headline = median, range = interquartile**, because volume is heavy-tailed; the mean would be
  dragged by chains.
- **Benefit for the store** = the store's profit on our product at its margin: for each unit, our
  selling price (USD, ex-IVA, `NetAmount`/units at the invoice's own rate) is the store's cost; with
  margin `m` as a share of the store's shelf price, the store earns `price × m / (1 − m)` per unit.
  Weekly benefit = sum over the peer product mix at median volume. **Confirmed by the owner**: margin is a share of the store's shelf price (30% = their benefit is 30% of their selling price).
- **Excluded from peers**: consignment roots, customers with no sales in the window, customers with
  no route (reported as a count).
- Product mix is by units, grouped by product (not line), top ~8 with an "otros" remainder.
- Pin → route: nearest located routed customers by great-circle distance; propose the route of the
  nearest few (majority), always overridable by the user.

## Calls made after the builder check (mine, to be reviewed by the owner)

- **Pin vs route**: the route is the area input. A pin only proposes a route and, if kept, orders peers
  within the same tier by distance (peers without coordinates rank last). Overriding the route keeps the pin.
- **Minimum peers**: 5. Fallback chain when fewer: same type in the 2 nearest routes (by centroid of located
  customers; routes with no located customers have no centroid and are skipped), then same type everywhere.
  The screen always states which tier was used and the peer count.
- **Consignment** is excluded from peers, product mix and every total, by customer code, as in Seguimiento.
- **Window**: fixed last 12 complete weeks, ending last Sunday; the global Analítica date range does not apply.
- **Gaps**: weekly units = total units / weeks since the customer's first invoice in the window (idle weeks count
  as zero), so irregular buyers are not overstated.
- **Small types (Cadena, Hipermercado, …)**: not disabled; they just trigger the low-peer note.
- **Benefit is the store's only** (not our own gross profit): the owner did not ask for ours and wanted KISS. Easy to add later.
- **Price per product (owner's refinement, approved)**: benefit is computed product by product. For each product, the peers' units and
  `NetAmount` in USD give the realized average cost to the store (`NetAmount` / units, volume-weighted, so each peer's price list is
  already reflected). Shelf price = cost / (1 − m); weekly benefit = Σ over products of (median-volume units × (shelf − cost)).
  Example: 10 units/week at cost 3.92 with m = 30% → shelf 5.60 → 10 × 5.60 − 10 × 3.92 = 16.80/week.
  A single all-units average price is not used.
