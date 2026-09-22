# Seller Commission Reliability: Consignment Detection & Exclusion

Date: 2026-09-21
Status: Approved, pending implementation plan

## Context

Second of four related specs (see
`2026-09-21-profundidad-linea-tab-design.md` for the full list and shared
context). Sellers are paid commission on **collected** invoices
(`Fact_Collections`, already keyed by `SalesRepKey`). That attribution is
reliable for normal customers, but breaks down for chains the business
serves on **consignment**: physical delivery (Nota de Entrega) happens
per-tienda, but the aggregate sales across all of a chain's tiendas get
invoiced once, to one contact. The system has no record of which tienda
(and therefore which seller relationship) generated which part of that
aggregate invoice — so a seller's commission total can silently miss sales
they actually drove, or (less likely but possible) get credited with sales
they didn't.

### Investigation (this session, live against `Ncake_a`, 2026-09-21)

1. **Confirmed the gap is a true data-availability problem, not a query
   problem.** `saNotaEntregaVenta` (Nota de Entrega) and `saPedidoVenta`
   (orders) both have **0 rows** in this installation — this business does
   not use either document type; delivery to individual tiendas is tracked
   outside the ERP entirely (paper/manual, per the user). `saFacturaVenta`
   has exactly one `co_ven` per invoice header, and `saFacturaVentaReng`
   (line detail) has **no line-level seller/route/driver column at all** —
   there is no way, even in principle, to record "this line of this invoice
   belongs to seller A, that line to seller B" in the current schema.
   Conclusion: no SQL can reconstruct true per-tienda seller attribution for
   an aggregated consignment invoice. Any "fix" that estimates a split would
   be a guess dressed up as data.

2. **Ruled out `saCondicionPago.co_cond = '000014'` ("Consignación") as a
   detection signal.** The code exists in the catalog, but a live query
   found **zero invoices** using it in the last 12 months — defined but
   unused, the same trap as `saSegmento`'s messy rows. Not a usable signal.

3. **Found a real, generalizable detection signal: root-level billing
   share.** For every multi-tienda chain (a matriz root with children via
   `saCliente.matriz`, resolved today by `Dim_LegalEntity`), computed what
   share of the chain's total 12-month sales land on the **root customer
   code itself** versus its individual tienda child codes:

   | Chain | Sales on root | Sales on children | Root share |
   |---|---|---|---|
   | EXCELSIOR GAMA SUPERMERCADOS | 17,847,304.71 | 1,920,688.81 | **90%** |
   | ENTREN QUE CABEN CIEN | 252,878.98 | 419,533.14 | 38%* |
   | FARMATODO CA | 142,407.05 | 13,424,442.51 | 1% |
   | AUTOMERCADOS PLAZA S C.A | 79,634.35 | 8,569,287.42 | 1% |
   | PLANSUAREZ, C.A | 1.00 | 7,260,926.88 | ~0% |
   | Hipermercado Páramo, C.A | 0.00 | 6,269,783.10 | 0% |

   \* Small absolute volume; worth a manual look at implementation time but
   not assumed to be the same consignment pattern without checking.

   Excelsior Gama is a clear, wide outlier at ~90% root-billed; every other
   chain bills correctly per-tienda (≤1%, noise-level). This ratio is a
   **data-driven, generalizable rule** — it isn't hardcoded to Excelsior
   Gama by name, and it will catch any future customer that develops the
   same billing pattern without code changes.

## Decision (from user)

**Flag + exclude, not flag + estimate.** Detect the consignment-pattern
chains, clearly exclude their root-level invoices from sellers' "reliable"
commission totals, and make the exclusion visible/auditable — do not attempt
to estimate or algorithmically split the excluded amount across sellers.
Fabricating a split would create false confidence in a number that cannot
actually be known from available data.

## Design

### Detection

New computed flag, `IsConsignmentPattern`, at the `Dim_LegalEntity` grain.
Computed on the fly in the Vendedores route (not persisted to the
dimension table — this is a reporting-time judgment based on a tunable
threshold, not a stable ERP fact, so it doesn't belong in the DWH schema
alongside actual dimensional attributes):

```sql
SELECT
  le.LegalEntityKey,
  SUM(CASE WHEN c.CustomerCode = le.RootCustomerCode THEN fs.NetAmount ELSE 0 END) AS SalesOnRoot,
  SUM(fs.NetAmount) AS TotalSales
FROM fact.Fact_Sales fs
JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
WHERE fs.IsVoided = 0 AND le.StoreCount > 1 <dateWhere>
GROUP BY le.LegalEntityKey
HAVING SUM(fs.NetAmount) > 0
```

