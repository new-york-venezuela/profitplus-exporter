# Margen Operativo (Accrual) + Dashboard Month/YTD Navigation — Design Spec

## 1. Problem

`docs/superpowers/specs/2026-09-14-cash-movement-ebitda-design.md` shipped a
cash-basis "EBITDA"/"Margen Operativo" computed entirely from bank/cash
movements (`fact.Fact_CashMovements`). Live investigation on 2026-09-15
found this understates real operating expense by a wide margin:

- `Gastos Operativos` (cash ledger, 90d window) = ~7.26M, only 48
  transactions. `fact.Fact_Purchases.NetAmount` (accrual, same window) =
  ~32.6M, 295 transactions — **4.5x larger**. Profit Plus records purchase
  invoices reliably; it does not reliably record their eventual bank
  settlement promptly (supplier credit terms mean an invoice and its
  payment can land months apart, or the payment may never surface in
  `saMovimientoBanco`/`saMovimientoCaja` at all).
- Investigated whether `saMovimientoBanco.cob_pag → saPago.cob_num →
  saPagoDocReng.nro_fact → saFacturaCompra.nro_fact` could deduplicate
  overlap between the two sources: only 17 of 519 `MateriaPrima`-tagged
  bank movements resolve through that chain to a real, non-voided invoice
  (~3%) — `saPago`/`saPagoDocReng` in this installation is used mostly for
  customer collections (`I-01`), not supplier payment tracking. The link
  is real but does not resolve enough of the population to matter.
- User's own production data showed the same pattern more starkly:
  ~120,000 income vs. ~13,000 expense over a 90-day window — a ratio the
  user found implausible for a >90% margin business.
- The user also flagged (2026-09-15) that `saFacturaCompra` having no rows
  before 2026-01-06 is an artifact of THIS installation's ERP migration
  (invoices were carried forward from 2026 onward, not re-entered
  historically) — invoicing itself has been standard practice for a long
  time. This is data-migration-specific, not a general product assumption,
  and must never be hardcoded as "no data before 2026" anywhere in code —
  other installations of this app may have deep, valid history.

Separately, the date-range picker shared by every Analitica tab
(`analitica-client.tsx`) only offers rolling `30 días`/`90 días`/`12 meses`
windows plus a custom range — the user wants calendar-month and
year-to-date navigation instead, for reviewing finances the way a business
actually closes books (month to date, previous month, etc.), replacing the
30d/90d rolling windows dashboard-wide.

## 2. Fix Direction

### 2.1 Accrual-basis Margen Operativo

Move both sides of the margin calculation to their most complete, reliable
source instead of forcing everything through the bank/cash ledger:

```
Ingresos Netos    = Fact_Sales.NetAmount − Fact_Returns.NetAmount
Gastos Operativos = Fact_Purchases.NetAmount (as "Compras")
                   + Fact_CashMovements Gasto rows, Category <> 'MateriaPrima',
                     IsExcludedFromEbitda = 0
                     (Nomina, Comisiones, Servicios, Mantenimiento,
                      Alquileres, Publicidad, Honorarios, Otros)
Margen Operativo  = Ingresos Netos − Gastos Operativos
Utilidad Neta     = Margen Operativo − Intereses − Impuestos   (unchanged)
```

`Fact_CashMovements`'s `MateriaPrima` category is dropped from the
aggregate entirely — `Fact_Purchases` (accrual, ~10x more complete in the
verification window) replaces it rather than adding alongside it, since no
reliable way exists to deduplicate the ~3% overlap that IS traceable
without also risking silent under-inclusion of the ~97% that isn't.
`Fact_CashMovements`'s `I-01` (cash-basis income) is no longer used for
this metric — the sales waterfall's own `Fact_Sales`/`Fact_Returns` data
is the more complete income source and was sitting unused for this purpose
already.

Naming note: the sales waterfall already has a step called `Neto`
(`Fact_Sales.NetAmount` total, i.e. gross minus discount, NOT minus
returns — `Fact_Returns` is not subtracted anywhere in the waterfall
today, a separate, pre-existing gap this spec does not address). The new
`Ingresos Netos` figure in the Margen Operativo section is a DIFFERENT,
more complete number (`Neto` minus `Fact_Returns.NetAmount` too) — do not
confuse the two or assume the waterfall's `Neto` step already nets out
returns.

### 2.2 `dwh.vw_GastosOperativos` — durable, single-definition view

Per the user's explicit direction (2026-09-15): the "what counts as a real
operating expense" rule must live in ONE place in the DWH, not be
re-assembled ad hoc in `route.ts`'s SQL every time a consumer needs it.

```sql
CREATE VIEW dwh.vw_GastosOperativos AS
SELECT fp.DateKey, 'Compras' AS Category, fp.NetAmount AS Amount, 'Fact_Purchases' AS SourceFact
FROM fact.Fact_Purchases fp
WHERE fp.IsVoided = 0

UNION ALL

SELECT fe.DateKey, ec.Category, fe.Amount, 'Fact_CashMovements' AS SourceFact
FROM fact.Fact_CashMovements fe
JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.IsExcludedFromEbitda = 0
  AND ec.Category <> 'MateriaPrima'
```

