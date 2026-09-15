# Margen Operativo (Accrual) + Dashboard Month/YTD Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Finanzas tab's cash-basis "Margen Operativo" (which understated real operating expense ~4.5x because Profit Plus records purchase invoices far more reliably than their bank settlement) with an accrual-basis calculation sourced from `Fact_Sales`/`Fact_Returns`/`Fact_Purchases`, backed by a durable `dwh.vw_GastosOperativos` view; add a `Comisiones` category carve-out; make every Gastos Operativos category (including the new `Compras`) drillable; and replace the dashboard-wide `30d`/`90d` rolling-window date filters with calendar-month and year-to-date navigation.

**Architecture:** A new SQL view (`dwh.vw_GastosOperativos`) unions `Fact_Purchases` (as category `Compras`) with the existing non-`MateriaPrima` `Fact_CashMovements` Gasto rows, becoming the single durable definition of "operating expense" that `app/api/dwh/finanzas/route.ts` queries instead of hand-assembling the union. The route's income side moves from cash-ledger `I-01` to `Fact_Sales.NetAmount − Fact_Returns.NetAmount`. The shared date-range picker (`analitica-client.tsx`) and its sole interpreter (`buildDateWhereClause`) gain two new `DateRange` string forms (`month:YYYY-MM`, `ytd:YYYY`) that every tab picks up for free, replacing `30d`/`90d`.

**Tech Stack:** SQL Server (T-SQL migrations under `dwh-migrations/`), Next.js API routes, React, Bun test (`bun:test`), Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-09-15-margen-operativo-accrual-design.md`

## Global Constraints

- Never edit an existing numbered migration file — every change is a new file. Migrations `0023`/`0024`/`0025` have already run in production; this plan only adds `0026`.
- Every migration must be idempotent (`IF NOT EXISTS` / `CREATE OR ALTER` / `CREATE OR ALTER VIEW`), multi-batch DDL separated by a line containing only `GO`.
- Never hardcode "no data before 2026" or any other installation-specific date boundary anywhere in code — an out-of-range `month:`/`ytd:` filter must return an empty/zero result mechanically via `WHERE DateKey BETWEEN ...`, never a special-cased check.
- `dwh.vw_GastosOperativos` stays lean: `DateKey`, `Category`, `Amount`, `SourceFact` only — no `ConceptCode`/`ConceptName`/`CostCenter`. The per-concept drilldown for `Fact_CashMovements`-sourced categories keeps querying `Fact_CashMovements` directly; only the new `Compras` category's drilldown queries `Fact_Purchases` (by supplier, reusing `getDimensionSpec('proveedor')`).
- `30d`/`90d` are removed dashboard-wide (every Analitica tab, not just Finanzas) and replaced by `Mes Actual | Mes Anterior | Año Actual | 12 meses | Personalizado`. `12m` and `custom:start:end` are unchanged.
- The local DWH is a shared SQL Server instance — run DWH-touching test files one at a time (`bun test path/to/one.test.ts --env-file=.env.local`), never the full `bun run test` batch (causes lock contention, a known pre-existing environment characteristic, not a code defect).
- If a shell `git` command in a worktree hits a safety-check false positive on plain `git`, prefix with `command git`.

---

## Task 1: `dwh.vw_GastosOperativos` view + `Comisiones` category carve-out

**Files:**
- Create: `dwh-migrations/0026_gastos_operativos_view.sql`
- Test: `scripts/dwh/__tests__/vw-gastos-operativos.test.ts`

**Interfaces:**
- Produces: `dwh.vw_GastosOperativos` (columns: `DateKey int`, `Category varchar(20)`, `Amount decimal(18,2)`, `SourceFact varchar(20)`), and four `dim.ExpenseConceptSeed`/`dim.Dim_ExpenseConcept` rows (`E-217`, `E-213`, `134`, `E-111`) reclassified to `Category = 'Comisiones'`. Task 2 queries this view for `expenseCategoryQuery`.

- [ ] **Step 1: Write the migration file**

Create `dwh-migrations/0026_gastos_operativos_view.sql`:

```sql
-- Reclassifies four already-counted, already-IsExcludedFromEbitda=0
-- commission concepts into their own 'Comisiones' category so they're
-- visible as their own row in the Gastos Operativos breakdown instead of
-- buried inside Nomina/Otros. Pure re-labeling -- no concept's
-- inclusion/exclusion changes. E-217's existing CostCenter = 'Ventas'
-- (set by 0024_nomina_cost_center.sql) is left untouched.
UPDATE dim.ExpenseConceptSeed SET Category = 'Comisiones' WHERE ConceptCode IN ('E-217', 'E-213', '134', 'E-111');
GO

