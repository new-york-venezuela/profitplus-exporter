# Cash-Movement EBITDA — Design Spec

## 1. Problem

The Finanzas tab's EBITDA figure (`app/api/dwh/finanzas/route.ts`) is computed as:

```
ebitda = utilidadBruta - gastosOperativos
utilidadBruta = SUM(ISNULL(fact.Fact_Sales.GrossProfitAmount, 0))
```

`Fact_Sales.GrossProfitAmount`/`COGSAmount` are **always NULL** — every row is
inserted with `CostSourceFlag = 'NO_COST_DATA'`
(`dwh-migrations/0009_fact_sales.sql:117-121`), because Profit Plus has never
recorded product/manufacturing cost (`docs/DATA_WAREHOUSE_GUIDE.md`, "Cost
Data Gap" — `costo_pro = 0` on 100% of cost-history rows, no BOM/costing
workflow exists). So `utilidadBruta` always sums to `0`, and the formula
collapses to `ebitda = -gastosOperativos` — a structurally negative number
with no real relationship to profitability, driven entirely by operating
expense volume for the selected date range. This is why production
(-18,000 range) and local (-9,000 range) both show large negative EBITDA:
each environment's expense totals differ, but the "profit" side of the
calc is always exactly zero. Not an ingestion bug — root-caused and
confirmed live 2026-09-14.

## 2. Fix Direction

Real cash-basis income data already exists and is already ingested: bank/cash
movements (`saMovimientoBanco`/`saMovimientoCaja`) carry a
`co_cta_ingr_egr` concept code classified by `dim.Dim_ExpenseConcept` into
`ConceptType IN ('Gasto', 'Ingreso', 'Traspaso')`. Today's ETL
(`dwh-migrations/0018_fact_expenses.sql`) already loads the `Gasto` side into
`fact.Fact_Expenses`; it explicitly filters out `Ingreso` rows to avoid
double-counting against `Fact_Sales` revenue (which was the right call when
`Fact_Sales` was assumed to be a working revenue source — it no longer is,
for margin/EBITDA purposes).

**New EBITDA definition, cash-basis, decoupled from `Fact_Sales`:**

```
EBITDA = Ingresos Operativos (I-01 Ventas, from movimientos) − Gastos Operativos (from movimientos)
Utilidad Neta = EBITDA − Intereses − Impuestos
```

The existing `Fact_Sales`-driven waterfall (Bruto → Descuento → Neto → COGS →
Utilidad Bruta) is **left in place, unchanged** — it's still a legitimate
view of invoiced revenue/discount rate, just not usable for margin or EBITDA
while the cost gap exists. Per the user's direction (2026-09-14): EBITDA
becomes a fully separate section, with no arithmetic link to the sales
waterfall.

## 3. Data Layer

### 3.1 Rename `Fact_Expenses` → `Fact_CashMovements`

`Fact_Expenses` will now hold `Gasto` AND `Ingreso` rows (still excluding
`Traspaso`), so the name no longer matches its contents. New migration
`dwh-migrations/0023_fact_cash_movements.sql`:

- `sp_rename` the table `fact.Fact_Expenses` → `fact.Fact_CashMovements`,
  its PK constraint, unique constraint, and both indexes to matching names
  (`PK_Fact_CashMovements`, `UQ_Fact_CashMovements_Source`,
  `IX_Fact_CashMovements_DateKey`, `IX_Fact_CashMovements_ExpenseConceptKey`).
  Guard every rename with `IF EXISTS (... old name ...) AND NOT EXISTS (...
  new name ...)` so the migration is idempotent and safe to run against a DB
  that's already been renamed.
- Drop `dwh.Load_Fact_Expenses`, create `dwh.Load_Fact_CashMovements` as a
  copy of the same MERGE body with two changes:
  - `WHERE ec.ConceptType = 'Gasto'` → `WHERE ec.ConceptType IN ('Gasto', 'Ingreso')`
  - Target table references updated to `fact.Fact_CashMovements`
