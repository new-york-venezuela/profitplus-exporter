import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimension, isDimensionForFact, isClienteDimension, jsonWithCache, type Dimension } from '@/app/api/dwh/lib/query-builder';
import type { VentasResponse, VentasRow, GroupBy } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// All queries here read from the pre-aggregated dwh/dim/fact schema in
// DWH_AlimentosNY (see dwh-migrations/), not the raw Profit Plus ERP —
// so no COLLATE/RTRIM gymnastics are needed here, that work already
// happened at load time.

function monthlyQuery(dateWhere: string, returnsDateWhere: string): string {
  return `
    SELECT
      d.YearMonth AS GroupValue,
      d.YearMonth AS GroupLabel,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         JOIN dim.Dim_Date dr ON dr.DateKey = fr.DateKey
         WHERE dr.YearMonth = d.YearMonth AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY d.YearMonth
    ORDER BY d.YearMonth
  `;
}

// Top customers. Scoped to a single month when @month is supplied (drill-down
// from the "mes" chart), otherwise falls back to the dateRange filter. Also
// optionally scoped to a single sales rep when @salesRepKey is supplied.
function clienteQuery(dimension: Dimension, dateWhere: string, returnsDateWhere: string, monthFilter: string, salesRepFilter: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fr2');
  return `
    SELECT TOP 15
      ${spec.valueExpr} AS GroupValue,
      ${spec.labelExpr} AS GroupLabel,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr2.NetAmount), 0)
         FROM fact.Fact_Returns fr2
         ${innerJoin}
         WHERE fr2.IsVoided = 0 ${returnsDateWhere} AND ${condition}
      ) AS ReturnsNet
    FROM fact.Fact_Sales fs
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${monthFilter} ${salesRepFilter}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesNet DESC
  `;
}

function lineaQuery(dateWhere: string, returnsDateWhere: string): string {
  return `
    SELECT TOP 15
      ISNULL(p.LineCode, 'SIN_LINEA') AS GroupValue,
      ISNULL(p.LineName, 'Sin línea') AS GroupLabel,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         JOIN dim.Dim_Product pr ON pr.ProductKey = fr.ProductKey
         WHERE ISNULL(pr.LineCode, 'SIN_LINEA') = ISNULL(p.LineCode, 'SIN_LINEA') AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.LineCode, 'SIN_LINEA'), ISNULL(p.LineName, 'Sin línea')
    ORDER BY SalesNet DESC
  `;
}

