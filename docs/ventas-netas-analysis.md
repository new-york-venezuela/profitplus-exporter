# Ventas netas: why Analítica did not match the Excel, and what changed

Date: 2026-10-04. Branch `fix/ventas-netas`. The numbers below come from the dev DWH (`DWH_AlimentosNY` on localhost) and the mock ERP `Ncake_a`. That data is small, so re-check the percentages on production before you rely on them.

## 1. What was wrong

The "Ventas netas" figure in Analítica did not match a "facturas − devoluciones" Excel built from Profit Plus. The causes, ranked by their June 2026 effect:

| # | Cause | June 2026 effect (BS) | Kind |
|---|-------|----------------------|------|
| 1 | **"Ventas netas" never subtracted returns.** It was `SUM(Fact_Sales.NetAmount)`. Returns only fed a return rate or sat in a separate column. Only Finanzas subtracted them. | +1,217,839 (by return date) / +820,999 (by factura date) | semantics |
| 2 | **Credit notes booked outside the devolución module are not in any fact table.** These are plain `N/CR` in `saDocumentoVenta`. Before late May 2026 most returns were booked this way. | June: 39,531. **Mar–May: 3.84M** (vs 0.27M in Fact_Returns) | DWH scope gap (not fixed) |
| 3 | **Returns were dated by the devolución, not the factura.** 67% of return lines fall in a different month than their factura. | June: +393,667 over-attributed (Apr −356,551, May −460,713, Jul +425,965) | DWH schema (fixed in 0036) |
| 4 | **USD: sales on days with no `saTasa` row were dropped.** `SUM(x / NULL)` ignores those rows. | June: 2,884,655 BS ≈ 4,636 USD (8.5% of June USD) | fixed in 0036 (rate carry-forward) |
| 5 | **USD returns used the rate on the return date.** A return line is priced at the factura's BS price. | June returns: 2,063 USD vs 2,262 at the factura rate | fixed (app) |
| 6 | **The global discount was not subtracted from NetAmount.** | June: +97,361 | fixed in 0036 |
| 7 | **IVA is excluded.** An Excel built on `total_neto` includes IVA. | June: 494,606 IVA | definition (documented) |
| 8 | **Anulados.** The DWH excludes them, so the Excel must too. | June: 402,640 voided | Excel side |
| 9 | Watermark / incremental load | 0 rows missing or duplicated on the mock | none observed |

June 2026 reconciliation, before this branch:

| Definition | BS | vs app |
|---|---|---|
| App "Ventas netas" = Σ reng_neto, non-void facturas | 35,109,270.75 | — |
| − global discount (97,360.71) | 35,011,910.04 | −97,361 |
| − DCLI by return date (1,217,838.70) − plain N/CR June (39,530.71) | 33,754,540.63 | −1,354,730 (−3.9%) |
| − DCLI by factura date (824,172.01); no plain N/CR maps to June facturas | 34,187,738.03 | −921,533 (−2.6%) |
| Excel with IVA: facturas total_neto 35,506,516.33 − DCLI total_neto 1,353,995 − plain N/CR total_neto 57,799.16 | 34,094,722.17 | −1,014,549 |

After this branch, the dev DWH reports these June 2026 figures. All of them were checked against read-only SELECTs.

| Metric | BS | USD |
|---|---|---|
| Ventas brutas | 35,011,910.05 | 59,111.76 |
| Devoluciones by factura date | 820,999.07 | 1,420.24 |
| **Ventas netas** | **34,190,910.98** | 57,691.53 |
| Devoluciones by devolución date (toggle) | 1,217,838.70 | — |

The 3,172.94 difference against the research figure (824,172.01) is devolución 009160's own global discount. NetAmount is now net of the global discount on returns too.

The same June net appears in Ventas, Resumen, Clientes (sum of rows), Productos (sum of líneas), Matriz (sum of sellers) and Finanzas "Ingresos operativos".

## 2. What changed

### DWH (migration 0036, committed earlier on this branch)

- `fact.Fact_Returns` gains `OriginalInvoiceNumber`, `OriginalInvoiceLineNumber`, `OriginalInvoiceDateKey` and `HasInvoiceLink`.
  - The link is resolved through `rowguid_doc`, with `num_doc` as the fallback.
  - `DateKey` is still the devolución date.
- `fact.Fact_ExchangeRate` carries the last real rate forward to every calendar day. Carried rows have `IsCarriedForward = 1`.
- `NetAmount` on sales and returns now subtracts the global discount.

### App: definitions (one set, used everywhere)

