# Analítica UI Flattening, Finanzas Margin Rework, CxC Expansion

Date: 2026-09-15
Status: Approved, pending implementation plan

## Context

Three independent changes to the `app/(app)/analitica` dashboard, scoped together
because they touch overlapping files (`tab-finanzas.tsx`, `app/api/dwh/finanzas/route.ts`,
`app/(app)/analitica/types.ts`) and share the same session's research:

1. Some analytics tabs hide part of their report behind an internal view-selector
   (e.g. "agrupar por: mes / cliente / línea" buttons that swap which chart/table is
   shown). The user wants every tab to show its full report at once — no toggle
   hiding data.
2. The Finanzas tab's "Utilidad Bruta" / "Margen Bruto" waterfall steps are always
   `0` / `0%`. Investigated and confirmed as a **known, already-documented gap**
   (`docs/DATA_WAREHOUSE_GUIDE.md:548-567`): Profit Plus has never recorded
   product cost (`Fact_Sales.GrossProfitAmount` is always `NULL`,
   `CostSourceFlag='NO_COST_DATA'`). Not fixable without an upstream costing
   process in the ERP. The user wants a **proxy** gross-margin figure instead,
   using Compras as a stand-in for COGS, distinct from the existing
   "Margen Operativo" (which nets against *all* operating expenses, not just
   Compras).
3. The user suspected Nómina expense totals were too low, possibly a code bug.
   Investigated (see "Nómina investigation" below) — **query logic is correct**;
   the DWH total matches the source ERP exactly on the reference dataset. No code
   change needed. Closed.
4. The CxC tab should gain: a payment/expiration weekday breakdown, a DSO trend,
   an aging trend, and top-debtor payment behavior.

## Nómina investigation (closed, no action)

