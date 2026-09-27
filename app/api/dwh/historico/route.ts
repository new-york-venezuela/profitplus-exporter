import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { jsonWithCache, usdConversionJoin, dualAmountExpr } from '@/app/api/dwh/lib/query-builder';
import type {
  HistoricoResponse, HistoricoRow,
  HistoricoKpis, HistoricoKpisResponse,
  GroupBy, DualAmount,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from fact.Fact_Sales_Legacy/fact.Fact_Returns_Legacy (see
// migrations/dwh/0034_legacy_2025_schema.sql), a fixed Jan 2025-Feb 2026
// snapshot imported once from the pre-March-2026-cutover Profit Plus
// server — never fact.Fact_Sales/fact.Fact_Returns. No dateRange param:
// the window is fixed and never grows. No entidad/tienda toggle: legacy
// customers have no Dim_LegalEntity rollup (see the schema migration's
// comments for why). No prev-period comparison: there is no meaningful
// "before" this dataset's own start.
//
// Both Fact_Sales_Legacy and Fact_Returns_Legacy carry their own
// DocumentExchangeRate column (see the 0034 migration), so every money
// figure here goes through dualAmountExpr/usdConversionJoin — same
// convention as ventas/route.ts — rather than a bare number.
const DATE_WINDOW = 'AND fsl.DateKey BETWEEN 20250101 AND 20260228';
const RETURNS_DATE_WINDOW = 'AND frl.DateKey BETWEEN 20250101 AND 20260228';

function monthlyQuery(): string {
  return `
    SELECT
      d.YearMonth AS GroupValue,
      d.YearMonth AS GroupLabel,
      ${dualAmountExpr('fsl', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      (SELECT ISNULL(SUM(frl.NetAmount), 0)
         FROM fact.Fact_Returns_Legacy frl
         JOIN dim.Dim_Date dr ON dr.DateKey = frl.DateKey
         WHERE dr.YearMonth = d.YearMonth AND frl.IsVoided = 0 ${RETURNS_DATE_WINDOW}) AS ReturnsNetBs
    FROM fact.Fact_Sales_Legacy fsl
    ${usdConversionJoin('fsl')}
    JOIN dim.Dim_Date d ON d.DateKey = fsl.DateKey
    WHERE fsl.IsVoided = 0 ${DATE_WINDOW}
    GROUP BY d.YearMonth
    ORDER BY d.YearMonth
  `;
}

// Top customers, flat (no Dim_LegalEntity rollup for legacy customers — see
// module doc comment above). Scoped to a single month when @month is
// supplied (drill-down from the "mes" chart), otherwise unscoped. Also
// optionally scoped to a single sales rep when @salesRepKey is supplied.
//
// ReturnsNetBs only — no USD side. returnRate (computed in the row-mapping
// code below) is BS-only, matching ventas/route.ts's own convention, so
// there's no need for a returns-side usdConversionJoin here.
function clienteQuery(monthFilter: string, salesRepFilter: string): string {
  return `
    SELECT TOP 15
      CAST(c.CustomerLegacyKey AS varchar(20)) AS GroupValue,
      ISNULL(c.CustomerName, c.CustomerCode) AS GroupLabel,
      ${dualAmountExpr('fsl', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      (SELECT ISNULL(SUM(frl.NetAmount), 0)
         FROM fact.Fact_Returns_Legacy frl
         WHERE frl.CustomerLegacyKey = c.CustomerLegacyKey AND frl.IsVoided = 0 ${RETURNS_DATE_WINDOW}
      ) AS ReturnsNetBs
    FROM fact.Fact_Sales_Legacy fsl
    ${usdConversionJoin('fsl')}
    JOIN dim.Dim_Customer_Legacy c ON c.CustomerLegacyKey = fsl.CustomerLegacyKey
    JOIN dim.Dim_Date d ON d.DateKey = fsl.DateKey
    WHERE fsl.IsVoided = 0 ${DATE_WINDOW} ${monthFilter} ${salesRepFilter}
    GROUP BY c.CustomerLegacyKey, ISNULL(c.CustomerName, c.CustomerCode)
    ORDER BY SalesNetBs DESC
  `;
}

function lineaQuery(): string {
  return `
    SELECT TOP 15
      ISNULL(p.LineCode, 'SIN_LINEA') AS GroupValue,
      ISNULL(p.LineName, 'Sin línea') AS GroupLabel,
      ${dualAmountExpr('fsl', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
      (SELECT ISNULL(SUM(frl.NetAmount), 0)
         FROM fact.Fact_Returns_Legacy frl
         JOIN dim.Dim_Product_Legacy pr ON pr.ProductLegacyKey = frl.ProductLegacyKey
         WHERE ISNULL(pr.LineCode, 'SIN_LINEA') = ISNULL(p.LineCode, 'SIN_LINEA') AND frl.IsVoided = 0 ${RETURNS_DATE_WINDOW}) AS ReturnsNetBs
    FROM fact.Fact_Sales_Legacy fsl
    ${usdConversionJoin('fsl')}
    JOIN dim.Dim_Product_Legacy p ON p.ProductLegacyKey = fsl.ProductLegacyKey
    WHERE fsl.IsVoided = 0 ${DATE_WINDOW}
    GROUP BY ISNULL(p.LineCode, 'SIN_LINEA'), ISNULL(p.LineName, 'Sin línea')
    ORDER BY SalesNetBs DESC
  `;
}

// Products within a single línea (parentValue = LineCode, or the
// 'SIN_LINEA' sentinel lineaQuery uses for products with no line assigned).
function lineaProductBreakdownQuery(): string {
  return `
    SELECT TOP 15
      CAST(p.ProductLegacyKey AS varchar(20)) AS GroupValue,
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      ${dualAmountExpr('fsl', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')}
    FROM fact.Fact_Sales_Legacy fsl
    ${usdConversionJoin('fsl')}
    JOIN dim.Dim_Product_Legacy p ON p.ProductLegacyKey = fsl.ProductLegacyKey
    WHERE fsl.IsVoided = 0 AND ISNULL(p.LineCode, 'SIN_LINEA') = @parentValue ${DATE_WINDOW}
    GROUP BY p.ProductLegacyKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesNetBs DESC
  `;
}

const KPIS_QUERY = `
  SELECT
    ${dualAmountExpr('fsl', 'NetAmount', 'SalesNetBs', 'SalesNetUsd')},
    SUM(fsl.QuantitySold) AS UnitsSold,
    COUNT(DISTINCT fsl.CustomerLegacyKey) AS ActiveClients,
    COUNT(DISTINCT fsl.InvoiceNumber) AS InvoiceCount
  FROM fact.Fact_Sales_Legacy fsl
  ${usdConversionJoin('fsl')}
  WHERE fsl.IsVoided = 0 ${DATE_WINDOW}
`;

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const idx = parseInt(m, 10) - 1;
  return names[idx] ? `${names[idx]} ${y.slice(2)}` : ym;
}

async function handleKpis(): Promise<NextResponse> {
  const pool = await getDwhPool();
  const kpiResult = await pool.request().query(KPIS_QUERY);

  const row = kpiResult.recordset[0] as { SalesNetBs: number | null; SalesNetUsd: number | null; UnitsSold: number | null; ActiveClients: number; InvoiceCount: number };
  const salesNetBs = Number(row.SalesNetBs ?? 0);
  const salesNetUsd = row.SalesNetUsd === null ? null : Number(row.SalesNetUsd);
  const invoiceCount = Number(row.InvoiceCount ?? 0);

  const salesNet: DualAmount = { bs: salesNetBs, usd: salesNetUsd };

  const kpis: HistoricoKpis = {
    salesNet,
    activeClients: Number(row.ActiveClients ?? 0),
    avgTicket: invoiceCount > 0 ? { bs: salesNetBs / invoiceCount, usd: salesNetUsd === null ? null : salesNetUsd / invoiceCount } : null,
    unitsSold: Number(row.UnitsSold ?? 0),
  };

  const response: HistoricoKpisResponse = { kpis };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const groupByParam = searchParams.get('groupBy') ?? 'mes';
  const groupBy: GroupBy = groupByParam === 'cliente' || groupByParam === 'linea' ? groupByParam : 'mes';
  const breakdownByParam = searchParams.get('breakdownBy');
  const parentValue = searchParams.get('parentValue');
  const month = searchParams.get('month');
  const salesRepKeyParam = searchParams.get('salesRepKey');
  const salesRepKey = salesRepKeyParam && /^\d+$/.test(salesRepKeyParam) ? Number(salesRepKeyParam) : null;

  const section = searchParams.get('section');
  if (section === 'kpis') {
    try {
      return await handleKpis();
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  try {
    const pool = await getDwhPool();

    if (breakdownByParam === 'producto' && parentValue && groupByParam === 'linea') {
      const req = pool.request();
      req.input('parentValue', parentValue);
      const result = await req.query(lineaProductBreakdownQuery());
      return jsonWithCache({
        breakdown: result.recordset.map(r => ({
          label: r.GroupLabel,
          value: String(r.GroupValue),
          salesNetBs: Number(r.SalesNetBs),
          salesNetUsd: r.SalesNetUsd === null ? null : Number(r.SalesNetUsd),
        })),
      });
    }

    let recordset: Record<string, unknown>[];
    const breadcrumb: HistoricoResponse['breadcrumb'] = [{ label: 'Histórico 2025', groupBy: 'mes' }];

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
        salesRepFilter = 'AND fsl.SalesRepLegacyKey = @salesRepKey';
      }
      const result = await req.query(clienteQuery(monthFilter, salesRepFilter));
      recordset = result.recordset;
      breadcrumb.push({ label: month ? formatYearMonth(month) : 'Clientes', groupBy: 'cliente' });
    } else if (groupBy === 'linea') {
      const result = await pool.request().query(lineaQuery());
      recordset = result.recordset;
      breadcrumb.push({ label: 'Líneas', groupBy: 'linea' });
    } else {
      const result = await pool.request().query(monthlyQuery());
      recordset = result.recordset;
    }

    const rows: HistoricoRow[] = recordset.map(r => {
      const salesNetBs = Number(r.SalesNetBs);
      const salesNetUsd = r.SalesNetUsd === null ? null : Number(r.SalesNetUsd);
      const returnsNetBs = Number(r.ReturnsNetBs ?? 0);
      const label = groupBy === 'mes' ? formatYearMonth(String(r.GroupLabel)) : String(r.GroupLabel);
      return {
        label,
        value: r.GroupValue as string,
        salesNet: { bs: salesNetBs, usd: salesNetUsd },
        returnRate: salesNetBs > 0 ? returnsNetBs / salesNetBs : null,
      };
    });

    const response: HistoricoResponse = { rows, groupBy, breadcrumb };
    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
