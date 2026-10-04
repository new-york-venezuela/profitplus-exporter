# Resumen: grouped KPIs, units sold, pendiente por cobrar; units per seller

Sub-project 2 of 5 (see `2026-10-04-clientes-cobertura-design.md`). Build this before Ventas/Devoluciones:
it introduces the shared grouped-KPI component they reuse.

## Goal

Refactor the KPI boxes at the top of Resumen into visually grouped sections (borders + colour per theme),
add **Unidades vendidas** and **Pendiente por cobrar**, and add **Unidades** to "Desempeño por vendedor".

## Decisions

- **Unidades vendidas** = `SUM(Fact_Sales.QuantitySold)` over the selected range, same definition as the Ventas
  tab KPI (`unitsSold`, "unidades facturadas, antes de devoluciones", voided invoices excluded, same filters
  as `salesGross`). Not currency dependent.
- **Pendiente por cobrar** = total outstanding AR (`SUM(OutstandingBalance)`, `IsCreditNote = 0`, USD via
  `usdConversionJoin`) at the **nearest snapshot on or before the last day of the selected range**. The box
  subtitle shows that snapshot's real date ("al 2026-09-28"). No snapshot on/before the end gives "Sin datos".
  The route already resolves `MAX(SnapshotDateKey)` for the AR section; change the resolution to
  `MAX(SnapshotDateKey) WHERE SnapshotDateKey <= @rangeEndKey` (`.input()`). Note the existing aging /
  concentration cards in Resumen should use the same resolved snapshot so the page is internally consistent.
- **Per-seller units** = `SUM(QuantitySold)` per `SalesRepKey` over the range, same invoice scope as that table's
  existing "Ventas brutas" (includes consignment), added as a column "Unidades" after "Ventas netas".

## KPI groups (shared component)

New `components/kpi-group.tsx`: `KpiGroup({ title, tone, children })` renders a bordered, tinted panel with a
small uppercase title and a responsive grid of the existing `KpiCard`s. Move `KpiCard` out of
`tab-resumen.tsx` into `components/kpi-card.tsx` (Ventas and CxC define their own copies today; consolidating
them is in scope only for the files this sub-project touches, i.e. Resumen). Tones are a closed set
(`sales` blue, `collections` amber, `customers` green, `returns` red) as Tailwind class maps, with text
labels so colour is never the only signal.

| Group | Boxes |
|-------|-------|
| Ventas (blue) | Ventas brutas, Ventas netas, Unidades vendidas |
| Devoluciones (red) | Devoluciones (and its rate if already present) |
| CxC (amber) | Cobrado, Pendiente por cobrar, Tasa de cobranza / existing collection KPIs |
| Clientes (green) | Clientes activos / existing customer KPIs |

The exact existing KPIs (`tab-resumen.tsx` lines ~182-200) are each assigned to exactly one group; none are
dropped or redefined.

## API / types

- `app/api/dwh/resumen/route.ts`: add `unitsSold` and `receivable: { balance: DualAmount | null; snapshotDateKey:
  number | null }` to `kpis`; add `units` to each `SalesRepRow`. Update `types.ts`.
- Gating (`hasDwhAccess`) and error shape unchanged.

## Testing

- Route unit/integration test: units equal the Ventas tab figure for the same range; receivable picks the
  latest snapshot <= range end, and returns null with no earlier snapshot.
- Component test for `KpiGroup` rendering (title, tone class, children).
- Document both definitions in `content/help/analitica-definiciones.md`.