-- Load_Dim_ExpenseConcept needs no changes: it already carries seed.Category
-- through generically (see 0025_exclude_nonoperating_otros.sql's MERGE), and
-- IsExcludedFromEbitda's CASE only checks Category values that mean
-- "non-operating" (Intereses/Impuestos/DiferencialCambiario) or ConceptCode
-- '129' -- 'Comisiones' triggers neither branch, so these four concepts stay
-- IsExcludedFromEbitda = 0 exactly as they already were under Nomina/Otros.
-- This migration does NOT EXEC dwh.Load_Dim_ExpenseConcept itself (unlike
-- every other migration in this project, migrations never invoke Load_*
-- procedures directly -- that requires a live Ncake_a connection, which may
-- not be available in every context bun run migrate:dwh runs in, and would
-- block this migration's own CREATE VIEW statement below on an unrelated
-- cross-database dependency). The reclassification takes effect on the next
-- scheduled incremental load, same as every prior seed UPDATE in this
-- project (0025 included).
--
-- Durable, single definition of "real operating expense" spanning both fact
-- tables that can produce one -- see docs/superpowers/specs/
-- 2026-09-15-margen-operativo-accrual-design.md section 2.2. Investigated
-- live 2026-09-15: fact.Fact_Purchases.NetAmount (accrual, ~32.6M/90d) is
-- ~4.5x fact.Fact_CashMovements' MateriaPrima category (cash, ~7.26M/90d) --
-- Profit Plus records purchase invoices reliably but not their eventual
-- bank settlement promptly. Only ~3% of MateriaPrima bank movements
-- (verified via saMovimientoBanco.cob_pag -> saPago.cob_num ->
-- saPagoDocReng.nro_fact -> saFacturaCompra.nro_fact) trace to an
-- already-invoiced purchase -- not enough to safely deduplicate, so
-- MateriaPrima is fully replaced by Fact_Purchases here, not merged with it.
--
-- CREATE OR ALTER VIEW requires being the only statement in its batch, so
-- this is the last statement before the final GO.
CREATE OR ALTER VIEW dwh.vw_GastosOperativos AS
    SELECT fp.DateKey, 'Compras' AS Category, fp.NetAmount AS Amount, 'Fact_Purchases' AS SourceFact
    FROM fact.Fact_Purchases fp
    WHERE fp.IsVoided = 0

    UNION ALL

    SELECT fe.DateKey, ec.Category, fe.Amount, 'Fact_CashMovements' AS SourceFact
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.IsExcludedFromEbitda = 0
      AND ec.Category <> 'MateriaPrima';
GO
```

- [ ] **Step 2: Apply the migration and verify it runs cleanly**

Run: `bun run migrate:dwh`
Expected: no errors; `0026_gastos_operativos_view.sql` recorded in `dwh.__dwh_migrations`.

- [ ] **Step 3: Write the failing test**

Create `scripts/dwh/__tests__/vw-gastos-operativos.test.ts`:

```typescript
// scripts/dwh/__tests__/vw-gastos-operativos.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

function testConfig(database: string): sql.config {
  return {
    server: process.env.DW_SERVER ?? process.env.DB_SERVER!,
    port: parseInt(process.env.DW_PORT ?? process.env.DB_PORT ?? '1433'),
    database,
    user: process.env.DW_USER ?? process.env.DB_USER!,
    password: process.env.DW_PASSWORD ?? process.env.DB_PASSWORD!,
    options: {
      encrypt: (process.env.DW_ENCRYPT ?? process.env.DB_ENCRYPT) === 'true',
      trustServerCertificate: (process.env.DW_TRUST_SERVER_CERT ?? process.env.DB_TRUST_SERVER_CERT) !== 'false',
    },
  };
}

describe('dwh.vw_GastosOperativos', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    await pool.request().execute('dwh.Load_Dim_Product');
    await pool.request().execute('dwh.Load_Dim_SalesRep');
    await pool.request().execute('dwh.Load_Dim_Warehouse');
    await pool.request().execute('dwh.Load_Dim_ExpenseConcept');
    await pool.request().execute('dwh.Load_Dim_Supplier');
    await pool.request().execute('dwh.Load_Fact_Purchases');
    await pool.request().execute('dwh.Load_Fact_CashMovements');
  });

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('four commission concepts are reclassified to Category = Comisiones, IsExcludedFromEbitda unchanged (0)', async () => {
    const result = await pool.request().query(`
      SELECT ConceptCode, Category, IsExcludedFromEbitda
      FROM dim.Dim_ExpenseConcept
      WHERE ConceptCode IN ('E-217', 'E-213', '134', 'E-111')
    `);
    expect(result.recordset.length).toBe(4);
    for (const row of result.recordset) {
      expect(row.Category).toBe('Comisiones');
      expect(row.IsExcludedFromEbitda).toBe(false);
    }
  });

  test('E-217 keeps its CostCenter = Ventas after reclassification', async () => {
    const result = await pool.request().query(`
      SELECT CostCenter FROM dim.Dim_ExpenseConcept WHERE ConceptCode = 'E-217'
    `);
    expect(result.recordset[0].CostCenter).toBe('Ventas');
  });

  test('the view contains Compras rows sourced from Fact_Purchases', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dwh.vw_GastosOperativos WHERE Category = 'Compras' AND SourceFact = 'Fact_Purchases'
    `);
    const fpCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Purchases WHERE IsVoided = 0`);
    expect(Number(result.recordset[0].total)).toBe(Number(fpCount.recordset[0].total));
  });

  test('the view never contains MateriaPrima (replaced by Compras, not merged)', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dwh.vw_GastosOperativos WHERE Category = 'MateriaPrima'
    `);
    expect(Number(result.recordset[0].total)).toBe(0);
  });

  test('the view never contains Intereses/Impuestos/DiferencialCambiario (excluded by definition)', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM dwh.vw_GastosOperativos
      WHERE Category IN ('Intereses', 'Impuestos', 'DiferencialCambiario')
    `);
    expect(Number(result.recordset[0].total)).toBe(0);
  });

  test('the view sums to the same total as the two source queries combined', async () => {
    const viewTotal = await pool.request().query(`SELECT SUM(Amount) AS total FROM dwh.vw_GastosOperativos`);
    const purchasesTotal = await pool.request().query(`SELECT SUM(NetAmount) AS total FROM fact.Fact_Purchases WHERE IsVoided = 0`);
    const cashTotal = await pool.request().query(`
      SELECT SUM(fe.Amount) AS total
      FROM fact.Fact_CashMovements fe
      JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
      WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.IsExcludedFromEbitda = 0 AND ec.Category <> 'MateriaPrima'
    `);
    const expected = Number(purchasesTotal.recordset[0].total ?? 0) + Number(cashTotal.recordset[0].total ?? 0);
    expect(Number(viewTotal.recordset[0].total ?? 0)).toBeCloseTo(expected, 2);
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test scripts/dwh/__tests__/vw-gastos-operativos.test.ts --env-file=.env.local`
Expected: PASS (6/6). If a `beforeAll`/`afterAll` hook times out with a shared-SQL-Server contention error, retry the same command alone.

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0026_gastos_operativos_view.sql scripts/dwh/__tests__/vw-gastos-operativos.test.ts
git commit -m "feat: add dwh.vw_GastosOperativos view, Comisiones category carve-out"
```

---

## Task 2: Finanzas route — accrual Ingresos/Gastos, view-backed category query, Compras drilldown

**Files:**
- Modify: `app/api/dwh/finanzas/route.ts`
- Modify: `app/(app)/analitica/types.ts:194-201` (the `CashFlowEbitda` interface)
- Test: `app/api/dwh/finanzas/__tests__/route.test.ts` (already exists — verify still passes, no new assertions needed since it only checks the auth gate)

**Interfaces:**
- Consumes: `dwh.vw_GastosOperativos` (Task 1), `getDimensionSpec('proveedor')` from `app/api/dwh/lib/query-builder.ts` (already exists, `validFacts: ['purchases']`).
- Produces: `FinanzasResponse.cashFlowEbitda` keeps its existing 6 field names (`ingresosOperativos`, `gastosOperativos`, `ebitda`, `intereses`, `impuestos`, `utilidadNeta`) — same shape, new source data underneath, so `tab-finanzas.tsx` (Task 3) needs no field-name changes, only copy/label changes it already has from the prior "Margen Operativo" rename. `conceptBreakdownQuery`'s response `BreakdownRow` shape is unchanged (`{ label, value, amount, costCenter? }`) — Compras rows just never carry `costCenter` (only ever set when `parentValue === 'Nomina'`, unaffected by this task).

- [ ] **Step 1: Write the failing test additions**

The existing `app/api/dwh/finanzas/__tests__/route.test.ts` only asserts the 401 auth gate — that stays valid and requires no changes for this task (this route's data-shape behavior is verified by the DWH-level test in Task 1 plus the E2E test in Task 4, matching this project's established thin-route-test convention). No new test file for this task; Step 6 below re-runs the existing one to confirm nothing broke.

- [ ] **Step 2: Update `CashFlowEbitda`'s field semantics comment in `types.ts`**

In `app/(app)/analitica/types.ts`, the `CashFlowEbitda` interface (lines 194-201) keeps its exact shape — no field renamed, added, or removed. No code change needed in this file for this task.

- [ ] **Step 3: Rewrite `app/api/dwh/finanzas/route.ts`**

Replace the whole file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec } from '@/app/api/dwh/lib/query-builder';
import type { FinanzasResponse, FinanzasWaterfallStep, ExpenseCategoryRow } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.
//
// COGSAmount/GrossProfitAmount are nullable on fact.Fact_Sales (populated only
// once a cost source is available — see dwh-migrations/0009_fact_sales.sql,
// CostSourceFlag = 'NO_COST_DATA' otherwise), so they're ISNULL-wrapped before
// summing to avoid a NULL total wiping out the whole aggregate. utilidadBruta
// stays 0 today — only the sales waterfall uses it, for revenue/discount-rate
// visibility; Margen Operativo below is computed independently (see
// docs/superpowers/specs/2026-09-15-margen-operativo-accrual-design.md).

function waterfallTotalsQuery(dateWhere: string): string {
  return `
    SELECT
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      SUM(fs.NetAmount) AS NetAmount,
      SUM(ISNULL(fs.COGSAmount, 0)) AS COGSAmount,
      SUM(ISNULL(fs.GrossProfitAmount, 0)) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    WHERE fs.IsVoided = 0 ${dateWhere}
  `;
}

// Ingresos Netos for Margen Operativo: Fact_Sales.NetAmount minus
// Fact_Returns.NetAmount. NOT the same number as the waterfall's own "Neto"
// step above (that's gross minus discount only — Fact_Returns is never
// subtracted there, a separate, pre-existing gap this migration doesn't
// address). Mirrors app/api/dwh/devoluciones/route.ts's existing
// Fact_Returns query shape (SUM(fr.NetAmount), fr.IsVoided = 0).
function salesNetQuery(dateWhere: string): string {
  return `
    SELECT ISNULL(SUM(fs.NetAmount), 0) AS SalesNet
    FROM fact.Fact_Sales fs
    WHERE fs.IsVoided = 0 ${dateWhere}
  `;
}

function returnsNetQuery(dateWhere: string): string {
  return `
    SELECT ISNULL(SUM(fr.NetAmount), 0) AS ReturnsNet
    FROM fact.Fact_Returns fr
    WHERE fr.IsVoided = 0 ${dateWhere}
  `;
}

// Gastos Operativos by category, now sourced from the durable
// dwh.vw_GastosOperativos view (0026_gastos_operativos_view.sql) instead of
// hand-assembling the Fact_Purchases + Fact_CashMovements union here — the
// view is the single place "what counts as a real operating expense" is
// defined, so this query has no business-rule logic of its own beyond the
// date filter. The view has no fact-table alias of its own (it's a UNION
// ALL of two differently-aliased sources internally), so it's given the
// alias 'v' here — the caller must build dateWhere with buildDateWhereClause(dateRange, 'v'),
// not 'fe' or 'fp'.
function expenseCategoryQuery(dateWhere: string): string {
  return `
    SELECT v.Category, SUM(v.Amount) AS TotalAmount
    FROM dwh.vw_GastosOperativos v
    WHERE 1 = 1 ${dateWhere}
    GROUP BY v.Category
    ORDER BY TotalAmount DESC
  `;
}

// Intereses/Impuestos, kept separate from Gastos Operativos so Margen
// Operativo can exclude them per definition. These never appear in
// dwh.vw_GastosOperativos (the view's WHERE clause already excludes
// IsExcludedFromEbitda = 1 rows), so this stays a direct Fact_CashMovements
// query, unchanged from before.
function excludedExpenseQuery(dateWhere: string): string {
  return `
    SELECT ec.Category, SUM(fe.Amount) AS TotalAmount
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.IsExcludedFromEbitda = 1 ${dateWhere}
    GROUP BY ec.Category
  `;
}

// Concept-level drilldown for a Fact_CashMovements-sourced category
// (Nomina, Servicios, Mantenimiento, Alquileres, Publicidad, Honorarios,
// Otros, Comisiones — every Gastos Operativos category except Compras).
// CostCenter is only ever non-NULL for Category = 'Nomina' concepts (see
// 0024_nomina_cost_center.sql).
function conceptBreakdownQuery(dateWhere: string): string {
  return `
    SELECT TOP 15 ec.ConceptName AS GroupLabel, ec.ConceptCode AS GroupValue, SUM(fe.Amount) AS Amount, ec.CostCenter AS CostCenter
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.Category = @category ${dateWhere}
    GROUP BY ec.ConceptName, ec.ConceptCode, ec.CostCenter
    ORDER BY Amount DESC
  `;
}

// Concept-level drilldown for the Compras category specifically — Compras
// has no Fact_CashMovements equivalent (a purchase invoice has no
// bank-movement ConceptCode), so it drills into supplier instead, reusing
// the same getDimensionSpec('proveedor') mechanism app/api/dwh/compras/
// route.ts's own proveedorQuery already uses.
function comprasSupplierBreakdownQuery(dateWhere: string): string {
  const spec = getDimensionSpec('proveedor');
  return `
    SELECT TOP 15 ${spec.labelExpr} AS GroupLabel, ${spec.valueExpr} AS GroupValue, SUM(fp.NetAmount) AS Amount
    FROM fact.Fact_Purchases fp
    ${spec.joinClause.replace(/\bf\b/g, 'fp')}
    WHERE fp.IsVoided = 0 ${dateWhere}
    GROUP BY ${spec.groupByColumn.replace(/\bf\b/g, 'fp')}
    ORDER BY Amount DESC
  `;
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const breakdownByParam = searchParams.get('breakdownBy');
  const parentValue = searchParams.get('parentValue');

  try {
    const pool = await getDwhPool();

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
    const expenseDateWhere = buildDateWhereClause(dateRange, 'fe');
    // dwh.vw_GastosOperativos is queried with alias 'v' (see
    // expenseCategoryQuery above) — a separate date-where from
    // purchasesDateWhere below, which uses 'fp' against Fact_Purchases
    // directly for the Compras supplier drilldown. Two different aliases
    // for two different queries against two different things (a view vs.
    // a real table), not a duplicate to collapse.
    const gastosViewDateWhere = buildDateWhereClause(dateRange, 'v');
    const purchasesDateWhere = buildDateWhereClause(dateRange, 'fp');

    if (breakdownByParam === 'concepto' && parentValue) {
      if (parentValue === 'Compras') {
        const result = await pool.request().query(comprasSupplierBreakdownQuery(purchasesDateWhere));
        return NextResponse.json({
          breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), amount: Number(r.Amount) })),
        });
      }
      const req = pool.request();
      req.input('category', parentValue);
      const result = await req.query(conceptBreakdownQuery(expenseDateWhere));
      const isNomina = parentValue === 'Nomina';
      return NextResponse.json({
        breakdown: result.recordset.map(r => ({
          label: r.GroupLabel,
          value: String(r.GroupValue),
          amount: Number(r.Amount),
          ...(isNomina ? { costCenter: r.CostCenter ? String(r.CostCenter) : 'Sin clasificar' } : {}),
        })),
      });
    }

    const [totals, salesNetResult, returnsNetResult, categoryResult, excludedResult, usdRate] = await Promise.all([
      pool.request().query(waterfallTotalsQuery(salesDateWhere)),
      pool.request().query(salesNetQuery(salesDateWhere)),
      pool.request().query(returnsNetQuery(returnsDateWhere)),
      pool.request().query(expenseCategoryQuery(gastosViewDateWhere)),
      pool.request().query(excludedExpenseQuery(expenseDateWhere)),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

    const row = totals.recordset[0] ?? {
      GrossAmount: 0,
      DiscountAmount: 0,
      NetAmount: 0,
      COGSAmount: 0,
      GrossProfitAmount: 0,
    };

    const grossAmount = Number(row.GrossAmount);
    const discountAmount = Number(row.DiscountAmount);
    const netAmount = Number(row.NetAmount);
    const cogsAmount = Number(row.COGSAmount);
    const grossProfitAmount = Number(row.GrossProfitAmount);

    const waterfall: FinanzasWaterfallStep[] = [
      { step: 'Bruto', amount: grossAmount, cumulative: grossAmount },
      { step: 'Descuento', amount: -discountAmount, cumulative: grossAmount - discountAmount },
      { step: 'Neto', amount: netAmount, cumulative: netAmount },
      { step: 'COGS', amount: -cogsAmount, cumulative: netAmount - cogsAmount },
      { step: 'Utilidad Bruta', amount: grossProfitAmount, cumulative: grossProfitAmount },
    ];

    const expenseBreakdown: ExpenseCategoryRow[] = categoryResult.recordset.map(r => ({
      category: String(r.Category),
      amount: Number(r.TotalAmount),
    }));

    const gastosOperativos = expenseBreakdown.reduce((sum, r) => sum + r.amount, 0);
    const intereses = Number(excludedResult.recordset.find(r => r.Category === 'Intereses')?.TotalAmount ?? 0);
    const impuestos = Number(excludedResult.recordset.find(r => r.Category === 'Impuestos')?.TotalAmount ?? 0);

    const salesNet = Number(salesNetResult.recordset[0]?.SalesNet ?? 0);
    const returnsNet = Number(returnsNetResult.recordset[0]?.ReturnsNet ?? 0);
    const ingresosOperativos = salesNet - returnsNet;

    // Margen Operativo (accrual-basis, replaces the prior cash-basis calc —
    // see docs/superpowers/specs/2026-09-15-margen-operativo-accrual-design.md
    // section 2.1): Ingresos Netos (Fact_Sales minus Fact_Returns) minus
    // Gastos Operativos (dwh.vw_GastosOperativos: Fact_Purchases "Compras"
    // plus non-MateriaPrima Fact_CashMovements Gasto categories).
    const ebitda = ingresosOperativos - gastosOperativos;
    const utilidadNeta = ebitda - intereses - impuestos;

    const response: FinanzasResponse = {
      waterfall,
      cashFlowEbitda: {
        ingresosOperativos,
        gastosOperativos,
        ebitda,
        intereses,
        impuestos,
        utilidadNeta,
      },
      expenseBreakdown,
      usdRate,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero errors from `app/api/dwh/finanzas/route.ts`; only the pre-existing unrelated 5 errors in `__tests__/integration/inventory-change-unit.integration.test.ts` remain.

- [ ] **Step 5: Manually verify against the live local dev DWH**

Create a throwaway script (do not commit) that connects via `buildConfig(dwhDatabaseName())` from `scripts/migrate-dwh.ts` and runs `expenseCategoryQuery`/`salesNetQuery`/`returnsNetQuery`/`comprasSupplierBreakdownQuery` (with a `WHERE fe.DateKey >= 20250101` — or whatever your local dev DWH's real data range is, check via `SELECT MAX(DateKey) FROM fact.Fact_Sales`) directly against the DWH to sanity-check the numbers are plausible (Ingresos should be a large positive number close to `Fact_Sales.NetAmount`'s total for the window; Gastos Operativos should now include a `Compras` row roughly matching `Fact_Purchases.NetAmount`'s total). Delete the script when done — this step is manual verification, not a committed test (Task 1's DWH-level test and Task 4's E2E test are the durable coverage).

- [ ] **Step 6: Run the existing route test**

Run: `bun test app/api/dwh/finanzas/__tests__/route.test.ts --env-file=.env.local`
Expected: PASS (1/1) — the file is unchanged by this task, this just confirms nothing broke.

- [ ] **Step 7: Commit**

```bash
git add app/api/dwh/finanzas/route.ts
git commit -m "feat: compute Margen Operativo from accrual sources (Fact_Sales/Returns/Purchases)"
```

---

## Task 3: Finanzas tab — Compras drilldown works, copy stays accurate

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-finanzas.tsx`

**Interfaces:**
- Consumes: `FinanzasResponse.expenseBreakdown` (now includes a `Compras` row from Task 2), `handleFetchCategoryBreakdown` (already generic — calls the same endpoint regardless of category, Task 2's route branches server-side on `parentValue === 'Compras'`).

- [ ] **Step 1: Confirm no frontend code change is actually required for the Compras drilldown to work**

Read the current `handleFetchCategoryBreakdown` in `tab-finanzas.tsx` (around line 215):

```typescript
async function handleFetchCategoryBreakdown(parentValue: string): Promise<BreakdownRow[]> {
  const params = new URLSearchParams({ dateRange, currency, breakdownBy: 'concepto', parentValue });
  const res = await fetch(`/api/dwh/finanzas?${params.toString()}`);
  if (!res.ok) return [];
  const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
  return body.breakdown ?? [];
}
```

This already passes `parentValue` through unconditionally — when a user expands the "Compras" row, `parentValue` will be `"Compras"`, which Task 2's route already branches on server-side. `GroupedDrilldownTable`'s row-rendering (§ already read: renders every key except `label`/`value` as a column via `formatBreakdownMetric`) needs no change either — a Compras breakdown row is `{ label, value, amount }` with no `costCenter` key, same shape every non-Nomina category's breakdown rows already have. **No code change in this file for this step** — this is a verification step, not a modification.

- [ ] **Step 2: Update the "Gastos operativos por categoría" table's subtitle to mention Compras explicitly**

In `tab-finanzas.tsx`, find:

```tsx
        <p className="text-xs text-gray-500 mb-3">
          Desglose de egresos operativos por categoría, con detalle por concepto
        </p>
```

Change to:

```tsx
        <p className="text-xs text-gray-500 mb-3">
          Desglose de egresos operativos por categoría, con detalle por concepto (o por proveedor en Compras)
        </p>
```

- [ ] **Step 3: Update `MARGIN_TOOLTIP` to reflect the accrual change**

The current tooltip (lines 16-27) explains why the metric isn't labeled "EBITDA" (cost-center gap) but its wording still describes the OLD cash-basis calc ("Ingresos y gastos operativos desde movimientos bancarios/caja"). Replace the comment and tooltip string:

```tsx
// Not labeled "EBITDA" — investigated 2026-09-14 whether Gastos Operativos
// could be split by cost center (to isolate production cost, a prerequisite
// for a real EBITDA/margin figure) and found the source data can't support
// it for Nomina specifically (see docs/DATA_WAREHOUSE_GUIDE.md's Cost Data
// Gap section) — concept-name keywords cover only 6.6% of Nomina volume by
// amount. So this is a real operating margin, not EBITDA: it does not
// isolate production payroll from admin/sales payroll, on top of the
// pre-existing D&A gap. As of 2026-09-15 the calc itself moved to accrual
// sources (Fact_Sales/Fact_Returns for income, Fact_Purchases + non-payroll
// cash-ledger categories for expense — see docs/superpowers/specs/
// 2026-09-15-margen-operativo-accrual-design.md) instead of the pure
// cash-ledger calc this tooltip used to describe.
const MARGIN_TOOLTIP = 'Ingresos netos (ventas menos devoluciones) menos gastos operativos (compras más nómina y otros gastos desde movimientos bancarios/caja). No aísla la nómina de producción (~93% de la nómina no tiene centro de costo identificable en el origen) ni incluye ajuste por depreciación/amortización.';
```

- [ ] **Step 4: Type-check and start the dev server to visually verify**

Run: `bunx tsc --noEmit` — expected zero new errors.

If a dev server is easy to start in your environment (`bun dev`, then navigate to `/analitica?tab=finanzas` with a logged-in admin session), verify: the "Gastos operativos por categoría" table now shows a "Compras" row; expanding it shows supplier names (not concept names); expanding "Comisiones" (new row) shows its 4 concepts; expanding "Nomina" still shows the cost-center column as before. If starting a dev server isn't practical, a careful JSX read-through plus the passing type-check is an acceptable substitute — note which you did.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/tabs/tab-finanzas.tsx"
git commit -m "feat: update Finanzas tab copy for accrual Margen Operativo and Compras drilldown"
```

---

## Task 4: E2E test — Compras/Comisiones drilldown, accrual income sanity check

**Files:**
- Modify: `e2e/analitica.spec.ts`

**Interfaces:**
- Consumes: the rendered Finanzas tab from Task 3.

- [ ] **Step 1: Add a new E2E test for the Compras and Comisiones drilldowns**

In `e2e/analitica.spec.ts`, after the existing `'Finanzas tab shows the Nomina cost-center split, including unclassified concepts'` test, add:

```typescript
  test('Finanzas tab drills Compras into suppliers and shows the Comisiones category', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=finanzas');
    await adminPage.getByLabel('Desglosar por:').selectOption('producto');

    const outerTable = adminPage.locator('table.min-w-full.text-sm').first();
    const outerRows = outerTable.locator(':scope > tbody > tr');
    await expect(outerRows.first()).toBeVisible({ timeout: 15_000 });

    // Comisiones must appear as its own category row (0026's carve-out) —
    // not merged into Nomina or Otros anymore.
    const comisionesRow = outerRows.filter({ has: adminPage.getByText('Comisiones', { exact: true }) });
    await expect(comisionesRow).toBeVisible();

    // Compras must appear as its own category row (Fact_Purchases, replacing
    // the old cash-ledger MateriaPrima category).
    const comprasRow = outerRows.filter({ has: adminPage.getByText('Compras', { exact: true }) });
    await expect(comprasRow).toBeVisible();

    // Expanding Compras drills into SUPPLIERS, not concepts — assert the
    // breakdown renders (same structural check as the Nomina test above;
    // this test's job is confirming the Compras branch doesn't error out
    // and renders rows, not asserting specific supplier names, which are
    // seed-data-dependent).
    await comprasRow.locator('button[aria-label="Expandir"]').click();
    const comprasBreakdownRows = comprasRow.locator('xpath=following-sibling::tr[1]').locator('table tbody tr');
    await expect(comprasBreakdownRows.first()).toBeVisible({ timeout: 15_000 });
  });

  test('Finanzas tab Margen Operativo reflects accrual Ingresos Netos, not cash-ledger income', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=finanzas');

    // Ingresos operativos (accrual, Fact_Sales - Fact_Returns) should now be
    // a much larger figure than the old cash-ledger I-01 total for the same
    // window — assert it's visible and non-zero (the E2E suite's seeded
    // Ncake_a data is smaller-scale than production, so this checks presence
    // and a sane order of magnitude, not an exact cross-environment number).
    await expect(adminPage.getByText('Margen Operativo (base caja)').or(adminPage.getByText('Margen Operativo'))).toBeVisible({ timeout: 15_000 });
    const ingresosCard = adminPage.locator('div', { has: adminPage.getByText('Ingresos operativos', { exact: true }) }).last();
    await expect(ingresosCard).toBeVisible();
    const ingresosText = await ingresosCard.textContent();
    expect(ingresosText).not.toContain('Bs. 0');
  });
```

- [ ] **Step 2: Update the DWH guide's caveat copy from the prior "EBITDA workaround" note**

In `docs/DATA_WAREHOUSE_GUIDE.md`, find the paragraph added by the 2026-09-14 work (search for `"Margen Operativo (base caja)" workaround`). Add a follow-up paragraph directly after it:

```markdown
**Accrual revision (2026-09-15):** the cash-ledger-only calculation above
understated real operating expense by ~4.5x (live-verified: 90-day cash-ledger
Gastos ~7.26M vs. `Fact_Purchases.NetAmount` ~32.6M for the same window) —
Profit Plus records purchase invoices reliably but not their eventual bank
settlement promptly. Margen Operativo now sources Ingresos from
`Fact_Sales.NetAmount − Fact_Returns.NetAmount` and Gastos Operativos from
`dwh.vw_GastosOperativos` (`dwh-migrations/0026_gastos_operativos_view.sql`),
a view unioning `Fact_Purchases` ("Compras") with non-`MateriaPrima`
`Fact_CashMovements` Gasto categories — see
`docs/superpowers/specs/2026-09-15-margen-operativo-accrual-design.md`.
```

- [ ] **Step 3: Run the new and existing Finanzas E2E tests**

Run (using Node 20+ if your default is older — `nvm use 20` first if needed): `bunx playwright test e2e/analitica.spec.ts -g "Finanzas tab"`
Expected: all Finanzas-related tests PASS (the pre-existing margin-card test, the pre-existing Nomina cost-center test, and the two new tests from Step 1).

- [ ] **Step 4: Run the full `analitica.spec.ts` file to confirm no regressions**

Run: `bunx playwright test e2e/analitica.spec.ts`
Expected: all tests PASS, including the Ventas/Devoluciones/Vendedores/Compras tests unrelated to this change.

- [ ] **Step 5: Commit**

```bash
git add e2e/analitica.spec.ts docs/DATA_WAREHOUSE_GUIDE.md
git commit -m "test: cover Compras/Comisiones drilldown and accrual Ingresos in Finanzas E2E"
```

---

## Task 5: Dashboard-wide month/YTD date-range navigation

**Files:**
- Modify: `app/api/dwh/lib/query-builder.ts`
- Modify: `app/(app)/analitica/analitica-client.tsx`
- Modify: `app/(app)/analitica/types.ts:1-6` (the `DateRange` comment)
- Test: `app/api/dwh/lib/__tests__/query-builder.test.ts`

**Interfaces:**
- Produces: `buildDateWhereClause` accepts `month:YYYY-MM` and `ytd:YYYY` in addition to the existing `'30d'|'90d'|'12m'|custom:start:end` forms (this task REMOVES `'30d'`/`'90d'` handling — see Step 3). Every tab that calls `buildDateWhereClause(dateRange, alias)` (already all of them, via their own routes) gets the new forms for free with no per-tab change, since `dateRange` is passed through as an opaque string end-to-end.

- [ ] **Step 1: Write the failing tests**

In `app/api/dwh/lib/__tests__/query-builder.test.ts`, add (the file currently only tests `getDimensionSpec`/`isDimension`/etc. — add a new `describe` block and the `buildDateWhereClause` import):

```typescript
import { describe, test, expect } from 'bun:test';
import { getDimensionSpec, isDimension, isDimensionForFact, isClienteDimension, buildDateWhereClause } from '../query-builder';

// ... (existing describe blocks unchanged) ...

describe('buildDateWhereClause', () => {
  test('month:YYYY-MM resolves to the first and last day of that month', () => {
    const clause = buildDateWhereClause('month:2026-02', 'fe');
    expect(clause).toBe('AND fe.DateKey >= 20260201 AND fe.DateKey <= 20260228');
  });

  test('month:YYYY-MM handles a 31-day month correctly', () => {
    const clause = buildDateWhereClause('month:2026-01', 'fe');
    expect(clause).toBe('AND fe.DateKey >= 20260101 AND fe.DateKey <= 20260131');
  });

  test('month:YYYY-MM handles a leap-year February correctly', () => {
    const clause = buildDateWhereClause('month:2024-02', 'fe');
    expect(clause).toBe('AND fe.DateKey >= 20240201 AND fe.DateKey <= 20240229');
  });

  test('ytd:YYYY for a past year spans the full calendar year', () => {
    const pastYear = new Date().getFullYear() - 1;
    const clause = buildDateWhereClause(`ytd:${pastYear}`, 'fe');
    expect(clause).toBe(`AND fe.DateKey >= ${pastYear}0101 AND fe.DateKey <= ${pastYear}1231`);
  });

  test('ytd:YYYY for the current year spans Jan 1 through today', () => {
    const currentYear = new Date().getFullYear();
    const todayKey = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    const clause = buildDateWhereClause(`ytd:${currentYear}`, 'fe');
    expect(clause).toBe(`AND fe.DateKey >= ${currentYear}0101 AND fe.DateKey <= ${todayKey}`);
  });

  test('30d and 90d are no longer recognized as rolling windows — they fall through to the 12m default', () => {
    // 30d/90d are removed from the UI (analitica-client.tsx) but the function
    // must not throw or silently mishandle a stale/bookmarked URL still
    // carrying one of these values — falling through to the 365-day (12m)
    // default is the safe, unsurprising behavior for a value this function
    // no longer specifically recognizes.
    const clause30 = buildDateWhereClause('30d', 'fe');
    const clause90 = buildDateWhereClause('90d', 'fe');
    const clause12m = buildDateWhereClause('12m', 'fe');
    expect(clause30).toBe(clause12m);
    expect(clause90).toBe(clause12m);
  });

  test('12m and custom:start:end are unchanged', () => {
    expect(buildDateWhereClause('custom:2026-01-01:2026-01-31', 'fe')).toBe(
      'AND fe.DateKey >= 20260101 AND fe.DateKey <= 20260131'
    );
    // 12m resolves relative to "now", so just check the shape/prefix rather
    // than a fixed value.
    expect(buildDateWhereClause('12m', 'fe')).toMatch(/^AND fe\.DateKey >= \d{8}$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test app/api/dwh/lib/__tests__/query-builder.test.ts`
Expected: FAIL on every new `month:`/`ytd:` test (function doesn't recognize these forms yet) and PASS on the unchanged `12m`/`custom` tests (already implemented). The `30d`/`90d` fallthrough test will currently FAIL too (today's code still special-cases `30d`/`90d` to real day counts, not the 12m default) — that's expected, Step 3 makes it pass by removing that special-casing.

- [ ] **Step 3: Implement `month:`/`ytd:` support and remove `30d`/`90d`**

In `app/api/dwh/lib/query-builder.ts`, replace:

```typescript
const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;

export function buildDateWhereClause(
  dateRange: string,
  tableName: string = 'f'
): string {
  const customMatch = CUSTOM_RANGE_RE.exec(dateRange);
  if (customMatch) {
    const [, start, end] = customMatch;
    const startKey = start.replace(/-/g, '');
    const endKey = end.replace(/-/g, '');
    return `AND ${tableName}.DateKey >= ${startKey} AND ${tableName}.DateKey <= ${endKey}`;
  }
  const days = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
  // Adjust based on your DateKey format (if YYYYMMDD or similar)
  return `AND ${tableName}.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -${days}, GETDATE()), 'yyyyMMdd'))`;
}
```

with:

```typescript
const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE_RE = /^month:(\d{4})-(\d{2})$/;
const YTD_RANGE_RE = /^ytd:(\d{4})$/;

function dateKey(d: Date): number {
  return parseInt(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  );
}

// No hardcoded "no data before <year>" or similar installation-specific
// boundary anywhere here — an out-of-range month/year simply produces a
// DateKey window a fact table has no matching rows in, which is the correct,
// portable behavior for any installation's actual data range (see
// docs/superpowers/specs/2026-09-15-margen-operativo-accrual-design.md
// section 2.5).
export function buildDateWhereClause(
  dateRange: string,
  tableName: string = 'f'
): string {
  const customMatch = CUSTOM_RANGE_RE.exec(dateRange);
  if (customMatch) {
    const [, start, end] = customMatch;
    const startKey = start.replace(/-/g, '');
    const endKey = end.replace(/-/g, '');
    return `AND ${tableName}.DateKey >= ${startKey} AND ${tableName}.DateKey <= ${endKey}`;
  }

  const monthMatch = MONTH_RANGE_RE.exec(dateRange);
  if (monthMatch) {
    const [, yearStr, monthStr] = monthMatch;
    const year = parseInt(yearStr);
    const month = parseInt(monthStr); // 1-indexed
    const startKey = dateKey(new Date(Date.UTC(year, month - 1, 1)));
    // Day 0 of the NEXT month is the last day of THIS month — this
    // automatically handles 28/29/30/31-day months and leap years without
    // a lookup table.
    const endKey = dateKey(new Date(Date.UTC(year, month, 0)));
    return `AND ${tableName}.DateKey >= ${startKey} AND ${tableName}.DateKey <= ${endKey}`;
  }

  const ytdMatch = YTD_RANGE_RE.exec(dateRange);
  if (ytdMatch) {
    const year = parseInt(ytdMatch[1]);
    const startKey = year * 10000 + 101; // YYYY0101
    const currentYear = new Date().getUTCFullYear();
    const endKey = year === currentYear
      ? parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''))
      : year * 10000 + 1231; // YYYY1231
    return `AND ${tableName}.DateKey >= ${startKey} AND ${tableName}.DateKey <= ${endKey}`;
  }

  // '30d'/'90d' were removed from the UI (analitica-client.tsx) in favor of
  // month/YTD navigation — any value this function doesn't otherwise
  // recognize (including a stale bookmarked '30d'/'90d' URL) falls through
  // to the 365-day default rather than throwing, so an old link degrades
  // gracefully instead of erroring.
  return `AND ${tableName}.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -365, GETDATE()), 'yyyyMMdd'))`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test app/api/dwh/lib/__tests__/query-builder.test.ts`