- **Ventas brutas** = `SUM(Fact_Sales.NetAmount)`.
  - Excludes IVA and voided facturas.
  - Net of line and global discounts.
  - Dated by factura.
  - USD converted per row at that row's own date's `RateSell`.
- **Devoluciones** = `SUM(Fact_Returns.NetAmount)`.
- **Ventas netas** = brutas − devoluciones. Returns are attributed to `OriginalInvoiceDateKey`, the date of the original factura.
- **USD for returns** always uses the original factura's rate (`returnsUsdConversionJoin`), whichever date the return was windowed by.

Helpers:

- `app/api/dwh/lib/query-builder.ts`: `ReturnsBasis`, `buildReturnsDateWhereClause`, `returnsUsdConversionJoin`, `returnsAmountSubqueries`. `buildDateWhereClause` and `bucketFilterClause` gained a date-column argument.
- `app/(app)/analitica/lib/net-sales.ts`: `subtractDual`, `returnRate`, `dualFromRow`.
- `app/(app)/analitica/lib/period-label.ts`: `periodLabel`.

API fields that held gross-of-returns figures were renamed from `salesNet` to `salesGross` throughout. `salesNet` now always means net of returns.

### App: per tab

- **Ventas**
  - KPIs: Ventas brutas, Devoluciones, Ventas netas (with Δ vs. the previous period), Tasa de devolución, and the existing counts.
  - The trend chart shows brutas as bars and netas as a line.
  - The cliente and línea tables show brutas, devoluciones, netas, tasa and discount.
  - New toggle: **Devoluciones por fecha de factura** (default) or **por fecha de devolución**.
  - The cliente drill-down's returns now honor the clicked bucket/month and the seller filter.
- **Resumen**
  - KPI labels follow the selected range. The hard-coded "(12m)" is gone.
  - Brutas, devoluciones and netas use the factura basis.
  - Trend chart: brutas, netas and devoluciones.
  - Top-10 lists are labelled "ventas brutas".
  - The seller table adds netas and states that it includes consignment.
- **Vendedores**
  - Columns: Ventas brutas (sin consig.), Devoluciones, Ventas netas (sin consig.), Tasa dev., Tasa cobr., Descto prom., and **Consig. excluida**.
  - Gross and discount now follow the consignment exclusion too.
- **Vendedor 360**
  - The first-sale USD now uses `RateSell`, not `DocumentExchangeRate`. Before, it was overstated up to ~100x.
  - The quota figure is labelled as brutas without consignment.
  - Return lists are labelled "por fecha de devolución".
- **Clientes**: brutas, devoluciones and netas columns. Pareto is still ranked by brutas, and the label says so.
- **Productos**
  - The drill-down has brutas, devoluciones and netas.
  - The Margen column is hidden while no row has product cost, and shows "n/d" per row otherwise.
  - The standalone Profundidad "Tasa dev." is labelled as using the devolución date.
- **Matriz Vendedor-Producto**
  - The summary has brutas, devoluciones and netas.
  - Matrix cells and the XLSX export attribute returns to the original factura. In the export, a return sits in the same week row as its sale.
- **Histórico 2025**
  - Brutas, devoluciones and netas.
  - Legacy returns have no factura link, so they are subtracted by devolución date. The banner says so.
  - The cliente drill-down's returns now honor the month and seller filters.
- **Devoluciones**: labelled "por fecha de devolución". USD uses the factura rate.
- **Finanzas**
  - USD is converted per row at each row's own date instead of today's rate.
  - Rows before the first DWH rate are reported as "no tienen tasa histórica" instead of being mixed in silently.
  - Ingresos operativos = Ventas netas (factura basis).
  - "Utilidad neta" was renamed "Resultado después de intereses e impuestos". It is margen operativo − intereses − impuestos (cash), not accounting net income. "Resultado operativo" would also be wrong, because the figure is after interest.
- **CxC**: DSO = IVA-inclusive balance ÷ (sales with IVA − returns with IVA, trailing 90 days) × 90. Both sides are now on the same IVA basis.
- **Multimoneda**: the monthly average ignores carried-forward days.
- **Mapa**: "Ingresos" is explained as ventas brutas for ERP-active tiendas only, not comparable to the Analítica totals. The Pareto comment now says the map ranks by tienda, not by entity.
- **Help**: `content/help/analitica-definiciones.md`, shown via the "?" HelpPanel on `/analitica`.

### Decisions

- **Return basis.**
  - Anything that nets returns against sales uses the factura date: KPIs, tables showing brutas/devoluciones/netas side by side, and the return rate shown next to them.
  - Views that report returns as events of the period use the devolución date and say so: the Devoluciones tab, Vendedor 360 return lists, and Productos → Profundidad tasa.
  - Ventas offers both.
