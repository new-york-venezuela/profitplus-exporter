import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause } from '@/app/api/dwh/lib/query-builder';
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
function clienteQuery(dateWhere: string, monthFilter: string, salesRepFilter: string): string {
  return `
    SELECT TOP 15
      CAST(c.CustomerKey AS varchar(20)) AS GroupValue,
      ISNULL(c.CustomerName, c.CustomerCode) AS GroupLabel,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         WHERE fr.CustomerKey = fs.CustomerKey AND fr.IsVoided = 0) AS ReturnsNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${monthFilter} ${salesRepFilter}
    GROUP BY c.CustomerKey, ISNULL(c.CustomerName, c.CustomerCode)
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
  const groupBy: GroupBy = groupByParam === 'cliente' || groupByParam === 'linea' ? groupByParam : 'mes';
  const month = searchParams.get('month');
  const salesRepKeyParam = searchParams.get('salesRepKey');
  const salesRepKey = salesRepKeyParam && /^\d+$/.test(salesRepKeyParam) ? Number(salesRepKeyParam) : null;

  try {
    const pool = await getDwhPool();

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');

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
      const result = await req.query(clienteQuery(salesDateWhere, monthFilter, salesRepFilter));
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

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