Expected: PASS, all tests including the pre-existing `getDimensionSpec`/`isDimension` ones (unaffected by this change).

- [ ] **Step 5: Update `analitica-client.tsx`'s date-range picker**

In `app/(app)/analitica/analitica-client.tsx`, replace the `DATE_RANGE_OPTIONS` constant, `isValidDateRange`, and the picker's button-rendering JSX.

Replace:

```typescript
const DATE_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: '12m', label: '12 meses' },
  { value: 'custom', label: 'Personalizado' },
];

const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;

function isValidDateRange(value: string | null): value is DateRange {
  if (value === '30d' || value === '90d' || value === '12m') return true;
  return value !== null && CUSTOM_RANGE_RE.test(value);
}
```

with:

```typescript
const DATE_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'month', label: 'Mes Actual' },
  { value: 'month-prev', label: 'Mes Anterior' },
  { value: 'ytd', label: 'Año Actual' },
  { value: '12m', label: '12 meses' },
  { value: 'custom', label: 'Personalizado' },
];

const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE_RE = /^month:(\d{4})-(\d{2})$/;
const YTD_RANGE_RE = /^ytd:(\d{4})$/;

function isValidDateRange(value: string | null): value is DateRange {
  if (value === '12m') return true;
  if (value === null) return false;
  return CUSTOM_RANGE_RE.test(value) || MONTH_RANGE_RE.test(value) || YTD_RANGE_RE.test(value);
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function currentYtdKey(): string {
  return String(new Date().getFullYear());
}

// Adds or subtracts whole months from a "YYYY-MM" key, wrapping year
// boundaries correctly (e.g. 2026-01 minus 1 month = 2025-12).
function shiftMonthKey(monthKey: string, delta: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const d = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const d = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, 1));
  const formatted = new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
```

