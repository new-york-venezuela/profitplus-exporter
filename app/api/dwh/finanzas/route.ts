import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
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
        return jsonWithCache({
          breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), amount: Number(r.Amount) })),
        });
      }
      const req = pool.request();
      req.input('category', parentValue);
      const result = await req.query(conceptBreakdownQuery(expenseDateWhere));
      const isNomina = parentValue === 'Nomina';
      return jsonWithCache({
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

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
