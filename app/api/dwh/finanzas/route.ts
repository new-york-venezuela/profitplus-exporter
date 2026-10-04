import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { buildDateWhereClause, buildReturnsDateWhereClause, getDimensionSpec, jsonWithCache, usdConversionJoin } from '@/app/api/dwh/lib/query-builder';
import type { FinanzasResponse, ExpenseCategoryRow } from '@/app/(app)/analitica/types';
import { computeMargenProxy } from './margen-proxy';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// migrations/dwh/), not the raw Profit Plus ERP — no COLLATE/RTRIM
// gymnastics needed here, that work already happened at load time.

// Every amount below is returned in the REQUESTED currency. For 'usd' each
// row is converted at its own date's Fact_ExchangeRate.RateSell before
// summing (same historical-rate rule as every other Analítica tab), not
// the summed BS total divided by today's rate. Rows dated before the first
// USD rate in the DWH (2026-03-16 on this installation; Fact_CashMovements
// goes back years) have no rate: they are left out of the USD sums and
// their BS total is reported as usdUnconvertedBs so the UI can say so.
type AmountCurrency = 'bs' | 'usd';

function sumAmount(column: string, currency: AmountCurrency, fxAlias: string): string {
  return currency === 'usd' ? `SUM(${column} / NULLIF(${fxAlias}.RateSell, 0))` : `SUM(${column})`;
}

function missingRate(column: string, currency: AmountCurrency, fxAlias: string): string {
  return currency === 'usd' ? `SUM(CASE WHEN ${fxAlias}.RateSell IS NULL THEN ${column} ELSE 0 END)` : '0';
}

function fxJoin(alias: string, currency: AmountCurrency, fxAlias: string, column: string = 'DateKey'): string {
  return currency === 'usd' ? usdConversionJoin(alias, column, fxAlias) : '';
}

// Ingresos operativos = ventas brutas − devoluciones (Fact_Sales.NetAmount −
// Fact_Returns.NetAmount), i.e. the same "Ventas netas" as the Ventas tab:
// devoluciones attributed to the ORIGINAL factura's date and, in USD,
// converted at that factura's rate.
function salesGrossQuery(dateWhere: string, currency: AmountCurrency): string {
  return `
    SELECT ISNULL(${sumAmount('fs.NetAmount', currency, 'fx')}, 0) AS SalesGross,
           ISNULL(${missingRate('fs.NetAmount', currency, 'fx')}, 0) AS MissingBs
    FROM fact.Fact_Sales fs
    ${fxJoin('fs', currency, 'fx')}
    WHERE fs.IsVoided = 0 ${dateWhere}
  `;
}

function returnsNetQuery(dateWhere: string, currency: AmountCurrency): string {
  return `
    SELECT ISNULL(${sumAmount('fr.NetAmount', currency, 'fx')}, 0) AS ReturnsNet,
           ISNULL(${missingRate('fr.NetAmount', currency, 'fx')}, 0) AS MissingBs
    FROM fact.Fact_Returns fr
    ${fxJoin('fr', currency, 'fx', 'OriginalInvoiceDateKey')}
    WHERE fr.IsVoided = 0 ${dateWhere}
  `;
}

// Gastos Operativos by category, sourced from the durable
// dwh.vw_GastosOperativos view (0026_gastos_operativos_view.sql) — the view
// is the single place "what counts as a real operating expense" is defined,
// so this query has no business-rule logic of its own beyond the date filter.
// The view is aliased 'v' here — the caller must build dateWhere with
// buildDateWhereClause(dateRange, 'v').
function expenseCategoryQuery(dateWhere: string, currency: AmountCurrency): string {
  return `
    SELECT v.Category, ${sumAmount('v.Amount', currency, 'fx')} AS TotalAmount,
           ${missingRate('v.Amount', currency, 'fx')} AS MissingBs
    FROM dwh.vw_GastosOperativos v
    ${fxJoin('v', currency, 'fx')}
    WHERE 1 = 1 ${dateWhere}
    GROUP BY v.Category
    ORDER BY TotalAmount DESC
  `;
}