- [ ] **Step 6: Wire the new picker's state and handlers**

In `AnaliticaClientInner`, replace the `dateRange` derivation and add month-navigation state. Find:

```typescript
  const dateRangeParam = searchParams.get('dateRange');
  const dateRange: DateRange = isValidDateRange(dateRangeParam) ? dateRangeParam : DEFAULT_DATE_RANGE;
  const isCustomRange = CUSTOM_RANGE_RE.test(dateRange);
  const customMatch = CUSTOM_RANGE_RE.exec(dateRange);
```

and change `DEFAULT_DATE_RANGE` (currently `'12m'`) — leave it as `'12m'`, no change needed there (still a valid default). Directly after the existing `customMatch`/`customStart`/`customEnd`/`customPending` block, add:

```typescript
  const isMonthRange = MONTH_RANGE_RE.test(dateRange);
  const monthMatch = MONTH_RANGE_RE.exec(dateRange);
  const isYtdRange = YTD_RANGE_RE.test(dateRange);
```

Replace `handleDateRangeChange` (currently only handles `'custom'` vs. everything-else) with:

```typescript
  const handleDateRangeChange = useCallback(
    (value: string) => {
      if (value === 'custom') {
        setCustomPending(true);
        updateParams({ dateRange: `custom:${customStart}:${customEnd}` });
        return;
      }
      setCustomPending(false);
      if (value === 'month') {
        updateParams({ dateRange: `month:${currentMonthKey()}` });
        return;
      }
      if (value === 'month-prev') {
        updateParams({ dateRange: `month:${shiftMonthKey(currentMonthKey(), -1)}` });
        return;
      }
      if (value === 'ytd') {
        updateParams({ dateRange: `ytd:${currentYtdKey()}` });
        return;
      }
      updateParams({ dateRange: value });
    },
    [updateParams, customStart, customEnd]
  );

  const handleMonthPage = useCallback(
    (delta: number) => {
      if (!monthMatch) return;
      const currentKey = `${monthMatch[1]}-${monthMatch[2]}`;
      updateParams({ dateRange: `month:${shiftMonthKey(currentKey, delta)}` });
    },
    [updateParams, monthMatch]
  );
```