Lean grain (`DateKey`, `Category`, `Amount`, `SourceFact`) — no
`ConceptCode`/`ConceptName`/`CostCenter`. `SourceFact` is included for
future debuggability (so a query against the view can tell which physical
table a row came from) even though no current consumer filters on it.

**Every Gastos Operativos category must stay drillable** (this was
under-scoped in the first draft of this spec — Comisiones was only ever
an illustrative example of a category that should drill down, not the
actual requirement; the requirement is that ALL categories drill down,
same as today). `conceptBreakdownQuery` in `route.ts` branches by category
source rather than being one query:

- For every `Fact_CashMovements`-sourced category (`Nomina`, `Servicios`,
  `Mantenimiento`, `Alquileres`, `Publicidad`, `Honorarios`, `Otros`, and
  the new `Comisiones`): unchanged — queries `Fact_CashMovements` directly
  by `ConceptCode`/`ConceptName`, exactly as it does today.
- For `Compras` specifically (the one category with no
  `Fact_CashMovements` equivalent — a purchase invoice has no
  bank-movement `ConceptCode`): a new query branch drills into
  **supplier** (`Dim_Supplier`), reusing the same `getDimensionSpec('proveedor')`
  mechanism `app/api/dwh/compras/route.ts` already uses for its own
  proveedor grouping — `SELECT spec.valueExpr AS GroupValue, spec.labelExpr
  AS GroupLabel, SUM(fp.NetAmount) AS Amount FROM fact.Fact_Purchases fp
  JOIN <supplier dimension join from getDimensionSpec> WHERE fp.IsVoided = 0
  AND fp.DateKey BETWEEN ... GROUP BY ... ORDER BY Amount DESC`. Same
  `{ label, value, amount }` response shape every other breakdown already
  returns (`BreakdownRow`'s index signature already supports this with no
  type change), so the frontend's `GroupedDrilldownTable` needs no new
  code to render it — expanding "Compras" just shows supplier names
  instead of concept names, which is the correct "what's what" breakdown
  for that category.

`route.ts`'s `expenseCategoryQuery` becomes a query against this view
(`SELECT Category, SUM(Amount) FROM dwh.vw_GastosOperativos WHERE DateKey
BETWEEN ... GROUP BY Category`) instead of hand-assembling the union
itself. `excludedExpenseQuery` (Intereses/Impuestos) is unaffected — those
stay excluded from the view already via `IsExcludedFromEbitda = 0` in the
view's own WHERE clause, so `Intereses`/`Impuestos` never appear in the
view at all; `route.ts` keeps its own separate query against
`Fact_CashMovements` directly for those two (the view intentionally never
carries them, since "Gastos Operativos" is by definition their exclusion).

### 2.3 Comisiones category carve-out