// Intereses/Impuestos, kept separate from Gastos Operativos so Margen
// Operativo can exclude them per definition. These never appear in
// dwh.vw_GastosOperativos (the view's WHERE clause already excludes
// IsExcludedFromEbitda = 1 rows), so this stays a direct Fact_CashMovements query.
function excludedExpenseQuery(dateWhere: string, currency: AmountCurrency): string {
  return `
    SELECT ec.Category, ${sumAmount('fe.Amount', currency, 'fx')} AS TotalAmount,
           ${missingRate('fe.Amount', currency, 'fx')} AS MissingBs
    FROM fact.Fact_CashMovements fe
    ${fxJoin('fe', currency, 'fx')}
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
function conceptBreakdownQuery(dateWhere: string, currency: AmountCurrency): string {
  return `
    SELECT TOP 15 ec.ConceptName AS GroupLabel, ec.ConceptCode AS GroupValue, ${sumAmount('fe.Amount', currency, 'fx')} AS Amount, ec.CostCenter AS CostCenter
    FROM fact.Fact_CashMovements fe
    ${fxJoin('fe', currency, 'fx')}
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
function comprasSupplierBreakdownQuery(dateWhere: string, currency: AmountCurrency): string {
  const spec = getDimensionSpec('proveedor');
  return `
    SELECT TOP 15 ${spec.labelExpr} AS GroupLabel, ${spec.valueExpr} AS GroupValue, ${sumAmount('fp.NetAmount', currency, 'fx')} AS Amount
    FROM fact.Fact_Purchases fp
    ${fxJoin('fp', currency, 'fx')}
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
  const currency: AmountCurrency = searchParams.get('currency') === 'usd' ? 'usd' : 'bs';
  const breakdownByParam = searchParams.get('breakdownBy');
  const parentValue = searchParams.get('parentValue');

  try {
    const pool = await getDwhPool();

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const returnsDateWhere = buildReturnsDateWhereClause(dateRange, 'fr', 'factura');
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
        const result = await pool.request().query(comprasSupplierBreakdownQuery(purchasesDateWhere, currency));
        return jsonWithCache({
          breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), amount: Number(r.Amount) })),
        });
      }
      const req = pool.request();
      req.input('category', parentValue);
      const result = await req.query(conceptBreakdownQuery(expenseDateWhere, currency));
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

    const [salesGrossResult, returnsNetResult, categoryResult, excludedResult] = await Promise.all([
      pool.request().query(salesGrossQuery(salesDateWhere, currency)),
      pool.request().query(returnsNetQuery(returnsDateWhere, currency)),
      pool.request().query(expenseCategoryQuery(gastosViewDateWhere, currency)),
      pool.request().query(excludedExpenseQuery(expenseDateWhere, currency)),
    ]);
    const missing = (rs: { MissingBs: number | null }[]) => rs.reduce((sum, r) => sum + Number(r.MissingBs ?? 0), 0);
    const usdUnconvertedBs = currency === 'usd'
      ? missing(salesGrossResult.recordset) + missing(returnsNetResult.recordset) + missing(categoryResult.recordset) + missing(excludedResult.recordset)
      : 0;

    const expenseBreakdown: ExpenseCategoryRow[] = categoryResult.recordset.map(r => ({
      category: String(r.Category),
      amount: Number(r.TotalAmount ?? 0),
    }));

    const gastosOperativos = expenseBreakdown.reduce((sum, r) => sum + r.amount, 0);
    const intereses = Number(excludedResult.recordset.find(r => r.Category === 'Intereses')?.TotalAmount ?? 0);
    const impuestos = Number(excludedResult.recordset.find(r => r.Category === 'Impuestos')?.TotalAmount ?? 0);

    const salesGross = Number(salesGrossResult.recordset[0]?.SalesGross ?? 0);
    const returnsNet = Number(returnsNetResult.recordset[0]?.ReturnsNet ?? 0);
    const ingresosOperativos = salesGross - returnsNet;

    // Margen Operativo (accrual-basis, replaces the prior cash-basis calc —
    // see docs/superpowers/specs/2026-09-15-margen-operativo-accrual-design.md
    // section 2.1): Ingresos Netos (Fact_Sales minus Fact_Returns) minus
    // Gastos Operativos (dwh.vw_GastosOperativos: Fact_Purchases "Compras"
    // plus non-MateriaPrima Fact_CashMovements Gasto categories).
    const ebitda = ingresosOperativos - gastosOperativos;
    const utilidadNeta = ebitda - intereses - impuestos;

    // comprasAmount pulled from the same expenseBreakdown array already
    // computed above (one row per dwh.vw_GastosOperativos Category,
    // 'Compras' among them) — no extra query needed, matching the spec's
    // "No new SQL view needed" note.
    const comprasAmount = expenseBreakdown.find(r => r.category === 'Compras')?.amount ?? 0;
    const margenProxy = computeMargenProxy({ ingresos: ingresosOperativos, compras: comprasAmount, gastosOperativos });

    const response: FinanzasResponse = {
      cashFlowEbitda: {
        ingresosOperativos,
        gastosOperativos,
        ebitda,
        intereses,
        impuestos,
        utilidadNeta,
      },
      margenProxy,
      expenseBreakdown,
      currency,
      usdUnconvertedBs,
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
