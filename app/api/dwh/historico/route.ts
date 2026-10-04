import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { buildReturnsDateWhereClause, jsonWithCache, usdConversionJoin, returnsUsdConversionJoin, dualAmountExpr } from '@/app/api/dwh/lib/query-builder';
import { dualFromRow, returnRate, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
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
// Every money figure here goes through dualAmountExpr/usdConversionJoin —
// same convention as ventas/route.ts — rather than a bare number. Both
// Fact_Sales_Legacy and Fact_Returns_Legacy also carry their own
// DocumentExchangeRate column (see the 0034 migration), but per
// dualAmountExpr's own doc comment that column is never used for the BS→USD
// conversion (it's an unreliable source: 1 is the ERP's "no conversion"
// placeholder for BS-denominated documents, not a real rate) — conversion is
// always via fact.Fact_ExchangeRate.RateSell for the row's own DateKey.
const DATE_WINDOW = 'AND fsl.DateKey BETWEEN 20250101 AND 20260228';
// Devoluciones follow the same rule as the rest of Analítica (0036/0037):
// windowed by the ORIGINAL factura's date (OriginalInvoiceDateKey — never
// NULL; unlinked lines fall back to the devolución's own date) and converted
// to USD at that factura date's rate (returnsUsdConversionJoin). Ventas
// netas = ventas brutas − devoluciones por fecha de factura. A devolución
// issued in the window for a factura from before 2025 is therefore not part
// of this tab (it restates a period the tab doesn't cover).
const RETURNS_DATE_WINDOW = 'AND frl.OriginalInvoiceDateKey BETWEEN 20250101 AND 20260228';

function monthlyQuery(): string {
  return `
    SELECT
      d.YearMonth AS GroupValue,
      d.YearMonth AS GroupLabel,
      ${dualAmountExpr('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      (SELECT ISNULL(SUM(frl.NetAmount), 0)
         FROM fact.Fact_Returns_Legacy frl
         JOIN dim.Dim_Date dr ON dr.DateKey = frl.OriginalInvoiceDateKey
         WHERE frl.IsVoided = 0 ${RETURNS_DATE_WINDOW} AND dr.YearMonth = d.YearMonth) AS ReturnsBs,
      (SELECT CASE WHEN COUNT(frl.NetAmount) = 0 THEN 0 ELSE SUM(frl.NetAmount / NULLIF(frfx.RateSell, 0)) END
         FROM fact.Fact_Returns_Legacy frl
         JOIN dim.Dim_Date dr ON dr.DateKey = frl.OriginalInvoiceDateKey
         ${returnsUsdConversionJoin('frl', 'frfx')}
         WHERE frl.IsVoided = 0 ${RETURNS_DATE_WINDOW} AND dr.YearMonth = d.YearMonth) AS ReturnsUsd
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
// The returns subqueries get the same month and seller scope as the sales
// side (returnsMonthFilter/returnsSalesRepFilter), so a drilled-in row's
// return rate compares the same period/seller on both sides.
function clienteQuery(monthFilter: string, salesRepFilter: string, returnsMonthFilter: string, returnsSalesRepFilter: string): string {
  return `
    SELECT TOP 15
      CAST(c.CustomerLegacyKey AS varchar(20)) AS GroupValue,
      ISNULL(c.CustomerName, c.CustomerCode) AS GroupLabel,
      ${dualAmountExpr('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      (SELECT ISNULL(SUM(frl.NetAmount), 0)
         FROM fact.Fact_Returns_Legacy frl
         
         WHERE frl.IsVoided = 0 ${RETURNS_DATE_WINDOW} AND frl.CustomerLegacyKey = c.CustomerLegacyKey ${returnsMonthFilter} ${returnsSalesRepFilter}) AS ReturnsBs,
      (SELECT CASE WHEN COUNT(frl.NetAmount) = 0 THEN 0 ELSE SUM(frl.NetAmount / NULLIF(frfx.RateSell, 0)) END
         FROM fact.Fact_Returns_Legacy frl
         
         ${returnsUsdConversionJoin('frl', 'frfx')}
         WHERE frl.IsVoided = 0 ${RETURNS_DATE_WINDOW} AND frl.CustomerLegacyKey = c.CustomerLegacyKey ${returnsMonthFilter} ${returnsSalesRepFilter}) AS ReturnsUsd
    FROM fact.Fact_Sales_Legacy fsl
    ${usdConversionJoin('fsl')}
    JOIN dim.Dim_Customer_Legacy c ON c.CustomerLegacyKey = fsl.CustomerLegacyKey
    JOIN dim.Dim_Date d ON d.DateKey = fsl.DateKey
    WHERE fsl.IsVoided = 0 ${DATE_WINDOW} ${monthFilter} ${salesRepFilter}
    GROUP BY c.CustomerLegacyKey, ISNULL(c.CustomerName, c.CustomerCode)
    ORDER BY SalesGrossBs DESC
  `;
}

function lineaQuery(): string {
  return `
    SELECT TOP 15
      ISNULL(p.LineCode, 'SIN_LINEA') AS GroupValue,
      ISNULL(p.LineName, 'Sin línea') AS GroupLabel,
      ${dualAmountExpr('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      (SELECT ISNULL(SUM(frl.NetAmount), 0)
         FROM fact.Fact_Returns_Legacy frl
         JOIN dim.Dim_Product_Legacy pr ON pr.ProductLegacyKey = frl.ProductLegacyKey
         WHERE frl.IsVoided = 0 ${RETURNS_DATE_WINDOW} AND ISNULL(pr.LineCode, 'SIN_LINEA') = ISNULL(p.LineCode, 'SIN_LINEA')) AS ReturnsBs,
      (SELECT CASE WHEN COUNT(frl.NetAmount) = 0 THEN 0 ELSE SUM(frl.NetAmount / NULLIF(frfx.RateSell, 0)) END
         FROM fact.Fact_Returns_Legacy frl
         JOIN dim.Dim_Product_Legacy pr ON pr.ProductLegacyKey = frl.ProductLegacyKey
         ${returnsUsdConversionJoin('frl', 'frfx')}
         WHERE frl.IsVoided = 0 ${RETURNS_DATE_WINDOW} AND ISNULL(pr.LineCode, 'SIN_LINEA') = ISNULL(p.LineCode, 'SIN_LINEA')) AS ReturnsUsd
    FROM fact.Fact_Sales_Legacy fsl
    ${usdConversionJoin('fsl')}
    JOIN dim.Dim_Product_Legacy p ON p.ProductLegacyKey = fsl.ProductLegacyKey
    WHERE fsl.IsVoided = 0 ${DATE_WINDOW}
    GROUP BY ISNULL(p.LineCode, 'SIN_LINEA'), ISNULL(p.LineName, 'Sin línea')
    ORDER BY SalesGrossBs DESC
  `;
}

// Products within a single línea (parentValue = LineCode, or the
// 'SIN_LINEA' sentinel lineaQuery uses for products with no line assigned).
function lineaProductBreakdownQuery(): string {
  return `
    SELECT TOP 15
      CAST(p.ProductLegacyKey AS varchar(20)) AS GroupValue,
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      ${dualAmountExpr('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
    FROM fact.Fact_Sales_Legacy fsl
    ${usdConversionJoin('fsl')}
    JOIN dim.Dim_Product_Legacy p ON p.ProductLegacyKey = fsl.ProductLegacyKey
    WHERE fsl.IsVoided = 0 AND ISNULL(p.LineCode, 'SIN_LINEA') = @parentValue ${DATE_WINDOW}
    GROUP BY p.ProductLegacyKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesGrossBs DESC
  `;
}

const KPIS_QUERY = `
  SELECT
    ${dualAmountExpr('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
    SUM(fsl.QuantitySold) AS UnitsSold,
    COUNT(DISTINCT fsl.CustomerLegacyKey) AS ActiveClients,
    COUNT(DISTINCT fsl.InvoiceNumber) AS InvoiceCount
  FROM fact.Fact_Sales_Legacy fsl
  ${usdConversionJoin('fsl')}
  WHERE fsl.IsVoided = 0 ${DATE_WINDOW}
`;

const RETURNS_KPI_QUERY = `
  SELECT ${dualAmountExpr('frl', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
  FROM fact.Fact_Returns_Legacy frl
  ${returnsUsdConversionJoin('frl')}
  WHERE frl.IsVoided = 0 ${RETURNS_DATE_WINDOW}
`;

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const idx = parseInt(m, 10) - 1;
  return names[idx] ? `${names[idx]} ${y.slice(2)}` : ym;
}

async function handleKpis(): Promise<NextResponse> {
  const pool = await getDwhPool();
  const [kpiResult, returnsResult] = await Promise.all([
    pool.request().query(KPIS_QUERY),
    pool.request().query(RETURNS_KPI_QUERY),
  ]);
  const returnsRow = returnsResult.recordset[0] as { ReturnsBs: number | null; ReturnsUsd: number | null } | undefined;
  const returns: DualAmount = !returnsRow || returnsRow.ReturnsBs === null ? { bs: 0, usd: 0 } : dualFromRow(returnsRow.ReturnsBs, returnsRow.ReturnsUsd);

  const row = kpiResult.recordset[0] as { SalesGrossBs: number | null; SalesGrossUsd: number | null; UnitsSold: number | null; ActiveClients: number; InvoiceCount: number };
  const salesGrossBs = Number(row.SalesGrossBs ?? 0);
  const salesGrossUsd = row.SalesGrossUsd === null ? null : Number(row.SalesGrossUsd);
  const invoiceCount = Number(row.InvoiceCount ?? 0);

  const salesGross: DualAmount = { bs: salesGrossBs, usd: salesGrossUsd };

  const kpis: HistoricoKpis = {
    salesGross,
    returns,
    salesNet: subtractDual(salesGross, returns),
    returnRate: returnRate(returns, salesGross),
    activeClients: Number(row.ActiveClients ?? 0),
    avgTicket: invoiceCount > 0 ? { bs: salesGrossBs / invoiceCount, usd: salesGrossUsd === null ? null : salesGrossUsd / invoiceCount } : null,
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
          salesGrossBs: Number(r.SalesGrossBs),
          salesGrossUsd: r.SalesGrossUsd === null ? null : Number(r.SalesGrossUsd),
        })),
      });
    }

    let recordset: Record<string, unknown>[];
    const breadcrumb: HistoricoResponse['breadcrumb'] = [{ label: 'Histórico 2025', groupBy: 'mes' }];

    if (groupBy === 'cliente') {
      const req = pool.request();
      let monthFilter = '';
      let returnsMonthFilter = '';
      if (month) {
        if (!/^\d{4}-\d{2}$/.test(month)) {
          return NextResponse.json({ error: 'Parámetro month inválido' }, { status: 400 });
        }
        req.input('month', month);
        monthFilter = 'AND d.YearMonth = @month';
        returnsMonthFilter = buildReturnsDateWhereClause(`month:${month}`, 'frl');
      }
      let salesRepFilter = '';
      let returnsSalesRepFilter = '';
      if (salesRepKey !== null) {
        req.input('salesRepKey', salesRepKey);
        salesRepFilter = 'AND fsl.SalesRepLegacyKey = @salesRepKey';
        returnsSalesRepFilter = 'AND frl.SalesRepLegacyKey = @salesRepKey';
      }
      const result = await req.query(clienteQuery(monthFilter, salesRepFilter, returnsMonthFilter, returnsSalesRepFilter));
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
      const salesGross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
      const returns = dualFromRow(r.ReturnsBs, r.ReturnsUsd);
      const label = groupBy === 'mes' ? formatYearMonth(String(r.GroupLabel)) : String(r.GroupLabel);
      return {
        label,
        value: r.GroupValue as string,
        salesGross,
        returns,
        salesNet: subtractDual(salesGross, returns),
        returnRate: returnRate(returns, salesGross),
      };
    });

    const response: HistoricoResponse = { rows, groupBy, breadcrumb };
    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
