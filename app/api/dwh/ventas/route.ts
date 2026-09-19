import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimension, isDimensionForFact, isClienteDimension, jsonWithCache, type Dimension } from '@/app/api/dwh/lib/query-builder';
import type {
  VentasResponse, VentasRow, GroupBy,
  VentasKpis, VentasKpisResponse,
  ComparisonOption, ComparisonOptionsResponse, ComparisonSeriesMonthRow, VentasComparisonResponse,
} from '@/app/(app)/analitica/types';

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

const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE_RE = /^month:(\d{4})-(\d{2})$/;
const YTD_RANGE_RE = /^ytd:(\d{4})$/;

function toDateKey(d: Date): number {
  return parseInt(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
}

function dateKeyToDate(key: number): Date {
  const s = String(key);
  return new Date(Date.UTC(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8))));
}

// Same-length period immediately preceding `dateRange`, for the KPI row's
// period-over-period Δ% — deliberately NOT year-over-year (no prior-year
// data exists yet, per product decision). month:/ytd: shift by exactly one
// calendar unit (a real previous month or previous year-to-date), while
// custom:/the trailing-365-day default shift by the range's own day count,
// so a partial YTD range compares against the same number of elapsed days
// last year rather than a full prior year.
function buildPrevPeriodDateWhereClause(dateRange: string, tableName: string): string | null {
  const monthMatch = MONTH_RANGE_RE.exec(dateRange);
  if (monthMatch) {
    const [, yearStr, monthStr] = monthMatch;
    const year = parseInt(yearStr);
    const month = parseInt(monthStr); // 1-indexed
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const startKey = toDateKey(new Date(Date.UTC(prevYear, prevMonth - 1, 1)));
    const endKey = toDateKey(new Date(Date.UTC(prevYear, prevMonth, 0)));
    return `AND ${tableName}.DateKey >= ${startKey} AND ${tableName}.DateKey <= ${endKey}`;
  }

  const ytdMatch = YTD_RANGE_RE.exec(dateRange);
  if (ytdMatch) {
    const year = parseInt(ytdMatch[1]) - 1;
    const startKey = year * 10000 + 101;
    const currentYear = new Date().getUTCFullYear();
    const currentMonthDay = parseInt(new Date().toISOString().slice(5, 10).replace('-', ''));
    const endKey = year * 10000 + currentMonthDay;
    if (ytdMatch[1] !== String(currentYear)) return null; // a past, already-closed YTD year has no well-defined "same elapsed days" prior year
    return `AND ${tableName}.DateKey >= ${startKey} AND ${tableName}.DateKey <= ${endKey}`;
  }

  const customMatch = CUSTOM_RANGE_RE.exec(dateRange);
  if (customMatch) {
    const [, start, end] = customMatch;
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    const prevEndKey = toDateKey(new Date(startDate.getTime() - 86_400_000));
    const prevStartKey = toDateKey(new Date(dateKeyToDate(prevEndKey).getTime() - (days - 1) * 86_400_000));
    return `AND ${tableName}.DateKey >= ${prevStartKey} AND ${tableName}.DateKey <= ${prevEndKey}`;
  }

  // Trailing-365-day default (buildDateWhereClause's own fallback): the
  // previous period is the 365 days immediately before that window.
  return `AND ${tableName}.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -730, GETDATE()), 'yyyyMMdd')) AND ${tableName}.DateKey < CONVERT(INT, FORMAT(DATEADD(DAY, -365, GETDATE()), 'yyyyMMdd'))`;
}

// KPI row: totals for the current range, plus the same-length immediately-
// preceding period (for the Δ% card) and a distinct-invoice count (Fact_Sales
// is line-grain, so COUNT(*) would overcount orders).
const KPIS_QUERY = (dateWhere: string) => `
  SELECT
    SUM(fs.NetAmount) AS SalesNet,
    SUM(fs.QuantitySold) AS UnitsSold,
    COUNT(DISTINCT le.LegalEntityKey) AS ActiveClients,
    COUNT(DISTINCT fs.InvoiceNumber) AS InvoiceCount
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
  WHERE fs.IsVoided = 0 ${dateWhere}
`;

const PREV_PERIOD_SALES_QUERY = (dateWhere: string) => `
  SELECT SUM(fs.NetAmount) AS SalesNet
  FROM fact.Fact_Sales fs
  WHERE fs.IsVoided = 0 ${dateWhere}
`;

// Top líneas / cadenas (cliente_entidad) by sales in range, for populating
// the comparison-chart multi-selects — same TOP-N-by-volume pattern as
// productos/route.ts's topLineasQuery, just against SalesNet instead of
// QuantitySold, and reused for both the línea and cadena option lists.
function topLineasOptionsQuery(dateWhere: string): string {
  return `
    SELECT TOP 12 ISNULL(p.LineCode, 'SIN_LINEA') AS Value, ISNULL(p.LineName, 'Sin línea') AS Label
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.LineCode, 'SIN_LINEA'), ISNULL(p.LineName, 'Sin línea')
    ORDER BY SUM(fs.NetAmount) DESC
  `;
}

function topClientesOptionsQuery(dateWhere: string): string {
  return `
    SELECT TOP 12 CAST(le.LegalEntityKey AS varchar(20)) AS Value, le.LegalEntityName AS Label
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY le.LegalEntityKey, le.LegalEntityName
    ORDER BY SUM(fs.NetAmount) DESC
  `;
}