Reproduced `app/api/dwh/finanzas/route.ts`'s `conceptBreakdownQuery` (Category='Nomina')
against both the DWH and a direct ERP query bypassing the ETL join, over the last
90 days of available data in the local reference DB (20260414–20260713 — the
reference DB's most recent data, since "today" 2026-09-15 has no rows). Totals
matched to the cent (3,242,496.89, 11 rows both sides). No orphaned/unmapped
concept codes, no wrongly-excluded rows (`IsExcludedFromEbitda`), no voided rows,
no misclassified Nómina-shaped concepts. The dominant line (`NOMINA POR PAGAR`,
~68% of the total) is a generic clearing account with no cost-center signal —
already documented (`dwh-migrations/0024_nomina_cost_center.sql`, "cost-center
gap"). The reference DB is a small test dataset (11 rows total history); if the
production total still looks low, that's a separate future investigation against
the production DB, out of scope here.

## Part 1 — Flatten in-tab view-selectors

Only three tabs have a true "(A) view-selector" — a control that swaps which
chart/table component renders, hiding the others. All other tabs' internal
controls are filters/grouping/sort on a single component and are unaffected.

| Tab | Current toggle | Change |
|---|---|---|
| `tab-ventas.tsx` | `groupBy`: mes / cliente / línea (buttons ~213-224) | Remove toggle. Render trend chart (mes) + cliente `GroupedDrilldownTable` + línea `GroupedDrilldownTable` stacked, each section with its own heading. Existing filter toggles (Entidad/Tienda, `breakdownBy`, month drill-down) stay per-section as today. |
| `tab-compras.tsx` | `groupBy`: mes / proveedor / línea (buttons ~168-180) | Same pattern: trend chart + proveedor table + línea table stacked. |
| `tab-devoluciones.tsx` | `groupBy`: salesrep / producto / cliente (buttons ~154-166) | Same pattern: salesrep table + producto table + cliente `GroupedDrilldownTable` stacked. |

`tab-productos.tsx`'s `groupBy` (línea/sublínea/sku) is a drill-down breadcrumb
within a single table component (not a component swap) — left as-is, confirmed
with user.

Top-level tab navigation (Resumen/Ventas/.../Compras, `?tab=` query param in
`analitica-client.tsx`) is unchanged — this only affects sub-navigation inside a
tab's body.

**Section headings**: each stacked block gets a small heading (e.g. "Por mes",
"Por cliente", "Por línea") so the page reads as one continuous report rather than
unlabeled repetition.

**Load & caching**: since all sub-views now render (and fetch, where they trigger
separate requests) immediately instead of on toggle-click, add
`Cache-Control: private, max-age=900` (15 min) response headers to every handler
under `app/api/dwh/*/route.ts`, keyed as today by the existing query params
(dateRange/currency/groupBy/etc. already form the cache-relevant request identity
via the URL). No client-side cache layer needed — this is a straightforward HTTP
cache header addition per route.

## Part 2 — Finanzas: gross-margin proxy + margen operativo %

Restructure the waterfall in `app/api/dwh/finanzas/route.ts` and `tab-finanzas.tsx`:

```
Ingresos Operativos      = Fact_Sales.NetAmount − Fact_Returns.NetAmount   (unchanged, existing ebitda calc)
− Compras                = vw_GastosOperativos WHERE Category='Compras'    (existing Fact_Purchases source)
= Utilidad Bruta (proxy) = Ingresos − Compras
  Margen Bruto %         = Utilidad Bruta / Ingresos

− Otros Gastos Operativos = vw_GastosOperativos WHERE Category<>'Compras'  (Nómina + everything else, unchanged set)
= Margen Operativo        = Utilidad Bruta − Otros Gastos Operativos       (equals today's existing ebitda amount)
  Margen Operativo %      = Margen Operativo / Ingresos
```

- Removes the old `Fact_Sales.GrossProfitAmount`-based `Utilidad Bruta`/`Neto`/`COGS`
  waterfall steps (always 0) from the response and chart — replaced by the proxy
  steps above.
- `Margen Operativo` (dollar figure) is unchanged in value from today's
  `cashFlowEbitda.ebitda` — this is a relabel/restructure of the *presentation*,
  not a change to how opex is aggregated. New: both steps now carry a `%` field.
- UI: `tab-finanzas.tsx` waterfall chart gains the "Utilidad Bruta (proxy)" step;
  KPI cards show `%` next to both Utilidad Bruta and Margen Operativo amounts
  (mirroring the existing `marginRate` display pattern at `tab-finanzas.tsx:208-214`).
- Add an inline note/tooltip near the waterfall: "Compras se usa como proxy de
  costo directo — Profit Plus no registra costo de producto (ver Data Warehouse
  Guide)." so users don't mistake this for exact COGS-based gross margin.
- `FinanzasResponse` type (`app/(app)/analitica/types.ts`) gains the new
  percentage fields on the waterfall/summary shape.
- No new SQL view needed — reuses `dwh.vw_GastosOperativos`'s existing
  Compras/non-Compras split (`dwh-migrations/0026_gastos_operativos_view.sql`).

## Part 3 — CxC expansion

### 3a. ETL: due-date lineage on collections

New migration (`dwh-migrations/0027_fact_collections_due_date.sql`) adding
`DueDateKey INT NULL` (FK `Dim_Date`) to `fact.Fact_Collections`. `Load_Fact_Collections`
updated to resolve each payment's `InvoiceNumber` against `saDocumentoVenta.fec_venc`
(the same source column already used for `Fact_AR_Snapshot.DueDate`) and populate
`DueDateKey` at load time. This makes every collection row self-describing for
aging-at-time-of-payment, without depending on the lossy point-in-time AR snapshot.

Rows where the invoice can't be resolved (fully historical/pre-DWH invoices, edge
cases) get `DueDateKey = NULL` and are excluded from the new bucketed chart (not
from other existing `Fact_Collections` usage, which is unaffected).

### 3b. New chart — Cobros por día de semana × estado de vencimiento

Grouped/stacked `BarChart`, X-axis = weekday (Lun–Dom), 3 series = amount collected
where, at time of payment: vencía ese mismo día / ya estaba vencida / aún no vencía
(computed by comparing `DateKey` to `DueDateKey` per collection row). New query in
`app/api/dwh/cxc/route.ts`, new response field on `CxcResponse`.

### 3c. DSO trend

`LineChart`, monthly DSO over the selected date range (or a fixed trailing window,
e.g. last 12 months, independent of the CxC tab's snapshot-only date handling —
needs its own historical query since `Fact_AR_Snapshot` already retains daily
snapshots). DSO formula: `(AR balance at month end / net sales in trailing period) × days in period`.

### 3d. Aging bucket trend

Stacked-area chart reusing the existing aging buckets (Current/1-30/31-60/61-90/>90),
trended monthly instead of a single `MAX(SnapshotDateKey)` snapshot — same bucket
definitions as the existing `tab-cxc.tsx:10-17` color/threshold logic, just queried
across multiple snapshot dates.

### 3e. Top-debtor payment behavior

Add a "Días promedio de pago" column to the existing top-debtors table
(`tab-cxc.tsx:160-206`), computed as the average `(DateKey − DueDateKey)` across
each debtor's `Fact_Collections` rows (once 3a lands). Debtors with no resolvable
due-date rows show "—".

## Part 4 — Cleanup

Investigated (`app/api/dwh/finanzas/route.ts`, `app/api/dwh/productos/route.ts`,
migrations, docs) what removing/changing here touches elsewhere:
`GrossProfitAmount` also backs the Productos tab's margin column
(`tab-productos.tsx:210`, always "—" today, same root cause). Decision: **keep the
`Fact_Sales` cost columns in the schema** — they're the intended slot for real
cost data once an upstream costing process exists in Profit Plus, and Productos
still legitimately wants that margin column then. Cleanup here is code-level only,
scoped to Finanzas.

- **Dead code (Finanzas)**: remove the old `Fact_Sales.GrossProfitAmount`/
  `COGSAmount`-reading waterfall-building code in `app/api/dwh/finanzas/route.ts`
  (the `cogsAmount`/`grossProfitAmount` reads and the old `Bruto`/`Descuento`/
  `Neto`/`COGS`/`Utilidad Bruta` waterfall steps, replaced by Part 2's proxy
  steps) and any now-unused fields on `FinanzasResponse`/`FinanzasWaterfallStep`
  in `types.ts`.
- **Dead code (view-selectors)**: remove the old `groupBy` state, button rows,
  and now-redundant conditional render branches in `tab-ventas.tsx`,
  `tab-compras.tsx`, `tab-devoluciones.tsx` once flattened (Part 1) — no leftover
  unused state/props.
- **Doc corrections**: update `docs/DATA_WAREHOUSE_GUIDE.md`'s Finanzas/waterfall
  section to describe the new Compras-proxy calc instead of the old
  `Fact_Sales`-based one (the "Cost Data Gap" callout itself stays — it's still
  accurate — but the "Margen Operativo workaround" prose needs the Utilidad
  Bruta proxy addition). Also correct the "wired to auto-populate when cost data
  flows" language (`DATA_WAREHOUSE_GUIDE.md:557`, `dwh-migrations/README.md:28`,
  `docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md:82`) —
  investigation found `Load_Fact_Sales` inserts these columns as hardcoded
  `NULL, NULL, NULL, 'NO_COST_DATA'` with no join to any cost source table
  (`dwh-migrations/0009_fact_sales.sql:117-121`) — there is no live plumbing
  today, only a placeholder schema slot. Correct this to describe accurately as a
  reserved-but-unwired column, not "wired."
- **No schema/ETL changes** to `Fact_Sales` cost columns — out of scope, see below.

## Out of scope

- Any change to `Fact_Sales.GrossProfitAmount`/true COGS, or removing those
  columns — still blocked on an upstream Profit Plus costing process (unchanged
  known limitation); Productos tab still depends on the column existing.
- Productos tab's dead margin column — same root cause, left as-is.
- Nómina cost-center split (production vs. admin) — unchanged known limitation
  (93.4% unclassifiable, documented).
- Re-verifying Nómina totals against production — separate future task if needed.
- Top-level tab navigation redesign — only in-tab view-selectors are flattened.
