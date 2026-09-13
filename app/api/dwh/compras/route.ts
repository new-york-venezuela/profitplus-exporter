import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimension, type Dimension } from '@/app/api/dwh/lib/query-builder';
import type { ComprasResponse, ComprasRow, GroupBy } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Mirrors app/api/dwh/ventas/route.ts's structure exactly (mes/proveedor/
// linea groupBy levels, producto breakdown on the linea level) — see that
// file for the pattern this one follows. Purchases have no returns-tracking
// equivalent in scope, so (unlike Ventas) there is no ReturnsNet subquery
// and ComprasRow has no returnRate.

function monthlyQuery(dateWhere: string): string {
  return `
    SELECT
      d.YearMonth AS GroupValue,
      d.YearMonth AS GroupLabel,
      SUM(fp.NetAmount) AS PurchasesNet,
      SUM(fp.GrossAmount) AS GrossAmount,
      SUM(fp.DiscountAmount) AS DiscountAmount
    FROM fact.Fact_Purchases fp
    JOIN dim.Dim_Date d ON d.DateKey = fp.DateKey
    WHERE fp.IsVoided = 0 ${dateWhere}
    GROUP BY d.YearMonth
    ORDER BY d.YearMonth
  `;
}

// Top suppliers. Scoped to a single month when @month is supplied (drill-down
// from the "mes" chart), otherwise falls back to the dateRange filter.
function proveedorQuery(dateWhere: string, monthFilter: string): string {
  const spec = getDimensionSpec('proveedor');
  return `
    SELECT TOP 15
      ${spec.valueExpr} AS GroupValue,
      ${spec.labelExpr} AS GroupLabel,
      SUM(fp.NetAmount) AS PurchasesNet,
      SUM(fp.GrossAmount) AS GrossAmount,
      SUM(fp.DiscountAmount) AS DiscountAmount
    FROM fact.Fact_Purchases fp
    ${spec.joinClause.replace(/\bf\b/g, 'fp')}
    JOIN dim.Dim_Date d ON d.DateKey = fp.DateKey
    WHERE fp.IsVoided = 0 ${dateWhere} ${monthFilter}
    GROUP BY ${spec.groupByColumn}
    ORDER BY PurchasesNet DESC
  `;
}

function lineaQuery(dateWhere: string): string {
  return `
    SELECT TOP 15
      ISNULL(p.LineCode, 'SIN_LINEA') AS GroupValue,
      ISNULL(p.LineName, 'Sin línea') AS GroupLabel,
      SUM(fp.NetAmount) AS PurchasesNet,
      SUM(fp.GrossAmount) AS GrossAmount,
      SUM(fp.DiscountAmount) AS DiscountAmount
    FROM fact.Fact_Purchases fp
    JOIN dim.Dim_Product p ON p.ProductKey = fp.ProductKey
    WHERE fp.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.LineCode, 'SIN_LINEA'), ISNULL(p.LineName, 'Sin línea')
    ORDER BY PurchasesNet DESC
  `;
}

// Products within a single línea (parentValue = LineCode, or the
// 'SIN_LINEA' sentinel lineaQuery uses for products with no line assigned).
function lineaProductBreakdownQuery(purchasesDateWhere: string): string {
  return `
    SELECT TOP 15
      CAST(p.ProductKey AS varchar(20)) AS GroupValue,
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      SUM(fp.NetAmount) AS PurchasesNet
    FROM fact.Fact_Purchases fp
    JOIN dim.Dim_Product p ON p.ProductKey = fp.ProductKey
    WHERE fp.IsVoided = 0 AND ISNULL(p.LineCode, 'SIN_LINEA') = @parentValue ${purchasesDateWhere}
    GROUP BY p.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY PurchasesNet DESC
  `;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const idx = parseInt(m, 10) - 1;
  return names[idx] ? `${names[idx]} ${y.slice(2)}` : ym;
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
  const groupByParam = searchParams.get('groupBy') ?? 'mes';
  const groupBy: GroupBy = groupByParam === 'proveedor' || groupByParam === 'linea' ? groupByParam : 'mes';
  const breakdownByParam = searchParams.get('breakdownBy');
  const breakdownBy: Dimension | null = isDimension(breakdownByParam) ? breakdownByParam : null;
  const parentValue = searchParams.get('parentValue');
  const month = searchParams.get('month');

  try {
    const pool = await getDwhPool();
    const purchasesDateWhere = buildDateWhereClause(dateRange, 'fp');

    if (breakdownBy && parentValue && groupByParam === 'linea') {
      const req = pool.request();
      req.input('parentValue', parentValue);
      const result = await req.query(lineaProductBreakdownQuery(purchasesDateWhere));
      return NextResponse.json({ breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), purchasesNet: Number(r.PurchasesNet) })) });
    }

    if (breakdownBy && parentValue) {
      const breakdownSpec = getDimensionSpec(breakdownBy);
      const parentSpec = getDimensionSpec('proveedor');
      const req = pool.request();
      req.input('parentValue', parentValue);
      const result = await req.query(`
        SELECT TOP 15 ${breakdownSpec.valueExpr} AS GroupValue, ${breakdownSpec.labelExpr} AS GroupLabel, SUM(fp.NetAmount) AS PurchasesNet
        FROM fact.Fact_Purchases fp
        ${breakdownSpec.joinClause.replace(/\bf\b/g, 'fp')}
        ${parentSpec.joinClause.replace(/\bf\b/g, 'fp')}
        WHERE fp.IsVoided = 0 AND ${parentSpec.valueExpr.replace(/\bf\b/g, 'fp')} = @parentValue ${purchasesDateWhere}
        GROUP BY ${breakdownSpec.groupByColumn}
        ORDER BY PurchasesNet DESC
      `);
      return NextResponse.json({ breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), purchasesNet: Number(r.PurchasesNet) })) });
    }

    let recordset: Record<string, unknown>[];
    const breadcrumb: ComprasResponse['breadcrumb'] = [{ label: 'Compras', groupBy: 'mes' }];

    if (groupBy === 'proveedor') {
      let monthFilter = '';
      const req = pool.request();
      if (month) {
        req.input('month', month);
        monthFilter = 'AND d.YearMonth = @month';
      }
      const result = await req.query(proveedorQuery(purchasesDateWhere, monthFilter));
      recordset = result.recordset;
      breadcrumb.push({ label: month ? formatYearMonth(month) : 'Proveedores', groupBy: 'proveedor' });
    } else if (groupBy === 'linea') {
      const result = await pool.request().query(lineaQuery(purchasesDateWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: 'Líneas', groupBy: 'linea' });
    } else {
      const result = await pool.request().query(monthlyQuery(purchasesDateWhere));
      recordset = result.recordset;
    }

    const usdRate = currency === 'usd' ? await getUsdRate() : null;

    const rows: ComprasRow[] = recordset.map(r => {
      const purchasesNet = Number(r.PurchasesNet);
      const grossAmount = Number(r.GrossAmount);
      const discountAmount = Number(r.DiscountAmount);
      const label = groupBy === 'mes' ? formatYearMonth(String(r.GroupLabel)) : String(r.GroupLabel);
      return {
        label,
        value: String(r.GroupValue),
        purchasesNet,
        avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
      };
    });

    const response: ComprasResponse = {
      rows,
      groupBy,
      breadcrumb,
      usdRate,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
