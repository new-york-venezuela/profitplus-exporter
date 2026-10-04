# Ventas: units trend, Entidad → tiendas → productos table, units per line

Sub-project 3 of 5. Depends on the shared `KpiGroup`/`KpiCard` from sub-project 2 only if the Ventas KPI
row is regrouped (optional here; not required).

## Goal

1. "Tendencia de ventas" shows **units** by default, with a Unidades / Dinero toggle (money is already in Resumen).
2. "Ventas por cliente" is always grouped by **Entidad**; every Entidad can be expanded to its **tiendas**
   (if it has any), and each tienda expanded to its **productos**. No more "Agrupar por" / "Desglosar por" selects.
3. "Ventas por línea" gets a **Unidades** column.

## 1. Trend: units / money toggle

- The trend response (`groupBy=mes` in `app/api/dwh/ventas/route.ts`) gains `units` per bucket
  (`SUM(QuantitySold)`), alongside the existing gross/net amounts. Granularity rules are unchanged.
- UI: a two-option segmented control "Unidades | Dinero" in the ChartCard header, **default Unidades**.
  Unidades: bars = units sold per bucket; the net-of-returns line is hidden in this mode (returns units are
  a different measure; keep the chart honest rather than mixing units with money). Dinero: current chart.
- The click-a-bar drill (customers of that period) keeps working in both modes. Subtitle and axis label follow
  the mode. The choice persists in `localStorage` (try/catch) as a per-viewer convenience.

## 2. Ventas por cliente: Entidad table with expandable tiendas and productos

- Replace the `GroupedDrilldownTable` group-by selector usage in `tab-ventas.tsx` (the `clienteDimension` state,
  `CLIENTE_GROUP_BY_OPTIONS`, `BREAKDOWN_BY_OPTIONS`) with a fixed tree: **Entidad** (`cliente_entidad`)
  → **Tienda** (`cliente_tienda`) → **Producto**.
- Each Entidad row has an expand button ("Ver tiendas") shown **always**; for an Entidad with a single
  store/no matrix link it expands to that one store (so the interaction is uniform). Expanding a tienda
  shows its products. Children are lazy-fetched on first expand (existing `handleFetchBreakdown` pattern),
  cached per parent, with loading and error states per row.
- Child rows use **exactly the same columns and units** as the top-level table (ventas brutas, devoluciones,
  ventas netas, unidades, etc. in the current currency), so numbers sum visibly: tiendas sum to the Entidad;
  products sum to the tienda. Reconciliation is part of the API tests.
- API: extend `groupBy=cliente` handling so the breakdown request accepts parent kind: Entidad → returns tiendas
  (children keyed by `CustomerCode`, current SCD2 version only, volume aggregated across versions of the code,
  consistent with the Clientes cobertura rules); Tienda → returns products. Add `units` to every row in these
  responses. All user-controlled values via `.input()`; keep the DWH-only rule.
- `GroupedDrilldownTable` is shared with other tabs (Vendedores, Devoluciones). Do **not** break them: add an
  opt-in `fixedLevels` mode (or a small new `EntidadTreeTable`) rather than editing the generic component's
  default behaviour. Prefer the new component if the generic one needs more than a few lines of change.
- Sort and the Pareto/other existing table features stay as they are at the Entidad level; children keep the
  parent's order by ventas brutas descending.

## 3. Ventas por línea: units column

- `groupBy=linea` rows and its product breakdown rows gain `units`; add a "Unidades" column after the sales
  column in the lineas table (`LINEA_*` options remain; this table keeps its line → producto breakdown).

## Types / API summary

`VentasResponse` trend rows: `+ units: number`. `VentasRow` and `BreakdownRow`: `+ units: number`. Update
`types.ts`; every consumer compiles.

## Testing

- Unit test: trend units per bucket match the sum of line quantities; toggle default is Unidades.
- Route tests: Entidad total = sum of tienda rows; tienda total = sum of product rows (gross and units).
- Component test: expanding an Entidad loads tiendas once; expanding a tienda loads products.
- Verify in the browser (`bun dev`, golden path: toggle, expand Entidad → tienda → producto) before claiming done.