`IsConsignmentPattern = (SalesOnRoot / TotalSales) >= @rootShareThreshold`
(default `0.15` — chosen with headroom above the ~1% baseline noise level
observed in legitimately-per-tienda chains, and well below Excelsior Gama's
90%; exposed as a tunable query param, not hardcoded, since this is a
business judgment call that may need adjusting as more chains are reviewed).
`le.StoreCount > 1` scopes this to actual multi-tienda chains — a
single-location customer can't exhibit this pattern by definition.

### Exclusion in seller commission numbers

`app/api/dwh/vendedores/route.ts`'s `salesRepQuery` currently sums
`Fact_Sales`/`Fact_Collections` per `SalesRepKey` with no awareness of which
customer entity a row belongs to. Add a `CustomerKey` → `LegalEntityKey` →
flagged-or-not join so each seller's row splits into:

- `salesNet` / `collected` — **unchanged in meaning**, but now computed only
  over rows where the invoice's own customer is not part of a flagged
  entity's root-billed aggregate (i.e., excludes exactly the ambiguous
  root-level invoices, not the entire chain — a flagged chain's normally-
  billed tienda invoices, if any, still count normally).
- `excludedSalesNet` / `excludedCollected` — the amount excluded, plus
  `excludedInvoiceCount`, surfaced as a distinct field so the UI can render
  "$X excluded (N invoices) — consignment pattern" rather than silently
  shrinking the seller's number with no explanation.

This changes `VendedoresRow`'s shape (types in
`app/(app)/analitica/types.ts`):

```typescript
export interface VendedoresRow {
  // ...existing fields unchanged...
  excludedSalesNet: number;
  excludedCollected: number;
  excludedInvoiceCount: number;
}
```

Existing consumers of `salesNet`/`collected` (commission-rate displays,
totals) get more accurate numbers automatically once the query excludes the
ambiguous rows — no separate migration of downstream calculations needed
beyond adding the three new fields to the response and rendering them.

### Audit drill-down

Reuse the existing Vendedores breakdown-by-dimension interaction
(`breakdownQuery`/`breakdownBy` param already in
`app/api/dwh/vendedores/route.ts`) by adding a new breakdown dimension,
`'consignmentExcluded'`, that — when a seller row's excluded amount is
clicked — lists the specific excluded invoices (customer name, invoice
number, date, amount) rather than a further GROUP BY rollup. This keeps the
exclusion auditable: a seller (or admin) can see exactly which invoices were
pulled out and why, rather than trusting an opaque number.

### UI

In `tab-vendedores.tsx`, add a small annotation under each seller's
sales/collection figures when `excludedSalesNet > 0`: e.g. "Bs X excluidos
(N facturas) — patrón de consignación, atribución no confiable," clickable
to expand the invoice-level list. No change to the primary sales/collection
numbers' visual weight — this is a footnote, not a competing headline
metric, so it doesn't make the tab noisier for the common case (most sellers
will show zero exclusions).

### Threshold tuning

`rootShareThreshold` exposed as a query param with the `0.15` default,
following the same "editable, not hardcoded" principle as spec 1's
classification thresholds — surfaced as a number input in the Vendedores
tab's existing filter row, persisted in `localStorage` only.

## Testing

- Unit test for the `IsConsignmentPattern` ratio calculation (pure function,
  given `SalesOnRoot`/`TotalSales` inputs), following
  `margen-proxy.test.ts`'s pattern.
- Route test extending `app/api/dwh/vendedores/__tests__/route.test.ts`:
  mock a flagged and an unflagged `Dim_LegalEntity`, assert the flagged
  entity's root-level invoice amount lands in `excludedSalesNet` and not
  `salesNet`, and that an unflagged multi-tienda chain's numbers are
  unaffected.
- Manual verification against the live test database: confirm Excelsior
  Gama's root-level invoices are excluded and every other matriz chain
  (FARMATODO, AUTOMERCADOS PLAZA S, PLANSUAREZ, Hipermercado Páramo) shows
  zero exclusions at the default threshold. Manually review "ENTREN QUE
  CABEN CIEN" (38% root share, small volume) to decide by inspection
  whether it's a second real consignment case or a data artifact, since it
  sits close to the threshold — do not assume either answer without looking
  at its actual invoices.

## Out of scope

- Estimating or splitting excluded amounts across sellers (explicitly
  rejected — see Decision above).
- Fixing the root cause (capturing per-tienda delivery/order data) — that
  would require a process change and possibly ERP schema changes
  (`saFacturaVentaReng` has no line-level seller column to extend into),
  well beyond this app's scope. If the business later starts using
  `saNotaEntregaVenta` for consignment deliveries, this spec's detection
  logic should be revisited — it would then be possible to attribute at the
  Nota de Entrega level instead of falling back to exclusion.
- The seller × depth-of-line matrix (spec 3) and visit cadence (spec 4).