- [ ] **Step 7: Update the picker's JSX**

Find the button-rendering block:

```tsx
              <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
                {DATE_RANGE_OPTIONS.map(opt => {
                  const isActive = opt.value === 'custom' ? (isCustomRange || customPending) : dateRange === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleDateRangeChange(opt.value)}
                      className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {(isCustomRange || customPending) && (
```

Replace with:

```tsx
              <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
                {DATE_RANGE_OPTIONS.map(opt => {
                  const isActive = opt.value === 'custom'
                    ? (isCustomRange || customPending)
                    : opt.value === 'month'
                      ? isMonthRange && `${monthMatch?.[1]}-${monthMatch?.[2]}` === currentMonthKey()
                      : opt.value === 'month-prev'
                        ? isMonthRange && `${monthMatch?.[1]}-${monthMatch?.[2]}` === shiftMonthKey(currentMonthKey(), -1)
                        : opt.value === 'ytd'
                          ? isYtdRange
                          : dateRange === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleDateRangeChange(opt.value)}
                      className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {isMonthRange && monthMatch && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <button
                    onClick={() => handleMonthPage(-1)}
                    className="px-2 py-1 rounded hover:bg-gray-100"
                    aria-label="Mes anterior"
                  >
                    ◀
                  </button>
                  <span className="min-w-[10rem] text-center">{formatMonthLabel(`${monthMatch[1]}-${monthMatch[2]}`)}</span>
                  <button
                    onClick={() => handleMonthPage(1)}
                    className="px-2 py-1 rounded hover:bg-gray-100"
                    aria-label="Mes siguiente"
                  >
                    ▶
                  </button>
                </div>
              )}
              {(isCustomRange || customPending) && (
```