// Products within a single línea (parentValue = LineCode, or the
// 'SIN_LINEA' sentinel lineaQuery uses for products with no line assigned).
function lineaProductBreakdownQuery(salesDateWhere: string): string {
  return `
    SELECT TOP 15
      CAST(p.ProductKey AS varchar(20)) AS GroupValue,
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      SUM(fs.NetAmount) AS SalesNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 AND ISNULL(p.LineCode, 'SIN_LINEA') = @parentValue ${salesDateWhere}
    GROUP BY p.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesNet DESC
  `;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const idx = parseInt(m, 10) - 1;
  return names[idx] ? `${names[idx]} ${y.slice(2)}` : ym;
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const groupByParam = searchParams.get('groupBy') ?? 'mes';
  const groupBy: GroupBy = groupByParam === 'cliente' || groupByParam === 'linea' ? groupByParam : 'mes';
  const clienteDimensionParam = searchParams.get('clienteDimension');
  const clienteDimension: Dimension = isClienteDimension(clienteDimensionParam) ? clienteDimensionParam : 'cliente_entidad';
  const breakdownByParam = searchParams.get('breakdownBy');
  // NOT fact-aware here: for groupBy=linea, breakdownBy is only ever
  // 'producto', used as a sentinel that routes to lineaProductBreakdownQuery
  // below (a hardcoded línea->producto query that never calls
  // getDimensionSpec / joins via the generic mechanism at all). The other
  // branch below that DOES feed breakdownBy into getDimensionSpec against
  // Fact_Sales (the generic clienteDimension-parent breakdown) re-validates
  // with isDimensionForFact itself.
  const breakdownBy: Dimension | null = isDimension(breakdownByParam) ? breakdownByParam : null;
  const parentValue = searchParams.get('parentValue');
  const month = searchParams.get('month');
  const salesRepKeyParam = searchParams.get('salesRepKey');
  const salesRepKey = salesRepKeyParam && /^\d+$/.test(salesRepKeyParam) ? Number(salesRepKeyParam) : null;

  try {
    const pool = await getDwhPool();

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
    // clienteQuery's correlated returns subquery aliases Fact_Returns as `fr2`
    // (via spec.correlate), not `fr` like monthlyQuery/lineaQuery, so it needs
    // its own date-where clause built against that alias.
    const clienteReturnsDateWhere = buildDateWhereClause(dateRange, 'fr2');

    if (breakdownBy && parentValue && groupByParam === 'linea') {
      const req = pool.request();
      req.input('parentValue', parentValue);
      const result = await req.query(lineaProductBreakdownQuery(salesDateWhere));
      return jsonWithCache({ breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), salesNet: Number(r.SalesNet) })) });
    }

    // Generic clienteDimension-parent breakdown: this DOES join breakdownBy's
    // spec against Fact_Sales via getDimensionSpec, so it's re-validated
    // with the fact-aware guard here (unlike the línea sentinel usage above).
    if (breakdownBy && parentValue && isDimensionForFact(breakdownBy, 'sales')) {
      const breakdownSpec = getDimensionSpec(breakdownBy);
      const parentSpec = getDimensionSpec(clienteDimension);
      const req = pool.request();
      req.input('parentValue', parentValue);
      const result = await req.query(`
        SELECT TOP 15 ${breakdownSpec.valueExpr} AS GroupValue, ${breakdownSpec.labelExpr} AS GroupLabel, SUM(fs.NetAmount) AS SalesNet
        FROM fact.Fact_Sales fs
        ${breakdownSpec.joinClause.replace(/\bf\b/g, 'fs')}
        ${parentSpec.joinClause.replace(/\bf\b/g, 'fs')}
        WHERE fs.IsVoided = 0 AND ${parentSpec.valueExpr.replace(/\bf\b/g, 'fs')} = @parentValue ${salesDateWhere}
        GROUP BY ${breakdownSpec.groupByColumn}
        ORDER BY SalesNet DESC
      `);
      return jsonWithCache({ breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), salesNet: Number(r.SalesNet) })) });
    }

    let recordset: Record<string, unknown>[];
    const breadcrumb: VentasResponse['breadcrumb'] = [{ label: 'Ventas', groupBy: 'mes' }];

    if (groupBy === 'cliente') {
      const req = pool.request();
      let monthFilter = '';
      if (month) {
        req.input('month', month);
        monthFilter = 'AND d.YearMonth = @month';
      }
      let salesRepFilter = '';
      if (salesRepKey !== null) {
        req.input('salesRepKey', salesRepKey);
        salesRepFilter = 'AND fs.SalesRepKey = @salesRepKey';
      }
      const result = await req.query(clienteQuery(clienteDimension, salesDateWhere, clienteReturnsDateWhere, monthFilter, salesRepFilter));
      recordset = result.recordset;
      breadcrumb.push({ label: month ? formatYearMonth(month) : 'Clientes', groupBy: 'cliente' });
    } else if (groupBy === 'linea') {
      const result = await pool.request().query(lineaQuery(salesDateWhere, returnsDateWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: 'Líneas', groupBy: 'linea' });
    } else {
      const result = await pool.request().query(monthlyQuery(salesDateWhere, returnsDateWhere));
      recordset = result.recordset;
    }

    const usdRate = currency === 'usd' ? await getUsdRate() : null;

    const rows: VentasRow[] = recordset.map(r => {
      const salesNet = Number(r.SalesNet);
      const grossAmount = Number(r.GrossAmount);
      const discountAmount = Number(r.DiscountAmount);
      const returnsNet = Number(r.ReturnsNet);
      const label = groupBy === 'mes' ? formatYearMonth(String(r.GroupLabel)) : String(r.GroupLabel);
      return {
        label,
        value: r.GroupValue as string,
        salesNet,
        returnRate: salesNet > 0 ? returnsNet / salesNet : null,
        avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
      };
    });

    const response: VentasResponse = {
      rows,
      groupBy,
      breadcrumb,
      usdRate,
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