// Monthly salesNet per selected línea/cadena, for the comparison line
// charts. @keys is a comma-joined list of LineCode or LegalEntityKey
// values (2-4 expected, validated by the caller) spliced directly into an
// IN(...) list via parameterized inputs (kN), never string-concatenated.
function comparisonByLineaQuery(dateWhere: string, keyParams: string[]): string {
  return `
    SELECT d.YearMonth, ISNULL(p.LineCode, 'SIN_LINEA') AS SeriesKey, SUM(fs.NetAmount) AS SalesNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} AND ISNULL(p.LineCode, 'SIN_LINEA') IN (${keyParams.join(', ')})
    GROUP BY d.YearMonth, ISNULL(p.LineCode, 'SIN_LINEA')
    ORDER BY d.YearMonth
  `;
}

function comparisonByClienteQuery(dateWhere: string, keyParams: string[]): string {
  return `
    SELECT d.YearMonth, CAST(le.LegalEntityKey AS varchar(20)) AS SeriesKey, SUM(fs.NetAmount) AS SalesNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} AND le.LegalEntityKey IN (${keyParams.join(', ')})
    GROUP BY d.YearMonth, le.LegalEntityKey
    ORDER BY d.YearMonth
  `;
}

async function handleKpis(dateWhere: string, prevDateWhere: string | null, currency: string) {
  const pool = await getDwhPool();
  const [kpiResult, prevResult, usdRate] = await Promise.all([
    pool.request().query(KPIS_QUERY(dateWhere)),
    prevDateWhere !== null ? pool.request().query(PREV_PERIOD_SALES_QUERY(prevDateWhere)) : Promise.resolve(null),
    currency === 'usd' ? getUsdRate() : Promise.resolve(null),
  ]);

  const row = kpiResult.recordset[0] as { SalesNet: number | null; UnitsSold: number | null; ActiveClients: number; InvoiceCount: number };
  const salesNet = Number(row.SalesNet ?? 0);
  const activeClients = Number(row.ActiveClients ?? 0);
  const invoiceCount = Number(row.InvoiceCount ?? 0);
  const salesNetPrevPeriod = prevResult ? Number(prevResult.recordset[0]?.SalesNet ?? 0) : null;

  const kpis: VentasKpis = {
    salesNet,
    salesNetPrevPeriod,
    activeClients,
    avgTicket: invoiceCount > 0 ? salesNet / invoiceCount : null,
    unitsSold: Number(row.UnitsSold ?? 0),
    salesPerActiveClient: activeClients > 0 ? salesNet / activeClients : null,
  };

  const response: VentasKpisResponse = { kpis, usdRate };
  return jsonWithCache(response);
}

async function handleComparisonOptions(dateWhere: string) {
  const pool = await getDwhPool();
  const [lineasResult, clientesResult] = await Promise.all([
    pool.request().query(topLineasOptionsQuery(dateWhere)),
    pool.request().query(topClientesOptionsQuery(dateWhere)),
  ]);
  const toOptions = (rs: { Value: string; Label: string }[]): ComparisonOption[] =>
    rs.map(r => ({ value: r.Value, label: r.Label }));
  const response: ComparisonOptionsResponse = {
    lineas: toOptions(lineasResult.recordset),
    clientes: toOptions(clientesResult.recordset),
  };
  return jsonWithCache(response);
}

async function handleComparison(dateWhere: string, keys: string[], mode: 'linea' | 'cliente', currency: string) {
  const pool = await getDwhPool();
  const req = pool.request();
  const keyParams = keys.map((k, i) => {
    req.input(`k${i}`, k);
    return `@k${i}`;
  });
  const query = mode === 'linea' ? comparisonByLineaQuery(dateWhere, keyParams) : comparisonByClienteQuery(dateWhere, keyParams);
  const [result, usdRate] = await Promise.all([
    req.query(query),
    currency === 'usd' ? getUsdRate() : Promise.resolve(null),
  ]);

  const byMonth = new Map<string, ComparisonSeriesMonthRow>();
  for (const r of result.recordset as { YearMonth: string; SeriesKey: string; SalesNet: number }[]) {
    let entry = byMonth.get(r.YearMonth);
    if (!entry) {
      entry = { yearMonth: formatYearMonth(r.YearMonth), yearMonthValue: r.YearMonth, values: {} };
      byMonth.set(r.YearMonth, entry);
    }
    entry.values[r.SeriesKey] = Number(r.SalesNet);
  }
  const rows = Array.from(byMonth.values()).sort((a, b) => a.yearMonthValue.localeCompare(b.yearMonthValue));

  const response: VentasComparisonResponse = { rows, usdRate };
  return jsonWithCache(response);
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

  const section = searchParams.get('section');
  if (section === 'kpis') {
    try {
      const dateWhere = buildDateWhereClause(dateRange, 'fs');
      const prevDateWhere = buildPrevPeriodDateWhereClause(dateRange, 'fs');
      return await handleKpis(dateWhere, prevDateWhere, currency);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }
  if (section === 'comparisonOptions') {
    try {
      const dateWhere = buildDateWhereClause(dateRange, 'fs');
      return await handleComparisonOptions(dateWhere);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }
  if (section === 'comparisonLinea' || section === 'comparisonCliente') {
    const keys = (searchParams.get('keys') ?? '').split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length < 1 || keys.length > 4) {
      return NextResponse.json({ error: 'Se requieren entre 1 y 4 series para comparar' }, { status: 400 });
    }
    try {
      const dateWhere = buildDateWhereClause(dateRange, 'fs');
      return await handleComparison(dateWhere, keys, section === 'comparisonLinea' ? 'linea' : 'cliente', currency);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

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