- [ ] **Step 8: Update `types.ts`'s `DateRange` comment**

In `app/(app)/analitica/types.ts`, replace:

```typescript
// '30d' | '90d' | '12m' | `custom:${YYYY-MM-DD}:${YYYY-MM-DD}` — a custom
```

with:

```typescript
// '12m' | `month:${YYYY-MM}` | `ytd:${YYYY}` | `custom:${YYYY-MM-DD}:${YYYY-MM-DD}` — a custom
```

- [ ] **Step 9: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero new errors (only the pre-existing unrelated `inventory-change-unit.integration.test.ts` errors).

- [ ] **Step 10: Manually verify the picker in a browser**

If practical in your environment: `bun dev`, navigate to `/analitica`, click "Mes Actual" (label should show the current month/year), click the `◀` arrow (label should update to the previous month, URL param becomes `month:YYYY-MM` one lower), click "Año Actual" (arrows should disappear, since YTD has no paging in this iteration), click "12 meses" (back to the old behavior). If a dev server isn't practical, a careful read-through of the JSX plus the passing type-check is an acceptable substitute — note which you did.

- [ ] **Step 11: Commit**

```bash
git add app/api/dwh/lib/query-builder.ts "app/(app)/analitica/analitica-client.tsx" "app/(app)/analitica/types.ts" app/api/dwh/lib/__tests__/query-builder.test.ts
git commit -m "feat: replace 30d/90d date filters with month/YTD navigation dashboard-wide"
```