- No change to `EtlWatermark` rows (`saMovimientoBanco`/`saMovimientoCaja`
  watermark keys are unaffected by the table rename — same source, same
  incremental cursor).
- No change to `dim.Dim_ExpenseConcept`/`ExpenseConceptSeed` structure itself
  (see 3.2 for the classification data change, same table).

This is a widen-in-place per the user's explicit choice (accepting the
tradeoff over a clean separate table): existing rows carry over via rename,
no backfill needed, but every consumer of the old name must be updated in
the same change (see §5, cleanup).

### 3.2 Classify `Ingreso` concepts

Extend `dim.ExpenseConceptSeed` (same INSERT block pattern as
`0017_dim_expense_concept.sql`, added via the new migration — never edit
0017 directly) to give every `Ingreso`-type code an explicit
`IsExcludedFromEbitda` classification, mirroring how `Gasto` codes already
work. Verified live 2026-09-14 against `Ncake_a.dbo.saCuentaIngEgr` /
`saMovimientoBanco` (31 `I-` codes, `I-08` is actually `ConceptType =
'Traspaso'` per the existing seed and stays that way):

| ConceptCode | Description | Classification | Why |
|---|---|---|---|
| I-01 | Ventas | **Operating** (`IsExcludedFromEbitda = 0`) | Core recurring sales revenue — dominates by volume (~66M vs. low hundreds of thousands combined for everything else, live-verified 2026-09-14) |
| I-02 | Otros Ingresos | Non-operating | Too vague/mixed to trust as pure operating revenue |
| I-03 | Dev. Prestamos Empleados | Non-operating | Employee loan repayment, not revenue |
| I-04 | Cheque devuelto | Non-operating | Returned check reversal, not revenue |
| I-05 | Intereses Bancarios | Non-operating | Bank interest — same family as the existing Intereses exclusion on the expense side |
| I-06 | Retencion Ahorro Vendedores | Non-operating | Payroll withholding pass-through |
| I-07 | Seguros Prepagados | Non-operating | Prepaid insurance movement |
| I-09 | Prestamos Bancarios | Non-operating | Loan proceeds, not revenue |
| I-10 | NO USAR Reverso Bco. Provincial | Non-operating | Explicitly marked "do not use" / reversal |
| I-11 | Banco Bolivar | Non-operating | Bank account movement, not revenue |
| I-12 | Compra de Divisas Bco. Bolivar | Non-operating | FX purchase |
| I-13 | Venta de Divisas | Non-operating | FX sale |
| I-14 | Inicio Cta Cyman | Non-operating | Account opening balance |
| I-15 | Prestamo GMAC | Non-operating | Loan proceeds |
| I-16 | Otros Bancarios (Reintegro de ITF) | Non-operating | Bank fee reimbursement |
| I-17 | Ingresos por Alquiler Galpon | Non-operating | Non-core rental income (per user direction 2026-09-14: keep operating income to I-01 only) |
| I-18 | Cuentas por cobrar Gerencia | Non-operating | Internal receivable |
| I-19 | Cuentas por Cobrar Empleados | Non-operating | Employee receivable |
| I-20 | DEPOSITO EN GARANTIA | Non-operating | Security deposit |
| I-21, I-23–I-27 | Venta de Activo (various) | Non-operating | Fixed-asset disposals, not operating revenue |
| I-22 | Intereses sobre Prestamos empleados | Non-operating | Interest income on employee loans |
| I-28 | BANCO VENEZOLANO E CREDITO | Non-operating | Bank account movement |
| I-29 | Cuentas por cobrar Proveedores | Non-operating | Internal receivable |
| I-30 | Ajustes Profit | Non-operating | System adjustment entry |
| I-31 | Cuentas por cobrar terceros | Non-operating | Internal receivable |
| I-32 | Impuesto a las transacciones financieras (Clientes) | Non-operating | Tax pass-through collected from clients |

