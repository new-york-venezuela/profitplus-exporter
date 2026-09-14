import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause } from '@/app/api/dwh/lib/query-builder';
import type { FinanzasResponse, FinanzasWaterfallStep, ExpenseCategoryRow } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.
//
// COGSAmount/GrossProfitAmount are nullable on fact.Fact_Sales (populated only
// once a cost source is available — see dwh-migrations/0009_fact_sales.sql,
// CostSourceFlag = 'NO_COST_DATA' otherwise), so they're ISNULL-wrapped before
// summing to avoid a NULL total wiping out the whole aggregate. This means
// utilidadBruta below is always 0 today — EBITDA is deliberately NOT derived
// from it (see cashFlowEbitdaQuery / docs/superpowers/specs/
// 2026-09-14-cash-movement-ebitda-design.md), only the sales waterfall still
// uses it, for revenue/discount-rate visibility.

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

// Operating expenses from fact.Fact_CashMovements, grouped by category — feeds
// both the "Gastos Operativos" breakdown table and the EBITDA calc. Filters
// on the IsExcludedFromEbitda bit column (set by dwh.Load_Dim_ExpenseConcept
// — see 0017_dim_expense_concept.sql / 0023_fact_cash_movements.sql) rather
// than a Category NOT IN (...) string-literal list, so the bit column is the
// single source of truth for this business rule.
function expenseCategoryQuery(dateWhere: string): string {
  return `
    SELECT ec.Category, SUM(fe.Amount) AS TotalAmount
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.IsExcludedFromEbitda = 0 ${dateWhere}
    GROUP BY ec.Category
    ORDER BY TotalAmount DESC
  `;
}

// Intereses/Impuestos, kept separate from Gastos Operativos so EBITDA can
// exclude them per definition (Earnings Before Interest, Taxes, ...). Same
// IsExcludedFromEbitda bit column as above, inverted, scoped to Gasto so an
// Ingreso-side exclusion (e.g. asset sale income) never lands in this
// Gasto-labeled Intereses/Impuestos breakout.
function excludedExpenseQuery(dateWhere: string): string {
  return `
    SELECT ec.Category, SUM(fe.Amount) AS TotalAmount
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.IsExcludedFromEbitda = 1 ${dateWhere}
    GROUP BY ec.Category
  `;
}

// Operating income for cash-basis EBITDA: I-01 Ventas only (IsExcludedFromEbitda
// = 0 among Ingreso concepts — every other Ingreso code is loans, asset sales,
// interest income, receivables, FX, or tax pass-through, see spec section 3.2).
// Amount is negated: Ingreso rows net negative under monto_d - monto_h
// (verified live 2026-09-14), so -SUM(...) yields a positive income figure.
function cashFlowIncomeQuery(dateWhere: string): string {
  return `
    SELECT SUM(-fe.Amount) AS IngresosOperativos
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Ingreso' AND ec.IsExcludedFromEbitda = 0 ${dateWhere}
  `;
}

// Concept-level drilldown for a single expense category (breakdownBy=concepto
// drilldown target — clicking "Nomina" in the Gastos Operativos breakdown
// shows its individual concepts, e.g. "Sueldos Administrativos", "Bono
// Vacacional", etc.). Same { breakdown: BreakdownRow[] } contract as every
// other tab's breakdown fetch (see ventas/route.ts, vendedores/route.ts).
function conceptBreakdownQuery(dateWhere: string): string {
  return `
    SELECT TOP 15 ec.ConceptName AS GroupLabel, ec.ConceptCode AS GroupValue, SUM(fe.Amount) AS Amount
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.Category = @category ${dateWhere}
    GROUP BY ec.ConceptName, ec.ConceptCode
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
    const expenseDateWhere = buildDateWhereClause(dateRange, 'fe');

    if (breakdownByParam === 'concepto' && parentValue) {
      const req = pool.request();
      req.input('category', parentValue);
      const result = await req.query(conceptBreakdownQuery(expenseDateWhere));
      return NextResponse.json({
        breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), amount: Number(r.Amount) })),
      });
    }

    const [totals, categoryResult, excludedResult, incomeResult, usdRate] = await Promise.all([
      pool.request().query(waterfallTotalsQuery(salesDateWhere)),
      pool.request().query(expenseCategoryQuery(expenseDateWhere)),
      pool.request().query(excludedExpenseQuery(expenseDateWhere)),
      pool.request().query(cashFlowIncomeQuery(expenseDateWhere)),
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
    const ingresosOperativos = Number(incomeResult.recordset[0]?.IngresosOperativos ?? 0);

    // Cash-basis EBITDA, decoupled from the Fact_Sales waterfall above (see
    // docs/superpowers/specs/2026-09-14-cash-movement-ebitda-design.md
    // section 2): Ingresos Operativos (I-01 Ventas from movimientos) minus
    // Gastos Operativos (also from movimientos). Replaces the old
    // "Utilidad Bruta - Gastos Operativos" calc, which was always exactly
    // -gastosOperativos because Fact_Sales.GrossProfitAmount is always NULL
    // (no cost data has ever been recorded in Profit Plus).
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