---

## Task 6: E2E coverage for month/YTD navigation

**Files:**
- Modify: `e2e/analitica.spec.ts`

**Interfaces:**
- Consumes: the updated picker from Task 5.

- [ ] **Step 1: Add an E2E test for month navigation**

Add to `e2e/analitica.spec.ts` (in the same `describe` block, after the Finanzas tests):

```typescript
  test('date-range picker supports month navigation and year-to-date', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=ventas');

    // "Mes Actual" is not currently visible as an exact-match button label
    // before clicking, since DATE_RANGE_OPTIONS' label IS "Mes Actual" —
    // click it directly.
    await adminPage.getByRole('button', { name: 'Mes Actual' }).click();
    await expect(adminPage).toHaveURL(/dateRange=month%3A\d{4}-\d{2}/);

    // Paging controls appear once a month range is active.
    const prevMonthArrow = adminPage.getByRole('button', { name: 'Mes anterior' });
    await expect(prevMonthArrow).toBeVisible();

    const urlBeforePaging = adminPage.url();
    await prevMonthArrow.click();
    await expect(adminPage).not.toHaveURL(urlBeforePaging);
    await expect(adminPage).toHaveURL(/dateRange=month%3A\d{4}-\d{2}/);

    // Switching to "Año Actual" removes the month paging arrows and encodes
    // a ytd: param instead.
    await adminPage.getByRole('button', { name: 'Año Actual' }).click();
    await expect(adminPage).toHaveURL(/dateRange=ytd%3A\d{4}/);
    await expect(prevMonthArrow).not.toBeVisible();

    // "30 días"/"90 días" no longer exist as options anywhere on the page.
    await expect(adminPage.getByRole('button', { name: '30 días' })).toHaveCount(0);
    await expect(adminPage.getByRole('button', { name: '90 días' })).toHaveCount(0);
  });
```

- [ ] **Step 2: Run the new test**

Run (Node 20+): `bunx playwright test e2e/analitica.spec.ts -g "date-range picker"`
Expected: PASS.

- [ ] **Step 3: Run the full `analitica.spec.ts` suite one final time**

Run: `bunx playwright test e2e/analitica.spec.ts`
Expected: all tests PASS — this is the final regression check across every tab this plan's shared-component change (Task 5) could have affected.

- [ ] **Step 4: Final grep for stragglers**

Run: `grep -rn "'30d'\|\"30d\"\|30 días\|'90d'\|\"90d\"\|90 días" --include="*.ts" --include="*.tsx" . | grep -v node_modules`
Expected: no output (or only matches inside historical `docs/superpowers/plans/`/`specs/` files, which are point-in-time records never edited retroactively).

- [ ] **Step 5: Commit**

```bash
git add e2e/analitica.spec.ts
git commit -m "test: cover month/YTD date-range navigation in analitica E2E"
```
