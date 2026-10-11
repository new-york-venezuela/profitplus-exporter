# Sales tabs refactor: route-based follow-up (Seguimiento)

Date: 2026-10-11
Status: design approved in chat, pending written-spec review
Builds on: `2026-10-11-customer-seller-segment-mapping-design.md` (PR #12)

## Problem

`10-2026-ventas-seguimiento-por-ruta.xlsx` is the business's working scorecard
for sales: weekly customer activation, monthly quota with projection, new
customers, and sales by category, per seller, route and customer. It is built
by hand from `2026-bbdd-profit.xlsx`. The Analítica dashboard has 14 tabs, several
of which overlap (Vendedores, Vendedor 360, Profundidad, Matriz
Vendedor-Producto, Cadencia), and the Vendedor 360 view is a dense table that is
hard to read. The DWH has no route, no visit frequency, and the customer group is
not used anywhere in the UI.

## Findings

Workbook (`Resumen Ventas - Rutas`, `Ventas Asesor - Categoria`, `TD`, `Plan de trabajo`):
- Scorecard per seller (6 sellers plus "Oficina"): activation by ISO week (weeks 40-44)
  against the customer master count; units and USD as plan, actual, % attainment and
  linear projection by working days; average price; new customers against a monthly goal.
- Detail per customer: seller, type ("Patrimonio"), group (12 values), route (3-22),
  neighborhood zone (45 of 173 blank), visit frequency (all "Semanal"), visit day (always
  blank), sales by category (Panadería, Pastelería, Pizza, Navidad) in units and USD.
- Routes are geographic and shared: most have one dominant seller plus stragglers
  (route 4: Gustavo 25, Edgar 3, Juan 1, Oficina 1). Only routes 11, 13, 14, 16, 19, 20,
  21 and 22 are single-seller.

ERP (`Ncake_a`):
- `saCliente.co_zon` -> `saZona`; `saCliente.frecu_vist` is a free `varchar(60)`, empty for
  all customers, with no constraint. There is no visit-day field.
- `saZona` has 16 rows: regional zones (001-009, `CCS`) and six `CCS-NN` "Ruta N" rows.
  Real foreign keys exist from `saCliente`, `saVendedor`, `saProveedor` (155 suppliers use
  `CCS`, `001`, `008`) and `par_emp`. Zones in use cannot be deleted.
- All 144 local customers are in zone `CCS`; no customer uses a route zone.

App:
- `seller_targets` (SQLite) already holds sales, weekly-visit and new-customer quotas.
  Vendedor 360 (`seller-profile.tsx`) already computes activation, recovered customers,
  returns and line depth, but presents them as tables.
- The legacy tables (`fact.Fact_Sales_Legacy`, `Fact_Returns_Legacy`, migration 0034) hold
  a fixed Jan 2025 - Feb 2026 snapshot from before the March 2026 cutover, with different
  customer ids. Histórico 2025 is the only reader.

## Decisions

| Topic | Decision |
|---|---|
| Route | A new `saZona` row per workbook route, codes `CCS-003`..`CCS-022` (suffix = workbook route number). Old zones are not reused or deleted. |
| Neighborhood zone | Dropped (26% blank, no ERP slot). May later be derived from `/mapa` sales areas. |
| Visit day | Dropped (blank everywhere). |
| Visit frequency | `saCliente.frecu_vist` holds an enum: `SEMANAL`, `QUINCENAL`, `MENSUAL` (extendable). |
| Customer attributes | Group = `saCliente.co_seg`; type = `tip_cli` (read only, pricing depends on it). `dim.Dim_CustomerMapping` and the `tipo_cliente`/`cliente_principal` CSV columns are removed from PR #12. |
| Seller x route | No table. A seller's routes are derived from their customers. Real world is 1-* (a route has one seller); a route with several sellers is reported, not silently accepted. |
| Coherence | `mapping:build` derives each route's owner (seller with most customers on it; a tie is a conflict left blank) and assigns the owner as `co_ven` to every customer on that route, recording each override in `source_note` and the conflicts file. `mapping:apply` refuses to run while any customer lacks a route or a seller, or its seller is not its route's owner. |
| Dashboard | New Seguimiento tab; merges and removals below. |
| Histórico 2025 | Kept; window limited to 2025 (`20250101..20251231`). Jan and Feb 2026 stay in the legacy tables but are no longer shown anywhere. |
| Cadencia | Removed, replaced by visit compliance. |
| Working days | Weekends only; holidays are not modelled. |

## Design

### A. Data layer (rework of PR #12)

- `migrations/mssql/0018`: `pApiInsertarZona` (create a route zone, idempotent) and
  `pApiActualizarRutaCliente` (sets `co_zon` and `frecu_vist`; rejects unknown zones and
  frequency values; stamps `co_us_mo`/`fe_us_mo`; same pApi conventions as `0009`/`0016`/`0017`).
  No raw UPDATEs. The existing seller procs are reused.
- Mapping CSV columns: `co_cli, nombre, co_ven, grupo, ruta, frecuencia, effective_from,
  source_note`. `ruta` and `frecuencia` come from the tracking workbook (customer matched
  by the existing code normaliser). `frecuencia` defaults to `SEMANAL` when blank.
- `mapping:build` also emits the route-owner table (route, owner, customer counts) next to
  the conflicts file, so the review is one place.
- `mapping:apply` plan gains route/frequency changes; rollback restores previous `co_zon`
  and `frecu_vist` (snapshot columns added to `mapping_apply_runs` via a new Drizzle
  migration). Created zones are not deleted on rollback, same as created segments.
- DWH: drop `dim.Dim_CustomerMapping` and `dim.vw_Customer_Classified` (0039 has run
  nowhere real; replaced by a new migration `0040` that adds `Dim_Customer.VisitFrequency`
  and `VisitIntervalDays` (7/15/30) via the SCD2 load, plus `dim.Dim_Zone` mirroring
  `saZona`). Segment names come from a mirror of `saSegmento`. `Dim_Customer` already
  carries `ZoneCode`/`SegmentCode`.
- `mapping:verify` gains the coherence report (see Decisions) and prints exceptions
  per customer.
- Overdue visits: a customer is overdue when days since its last invoice exceed
  `VisitIntervalDays`. Computed in queries, not stored.

### B. Seguimiento tab (new)

- Replaces the Vendedores tab and the Vendedor 360 table. The seller drill-down remains
  reachable from the new tab.
- Root toggle: Vendedor, Ruta, Grupo de cliente. Hierarchy: total -> root -> customer ->
  invoice lines (on click).
- Per row, visual: weekly activation strip (small bar per ISO week with % active), quota
  bar with a projection marker, average price, category-mix stacked bar (Panadería,
  Pastelería, Pizza, and any line added later), and a "new customers vs target" chip. The table form is one
  click away, not the default view.
- Definitions (mirroring the workbook):
  - Active in a week = at least one invoice that ISO week, against the seller's assigned
    customers (route owner's customers when the root is Ruta).
  - Projection = actual / (working days elapsed / working days in month), weekends only.
  - Quotas read from `seller_targets`; group/route roots use the sum of their sellers'
    quotas (a view, not a new store).
- New API route `app/api/dwh/seguimiento/route.ts`, gated on the `dwh` module, using
  `getDwhPool()` with `.input()` for user values; pure helpers (activation, projection,
  coherence, overdue) live in `lib/` and are unit-tested.
- Workbook "categoría" = `Dim_Product.LineName`, read dynamically (today Panaderia,
  Pasteleria, Pizza). Drill-down: line -> `SubLineName` (Artesanal / Industrial) -> product.
  `CategoryName` (Fresco / Congelado) is a filter/split, not a drill level. Navidad is
  not special-cased: the user will create it in Profit Plus, and it appears like any
  other line once it has sales. Product family ("Pan molde integral", "Baguette") is out
  of scope until the user defines its structure.

### C. Consolidation

- **Resumen**: kept; adds a month-pace strip (working days elapsed, % of month).
- **Ventas, Devoluciones**: kept.
- **Clientes**: group and route filters; visit-compliance column and an overdue list;
  the workbook's inactive-customer list (assigned customers with no invoice in the period).
- **Productos**: absorbs Profundidad de Línea and Matriz Vendedor-Producto. Line ->
  sub-line -> product drill (Fresco/Congelado filter), plus a product x customer-group share matrix (the workbook's
  `Hoja1`), replacing the duplicated "Cobertura por vendedor" panels.
- **Histórico 2025**: kept as is, window limited to 2025 in both the sales and returns
  queries and the tab label.
- **Removed**: Vendedores, Profundidad, Matriz Vendedor-Producto, Cadencia (including its
  gap-target editor and API). Old `?tab=` values fall back to the default tab.
- **Not touched**: CXC, Finanzas, Multimoneda, Compras (not sales).

## Delivery

One spec, three plans, each shippable alone: A (data layer), B (Seguimiento),
C (consolidation). B depends on A; C depends on A and partly on B.

## Testing

- Unit: route-owner derivation, coherence check, activation by week, projection,
  overdue logic, CSV round trip with the new columns.
- API route tests per new route, following the existing `__tests__` pattern.
- Component tests (React Testing Library on happy-dom) for Seguimiento and the
  extended tabs.
- DWH integration (disposable database): `VisitIntervalDays` in the SCD2 load, `Dim_Zone`.
- ERP-writing proc tests join the non-production-only group (`test:mapping-erp`).

## Risks and open items

- Reassigning stragglers to the route owner rewrites ERP invoice sellers from 2026-03-01,
  changing Profit's historical commission and sales reports (same as PR #12).
- Jan and Feb 2026 are visible nowhere after the Histórico window change.
- Removing tabs breaks saved links (fall back to the default tab).
- Routes 20-22 (La Guaira, Los Teques, Guatire-Guarenas) carry the `CCS` prefix although
  they are outside Caracas; renaming later is expensive, accepted.
- The 45 customers without a neighborhood no longer matter, but customers without a
  route in the workbook (1 row) and tied routes must be resolved by hand in the CSV.
- To verify while writing the plans: exact behaviour of each tab being merged or removed.
- Verified: product hierarchy in `Dim_Product` is Line -> SubLine -> Category (Fresco/Congelado);
  sellable lines are Panaderia (56), Pasteleria (5) and Pizza (4); no Navidad products exist.