Reclassify four already-counted, already-`IsExcludedFromEbitda = 0`
concepts into a new `Comisiones` category so they're visible as their own
row in the Gastos Operativos breakdown instead of buried inside `Nomina`/
`Otros` (pure re-labeling — no concept's inclusion/exclusion changes):

| ConceptCode | Name | Current Category | New Category |
|---|---|---|---|
| E-217 | COMISIONES VENDEDORES | Nomina | Comisiones |
| E-213 | COMISIONES BANCARIAS | Otros | Comisiones |
| 134 | Comisiones Bancarias (Moneda Extranjera) | Otros | Comisiones |
| E-111 | Comisiones mercantiles | Otros | Comisiones |

`E-217`'s existing `CostCenter = 'Ventas'` is untouched — it stays
meaningful within `Comisiones` for anyone drilling into that category's
concepts later, even though the aggregate view doesn't carry `CostCenter`.

### 2.4 Migration hygiene

Per the user's explicit direction (2026-09-15): the migrations already in
`main`/HEAD (`0023`, `0024`, `0025`) have already run in production.
**Nothing in this spec edits any of those three files.** Every change here
is new, additive migration(s) — `UPDATE`s to existing seed rows,
`CREATE VIEW` (idempotent via `CREATE OR ALTER VIEW`), never a `DROP`/
`TRUNCATE`/rewrite of anything those three files already created. This
mirrors the pattern `0025` itself already used against `0017`/`0023`.

### 2.5 Dashboard-wide month/YTD date-range navigation

Extends the existing `DateRange` string encoding
(`'30d'|'90d'|'12m'|custom:start:end`) with two new forms:

- `month:YYYY-MM` — a single calendar month (`YYYY-MM-01` through the last
  day of that month, or through today if that month is the current one).
- `ytd:YYYY` — January 1 of that year through today (if the current year)
  or through December 31 (if a past year).

Per the user's direction (2026-09-15): **`30d`/`90d` are removed**
dashboard-wide (every tab, not just Finanzas) and replaced by month/YTD
navigation; `12m` and `custom:start:end` are unchanged and stay available
alongside the new options. This is a shared-component change in
`analitica-client.tsx` (the single place `DATE_RANGE_OPTIONS` and the
picker UI live) and `buildDateWhereClause` in
`app/api/dwh/lib/query-builder.ts` (the single place every tab's API route
resolves a `DateRange` string into a `DateKey` SQL filter) — no other tab
file needs to change, since they all already consume `dateRange` as an
opaque prop/string.

**No hardcoded date assumptions.** Per the user's explicit instruction
(2026-09-15): nothing in this feature may hardcode "no data before 2026"
or any other installation-specific date boundary. A `month:`/`ytd:` filter
for a period with no matching rows returns an empty/zero result
mechanically (the `WHERE DateKey BETWEEN ...` clause just matches
nothing) — this is the correct, portable behavior for any installation's
actual data range, not something to special-case.

UI: the flat `30 días | 90 días | 12 meses | Personalizado` button row
becomes `Mes Actual | Mes Anterior | Año Actual | 12 meses |
Personalizado`. Selecting a month option shows `◀`/`▶` arrows next to a
label showing the selected month (e.g. "Septiembre 2026") to page to
adjacent months, updating the `month:YYYY-MM` param. "Año Actual" selects
`ytd:<current year>`; there's no arrow-paging for YTD in this iteration
(selecting a past year is only reachable via `Personalizado` for now — see
§4 Non-goals).

## 3. Data Flow

1. `analitica-client.tsx`: user clicks "Mes Anterior" → `dateRange` URL
   param becomes `month:2026-08` (computed from the current month minus
   one, not hardcoded) → passed as a prop to whichever tab is active.
2. Each tab's fetch call passes `dateRange` through to its API route
   unchanged (existing pattern, no per-tab code changes needed).
3. `buildDateWhereClause('month:2026-08', 'fe')` resolves to
   `AND fe.DateKey >= 20260801 AND fe.DateKey <= 20260831`.
4. `app/api/dwh/finanzas/route.ts`:
   - `waterfallTotalsQuery` (unchanged query, `Fact_Sales`) also feeds the
     new `Ingresos Netos` figure — no new query needed for the sales side,
     just a new subtraction of `Fact_Returns.NetAmount` (new query,
     mirroring `devoluciones/route.ts`'s existing `Fact_Returns` query
     shape).
   - `expenseCategoryQuery` becomes a `dwh.vw_GastosOperativos` query.
   - `excludedExpenseQuery` (Intereses/Impuestos) stays querying
     `Fact_CashMovements` directly, unchanged.
   - `cashFlowIncomeQuery` (the old cash-basis `I-01` income query) is
     deleted — no longer used.
   - `conceptBreakdownQuery` branches on `parentValue`: `parentValue ===
     'Compras'` queries `Fact_Purchases` by supplier (new branch, §2.2);
     every other category keeps querying `Fact_CashMovements` by concept
     (unchanged).
5. Response shape: `cashFlowEbitda` block is renamed in meaning (not
   necessarily in field names — see Non-goals) to reflect accrual
   `ingresosOperativos`/`gastosOperativos`, computed from the new sources.

## 4. Non-goals

- Not building month-by-month or year-by-year paging for `ytd:` in this
  iteration — only the current year's YTD is a one-click option; past
  years remain reachable only via `Personalizado`. A future iteration
  could add year paging the same way month paging works, if requested.
- Not attempting to resolve the ~3% `saPago`-linkable overlap between
  `Fact_Purchases` and cash-ledger `MateriaPrima` — investigated and
  found to not resolve enough of the population to be worth the added
  join complexity (§1). `MateriaPrima` is fully replaced by `Fact_Purchases`,
  not partially merged.
- Not adding a `Comisiones`-specific card, or any category-specific UI
  surface beyond a drilldown row — every category (including `Comisiones`
  and `Compras`) gets exactly the same "Gastos operativos por categoría"
  table treatment every other category already has: a row, expandable to
  its breakdown. No new UI component.
- Not adding a product-level breakdown under Compras' supplier drilldown
  (i.e., no second-level drill from supplier into which products drove
  that supplier's total) — the Compras tab itself already offers a
  separate línea→producto breakdown path for that; this spec only needs
  Finanzas' "Compras" category row to drill one level, to suppliers, to
  match the existing depth every other Gastos Operativos category has.
- Not touching the Compras tab's own existing queries/logic — this spec
  only adds a NEW consumer (`dwh.vw_GastosOperativos`) of
  `Fact_Purchases`, it doesn't change how the Compras tab itself queries
  that table.
- Not re-verifying `Fact_Purchases`'s own ETL correctness (voided/currency
  edge cases) beyond what's already shipped — the user's chosen DWH-gap
  answer was specifically "a durable Gastos Operativos definition," not
  "re-audit Fact_Purchases," so that re-audit is out of scope here (it
  remains a reasonable follow-up if trust in the Compras figure is ever
  questioned).