- **Seller totals.** We kept the consignment exclusion on Vendedores and Vendedor 360, because it is commission-relevant by design. We made the exclusion explicit: the labels say "sin consig." and the excluded amount has its own column. Resumen and Matriz keep all invoices and say so. Aligning every view would have hidden either the exclusion or the full total, and both are needed.
- **Tasa cobr.** The DWH has no ex-IVA collections. `mont_cob` includes IVA, so the denominator is now sales with IVA (`NetAmount + TaxAmount`) rather than adding a note.

## 3. What was deliberately not changed

- **Plain credit notes (`N/CR` outside the devolución module).**
  - There are 363 non-voided notes, worth 3.92M BS (bruto), versus 1.94M in Fact_Returns.
  - 253 of them set `doc_orig='FACT'`/`nro_orig`, and 234 of those resolve to a factura (2.20M BS). The other 110 notes (1.54M BS) have no structured link. They include 705,636 BS of "MERCANCIA EN CONSIGNACION" notes and free-text "DEV …" notes.
  - Which kinds of notes reduce sales (returns, discounts, price corrections, consignment) is a **business decision**. Loading them needs a new fact (for example `fact.Fact_CreditNotes`, at header grain, with a `CreditNoteKind`). They could then reduce totals and customer/seller views, but not línea/producto views.
  - Until then, Mar–May 2026 net sales in Analítica are higher than an Excel that subtracts every credit note.
- **`monto_reca` on devoluciones** is not loaded. It is the FX revaluation of the returned amount. Returns stay at the factura's BS value, and their USD uses the factura rate.
- **Legacy tables** (`Fact_Sales_Legacy`, `Fact_Returns_Legacy`) are unchanged. They have no factura link, and their NetAmount is still plain `reng_neto`. They are empty on dev.
- **Mapa** still shows gross sales for ERP-active customers per tienda code. This is now labelled.
- **Productos margin** waits for product cost (see the cost-recipe branch below).

## 4. How to reconcile with an Excel from Profit

To match "Ventas netas" for a month:

1. **Exclude anulados** on both facturas and devoluciones (`anulado = 0`).
2. **Use ex-IVA amounts.** Sum line `reng_neto`, or header `total_bruto`. Do not use `total_neto`, which includes IVA, recargo and otros.
3. **Subtract the global discount** (`monto_desc_glob`) per factura. Line amounts do not include it.
4. **Filter by factura date and include the whole last day.** `fec_emis` carries a time of day. `BETWEEN '2026-06-01' AND '2026-06-30'` drops facturas issued on the 30th after 00:00 (June: 1 factura, 43,960 BS). Use `fec_emis < '2026-07-01'`.
5. **Subtract devoluciones from the devolución module only** (`saDevolucionClienteReng`). Put each one in the month of its original factura, using `rowguid_doc` → `saFacturaVentaReng`, or `num_doc` when that fails. Use line `reng_neto` minus the devolución's global discount. Do not subtract plain `N/CR` from `saDocumentoVenta` (see §3).
6. **For USD**, divide each line by `saTasa` of its own date, carrying the last rate forward over weekends and holidays. Convert returns at their factura's date.

To compare with the Ventas tab's "por fecha de devolución" view instead, put each devolución in the month of its own `fec_emis`.

## 5. Dev-DWH side effect: merge order with the cost-recipe branch

The dev DWH also had migrations `0031_stg_recipe_cost_snapshot.sql` and `0032_fact_sales_recipe_cost.sql` applied. They come from the unmerged `product-cost-recipe-fifo` branch (worktree `san-jose`).

That branch's `dwh.Load_Fact_Sales` fills UnitCost, COGS and GrossProfit. Migration 0036 runs `CREATE OR ALTER dwh.Load_Fact_Sales`, so it **replaced** that procedure on dev:

- Cost values already loaded stay.
- New loads write NULL cost.

The pre-0036 definition is saved at `.superpowers/research/devdwh_Load_Fact_Sales_before_0036.sql`. To restore it with the 0036 change applied, change `r.reng_neto,` in its `Changed` CTE to `r.reng_neto - ISNULL(r.monto_desc_glob, 0) AS reng_neto,` and run it as `CREATE OR ALTER`.

**Whichever branch merges second must combine both `Load_Fact_Sales` changes:** the recipe cost from that branch, and the global-discount netting from 0036. Otherwise one change silently undoes the other. The Productos "Margen %" column reappears automatically once cost is populated.
