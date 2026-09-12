import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
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
// summing to avoid a NULL total wiping out the whole aggregate.

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

// Operating expenses from fact.Fact_Expenses, grouped by category — feeds both
// the "Gastos Operativos" breakdown table and the EBITDA waterfall step.
// Intereses/Impuestos are excluded here (informational-only, not part of
// "Gastos Operativos") and queried separately below.
function expenseCategoryQuery(dateWhere: string): string {
  return `
    SELECT ec.Category, SUM(fe.Amount) AS TotalAmount
    FROM fact.Fact_Expenses fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.Category NOT IN ('Intereses', 'Impuestos') ${dateWhere}
    GROUP BY ec.Category
    ORDER BY TotalAmount DESC
  `;
}

// Intereses/Impuestos, kept separate from Gastos Operativos so EBITDA can
// exclude them per definition (Earnings Before Interest, Taxes, ...).
function excludedExpenseQuery(dateWhere: string): string {
  return `
    SELECT ec.Category, SUM(fe.Amount) AS TotalAmount
    FROM fact.Fact_Expenses fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.Category IN ('Intereses', 'Impuestos') ${dateWhere}
    GROUP BY ec.Category
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
    FROM fact.Fact_Expenses fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.Category = @category ${dateWhere}
    GROUP BY ec.ConceptName, ec.ConceptCode
    ORDER BY Amount DESC
  `;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasDwhAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

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

    const [totals, categoryResult, excludedResult, usdRate] = await Promise.all([
      pool.request().query(waterfallTotalsQuery(salesDateWhere)),
      pool.request().query(expenseCategoryQuery(expenseDateWhere)),
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

    const utilidadBruta = grossProfitAmount;

    const expenseBreakdown: ExpenseCategoryRow[] = categoryResult.recordset.map(r => ({
      category: String(r.Category),
      amount: Number(r.TotalAmount),
    }));

    const gastosOperativos = expenseBreakdown.reduce((sum, r) => sum + r.amount, 0);
    const intereses = Number(excludedResult.recordset.find(r => r.Category === 'Intereses')?.TotalAmount ?? 0);
    const impuestos = Number(excludedResult.recordset.find(r => r.Category === 'Impuestos')?.TotalAmount ?? 0);

    // EBITDA (aprox.): Utilidad Bruta - Gastos Operativos, excluding Intereses/
    // Impuestos by definition. Labeled "aprox." because D&A is structurally
    // unavailable in the source ERP data (no fixed-asset depreciation ledger),
    // so this is really Utilidad Bruta - Gastos Operativos rather than a strict
    // EBITDA computed by adding back D&A from a net-income base.
    const ebitda = utilidadBruta - gastosOperativos;
    const utilidadNeta = ebitda - intereses - impuestos;

    waterfall.push(
      { step: 'Gastos Operativos', amount: -gastosOperativos, cumulative: ebitda },
      { step: 'EBITDA (aprox.)', amount: 0, cumulative: ebitda },
      { step: 'Intereses', amount: -intereses, cumulative: ebitda - intereses },
      { step: 'Impuestos', amount: -impuestos, cumulative: utilidadNeta },
      { step: 'Utilidad Neta', amount: 0, cumulative: utilidadNeta },
    );

    const response: FinanzasResponse = {
      waterfall,
      ebitda,
      intereses,
      impuestos,
      utilidadNeta,
      expenseBreakdown,
      usdRate,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