All non-`I-01` `Ingreso` rows get `Category = 'Otros'` (reusing the existing
`Otros` bucket, not a new income-specific category set — no income breakdown
table is planned, so there's nothing to group them by). `I-01` gets
`Category = 'VentasOperativas'` so it's identifiable in the source data
independent of the API query (`Category` is a plain descriptive column here,
not exposed as its own UI breakdown row).

`Load_Dim_ExpenseConcept`'s existing `IsExcludedFromEbitda` derivation
(`CASE WHEN seed.Category IN ('Intereses', 'Impuestos') THEN 1 ELSE 0 END`)
does not cover this — that CASE only ever looks at `Gasto`-side categories.
The migration adds `I-01` as `Category = 'VentasOperativas'`, and updates the
`CASE` to `WHEN seed.Category IN ('Intereses', 'Impuestos') THEN 1 WHEN
seed.ConceptType = 'Ingreso' AND seed.Category <> 'VentasOperativas' THEN 1
ELSE 0 END` so every non-Ventas income row is excluded automatically instead
of needing 30 individual seed rows each hand-flagged. Since
`CREATE OR ALTER PROCEDURE dwh.Load_Dim_ExpenseConcept` already exists,
0023 issues a new `CREATE OR ALTER` for it (never edits 0017's file).

### 3.3 Sign convention (verified live 2026-09-14)

`Amount = monto_d - monto_h`. For `Gasto` rows this is already
positive-as-expense (spot-checked E-01, E-212, E-211: all positive). For
`Ingreso` rows it is **negative** (I-01 Ventas: -65,957,202 over the
verification window) since income entries are credit-heavy. The API layer
must negate `Ingreso`-side sums before adding them (§4) — `Fact_CashMovements`
itself stores the raw signed `monto_d - monto_h` value unchanged, no sign
flip at load time, so the table's `Amount` column keeps one consistent
meaning ("debit minus credit") regardless of concept type.

## 4. API Layer (`app/api/dwh/finanzas/route.ts`)

New queries, replacing the current `utilidadBruta - gastosOperativos` EBITDA
calc:

```sql
-- Operating income (I-01 only, via IsExcludedFromEbitda = 0 AND ConceptType = 'Ingreso')
SELECT SUM(-fe.Amount) AS IngresosOperativos   -- negated, see §3.3
FROM fact.Fact_CashMovements fe
JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Ingreso' AND ec.IsExcludedFromEbitda = 0 {dateWhere}
```

The existing `expenseCategoryQuery`/`excludedExpenseQuery` stay as they are
today (already correctly scoped to `Gasto`-only via the join, since
`IsExcludedFromEbitda`/`Category` values for `Ingreso` rows never overlap
with the `Gasto` category taxonomy) — no change needed there beyond the
table rename.

`FinanzasResponse` (`app/(app)/analitica/types.ts`) gets a new top-level
block, fully decoupled from `waterfall`:

```ts
export interface CashFlowEbitda {
  ingresosOperativos: number;
  gastosOperativos: number;
  ebitda: number;
  intereses: number;
  impuestos: number;
  utilidadNeta: number;
}

export interface FinanzasResponse {
  waterfall: FinanzasWaterfallStep[];      // unchanged: Bruto…Utilidad Bruta only
  cashFlowEbitda: CashFlowEbitda;          // new
  expenseBreakdown: ExpenseCategoryRow[];  // unchanged
  usdRate: number | null;
}
```

The old top-level `ebitda`/`intereses`/`impuestos`/`utilidadNeta` fields and
the five EBITDA-related waterfall steps (`Gastos Operativos`, `EBITDA
(aprox.)`, `Intereses`, `Impuestos`, `Utilidad Neta`) are removed from
`waterfall` — they move into `cashFlowEbitda` with the same names
(`intereses`, `impuestos`, `utilidadNeta`) unchanged in meaning, just sourced
from movimientos instead of `Fact_Expenses`'s old Gasto-only query.

## 5. Frontend (`app/(app)/analitica/tabs/tab-finanzas.tsx`)

- Sales waterfall chart/KPIs (Ventas brutas, Ventas netas, Utilidad bruta,
  Margen bruto) stay exactly as today, reading `data.waterfall` — still
  useful for revenue/discount visibility.
- New card, "EBITDA (movimientos de caja)", placed below the sales waterfall
  card and above "Gastos operativos por categoría": a small waterfall or KPI
  row driven by `data.cashFlowEbitda` — Ingresos Operativos → Gastos
  Operativos → EBITDA → Intereses → Impuestos → Utilidad Neta. Same
  KpiCard/ChartCard components, no new UI primitives needed.
- `EBITDA_TOOLTIP` copy stays accurate as-is ("No incluye ajuste por
  depreciación/amortización — no disponible en los datos de movimientos
  bancarios") — it already anticipated a movimientos-based EBITDA.
- The `EBITDA (aprox.)` / `Intereses` / `Impuestos` / `Utilidad Neta` steps
  are removed from `COST_STEPS`/the waterfall chart's step list since
  they're no longer part of `waterfall` (see §4).

## 6. Cleanup (rename fallout)

Every reference to the old name must move in the same change — nothing is
left half-migrated:

- `app/api/dwh/finanzas/route.ts` — all `fact.Fact_Expenses` → `fact.Fact_CashMovements`.
- `app/api/dwh/lib/query-builder.ts` — comment listing fact tables read
  under `app/api/dwh/` (currently notes `Fact_Expenses` is read but not via
  the generic dimension mechanism) → update to `Fact_CashMovements`.
- `scripts/dwh-incremental-load.ts` — `EXEC dwh.Load_Fact_Expenses;` →
  `EXEC dwh.Load_Fact_CashMovements;`. This is the file that actually matters
  in production (SQL Agent is unavailable under SQLEXPRESS — confirmed by
  the user 2026-09-14 — so this script, not the SQL Agent job, is the real
  production ETL driver). Its header comment referencing "the SQL Agent job
  built by dwh-migrations 0013/0015/0016/0019/0022" is already stale (those
  files were deleted from the working tree for the same SQLEXPRESS reason,
  per the user) — leave that comment alone, it's out of scope for this
  change and the user has already made the call on those migration files.
- `docs/DATA_WAREHOUSE_GUIDE.md` — any `Fact_Expenses` mention (table
  reference list, health-check queries) → `Fact_CashMovements`. Also update
  §"Cost Data Gap" to cross-reference this new cash-basis EBITDA as the
  workaround now shipped, so the doc doesn't still read as an open gap with
  no mitigation.
- Search for and remove any now-dead `Fact_Expenses` string left after the
  above (`grep -rn "Fact_Expenses" --include="*.ts" --include="*.tsx"
  --include="*.sql" --include="*.md"` should return zero hits outside
  historical `docs/superpowers/plans/` and `specs/` files, which are
  point-in-time records and are never edited retroactively).
- No test file currently asserts against `Fact_Expenses`/`Load_Fact_Expenses`
  by name (`scripts/dwh/__tests__/sql-agent-jobs.test.ts`'s match was
  incidental, unrelated to this table) — confirmed live 2026-09-14, so no
  test rename is needed, but the plan's verification task should re-grep
  before considering cleanup done, in case that changes.

## 7. Non-goals

- Not fixing the underlying `Fact_Sales` cost-data gap (separate, larger
  initiative — establishing a costing process in Profit Plus upstream, per
  `docs/DATA_WAREHOUSE_GUIDE.md`'s existing "Action" recommendation).
- Not adding an income breakdown/drilldown table to the UI — `I-01` is a
  single line, and everything else is excluded, so there's nothing to
  drill into today. If that changes later (e.g. rental income becomes
  material), it's a new, separate feature.
- Not deleting `Fact_Sales`'s dead `UnitCost`/`COGSAmount`/`GrossProfitAmount`
  columns or the sales waterfall's `COGS`/`Utilidad Bruta` steps — they stay
  as latent plumbing for whenever real cost data arrives, per the existing
  design intent already documented in `0009_fact_sales.sql`.
