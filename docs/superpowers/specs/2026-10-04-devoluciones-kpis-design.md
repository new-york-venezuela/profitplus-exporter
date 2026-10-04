# Devoluciones: headline KPI boxes

Sub-project 4 of 5. Reuses `KpiCard`/`KpiGroup` from sub-project 2 (build after it).

## Goal

On entering Devoluciones the user sees numbers first (grouped KPI boxes like Resumen/Ventas), then the existing
tables. The choice of metrics was delegated to us: pick the ones that answer "how much, how bad, where".

## KPI set (two groups)

**Magnitud (red)**
- **Devoluciones netas**: `SUM(Fact_Returns.NetAmount)` in USD/Bs, same returns definition as Resumen.
- **Tasa de devolución**: devoluciones ÷ ventas brutas, with returns windowed by the **original invoice date**
  (`buildReturnsDateWhereClause(..., 'factura')`) per the Ventas netas convention in AGENTS.md, so the rate is
  comparable with Resumen/Vendedores.
- **Unidades devueltas**: `SUM(QuantityReturned)`, plus the units-returned ÷ units-sold rate as the subtitle.
- **Notas de crédito**: `COUNT(DISTINCT CreditNoteNumber)`.

**Dónde pasa (amber)**
- **Producto más devuelto**: name + amount (top by net returns).
- **Cliente (entidad) con más devoluciones**: name + amount.
- **Vendedor con mayor tasa de devolución**: name + rate (only sellers with ventas brutas above a minimum, a
  named constant, so a 1-invoice seller at 100% doesn't win).
- **Ticket promedio de devolución**: devoluciones netas ÷ notas de crédito.

Eight boxes; "top X" boxes show `Sin datos` when there are no returns in the range. No new tables or views in
the DWH: everything comes from `fact.Fact_Returns` (+ dims) and `fact.Fact_Sales` for the rate denominator.

## Basis note

Two time bases exist (devolución date vs. original invoice date). The rate and the sales denominators use the
**factura** basis; the amount, units and counts boxes use the **devolución** date, labelled in each box's
tooltip (`title`) as the existing Resumen KPIs do. Both are listed in `content/help/analitica-definiciones.md`.

## API / UI

- Add `groupBy=kpis` (or a `kpis` object on the default response) to `app/api/dwh/devoluciones/route.ts`
  returning `{ returnsNet: DualAmount, returnRate, unitsReturned, unitsReturnRate, creditNotes, avgCreditNote,
  topProduct, topCustomer, topSeller }`. `hasDwhAccess` gating, `.input()` for dates, `{ error }` shape.
- `tab-devoluciones.tsx`: new fetch (with loading/error state like the other panels) rendered above the existing
  panels in two `KpiGroup`s. Existing tables untouched.

## Testing

- Route integration test with seeded returns: totals, rate (factura basis), min-sales threshold for top seller,
  empty range gives `Sin datos`/nulls without NaN.
- Component test for the empty and populated states.
