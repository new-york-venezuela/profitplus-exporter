import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { parseTrendBucket, bucketFilterClause, type TrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { bucketLabels, bucketTitle } from '@/app/(app)/analitica/lib/granularity';
import {
  buildDateWhereClause, buildPrevThirtyDayWhereClause, buildReturnsDateWhereClause, getDimensionSpec, isDimension, isDimensionForFact,
  isClienteDimension, jsonWithCache, usdConversionJoin, returnsUsdConversionJoin, returnsAmountSubqueries, dualAmountExpr,
  parseReturnsBasis, returnsDateColumn, type Dimension,
} from '@/app/api/dwh/lib/query-builder';
import { dualFromRow, returnRate, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import type {
  VentasResponse, VentasRow, GroupBy,
  VentasKpis, VentasKpisResponse,
  ComparisonOption, ComparisonOptionsResponse, ComparisonSeriesMonthRow, VentasComparisonResponse,
  DualAmount,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// All queries here read from the pre-aggregated dwh/dim/fact schema in
// DWH_AlimentosNY (see migrations/dwh/), not the raw Profit Plus ERP —
// so no COLLATE/RTRIM gymnastics are needed here, that work already
// happened at load time.

// Sales and returns are aggregated per bucket in separate CTEs and joined on
// the bucket key (not a correlated subquery — see resumen/route.ts's
// monthlyTrendQuery for why). Both sides are range-scoped so the aggregate
// 'range' bucket can't sum returns outside the period. Returns are bucketed
// by `returnsColumn` (OriginalInvoiceDateKey for basis 'factura', DateKey for
// 'devolucion' — see ReturnsBasis in query-builder.ts). FULL OUTER JOIN so a
// bucket with returns but no sales (possible on the devolución basis) still
// shows up.
function monthlyQuery(dateWhere: string, returnsDateWhere: string, bucket: TrendBucket, returnsColumn: string): string {
  return `
    WITH sales AS (
      SELECT
        ${bucket.keyExpr('d')} AS Bucket,
        ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
        SUM(fs.GrossAmount) AS GrossAmount,
        SUM(fs.DiscountAmount) AS DiscountAmount
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      WHERE fs.IsVoided = 0 ${dateWhere}
      GROUP BY ${bucket.keyExpr('d')}
    ),
    rets AS (
      SELECT
        ${bucket.keyExpr('dr')} AS Bucket,
        ${dualAmountExpr('fr', 'NetAmount', 'ReturnsBs', 'ReturnsUsd', 'frfx')}
      FROM fact.Fact_Returns fr
      ${returnsUsdConversionJoin('fr', 'frfx')}
      JOIN dim.Dim_Date dr ON dr.DateKey = fr.${returnsColumn}
      WHERE fr.IsVoided = 0 ${returnsDateWhere}
      GROUP BY ${bucket.keyExpr('dr')}
    )
    SELECT
      COALESCE(s.Bucket, r.Bucket) AS GroupValue,
      COALESCE(s.Bucket, r.Bucket) AS GroupLabel,
      ISNULL(s.SalesGrossBs, 0) AS SalesGrossBs,
      CASE WHEN s.Bucket IS NULL THEN 0 ELSE s.SalesGrossUsd END AS SalesGrossUsd,
      ISNULL(s.GrossAmount, 0) AS GrossAmount,
      ISNULL(s.DiscountAmount, 0) AS DiscountAmount,
      ISNULL(r.ReturnsBs, 0) AS ReturnsBs,
      CASE WHEN r.Bucket IS NULL THEN 0 ELSE r.ReturnsUsd END AS ReturnsUsd
    FROM sales s
    FULL OUTER JOIN rets r ON r.Bucket = s.Bucket
    ORDER BY COALESCE(s.Bucket, r.Bucket)
  `;
}

// Top customers. Scoped to a single bucket/month when one is supplied
// (drill-down from the trend chart), otherwise to the dateRange. Also
// optionally scoped to a single sales rep when @salesRepKey is supplied. The
// returns subqueries get the SAME bucket/month and seller scope (built
// against their own alias and the selected returns-date column), so the
// row's return rate compares like with like.
function clienteQuery(
  dimension: Dimension,
  dateWhere: string,
  returnsDateWhere: string,
  monthFilter: string,
  salesRepFilter: string,
  returnsMonthFilter: string,
  returnsSalesRepFilter: string,
): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fr2');
  return `
    SELECT TOP 15
      ${spec.valueExpr} AS GroupValue,
      ${spec.labelExpr} AS GroupLabel,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      ${returnsAmountSubqueries({
        alias: 'fr2',
        fxAlias: 'r2fx',
        extraJoins: innerJoin,
        where: `${returnsDateWhere} ${returnsMonthFilter} ${returnsSalesRepFilter} AND ${condition}`,
        bsAlias: 'ReturnsBs',
        usdAlias: 'ReturnsUsd',
      })}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${monthFilter} ${salesRepFilter}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesGrossBs DESC
  `;
}

function lineaQuery(dateWhere: string, returnsDateWhere: string): string {
  return `
    SELECT TOP 15
      ISNULL(p.LineCode, 'SIN_LINEA') AS GroupValue,
      ISNULL(p.LineName, 'Sin línea') AS GroupLabel,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      ${returnsAmountSubqueries({
        alias: 'fr',
        fxAlias: 'frfx',
        extraJoins: 'JOIN dim.Dim_Product pr ON pr.ProductKey = fr.ProductKey',
        where: `AND ISNULL(pr.LineCode, 'SIN_LINEA') = ISNULL(p.LineCode, 'SIN_LINEA') ${returnsDateWhere}`,
        bsAlias: 'ReturnsBs',
        usdAlias: 'ReturnsUsd',
      })}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.LineCode, 'SIN_LINEA'), ISNULL(p.LineName, 'Sin línea')
    ORDER BY SalesGrossBs DESC
  `;
}

// Products within a single línea (parentValue = LineCode, or the
// 'SIN_LINEA' sentinel lineaQuery uses for products with no line assigned).
function lineaProductBreakdownQuery(salesDateWhere: string): string {
  return `
    SELECT TOP 15
      CAST(p.ProductKey AS varchar(20)) AS GroupValue,
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 AND ISNULL(p.LineCode, 'SIN_LINEA') = @parentValue ${salesDateWhere}
    GROUP BY p.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesGrossBs DESC
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
function buildPrevPeriodDateWhereClause(dateRange: string, tableName: string, column: string = 'DateKey'): string | null {
  const monthMatch = MONTH_RANGE_RE.exec(dateRange);
  if (monthMatch) {
    const [, yearStr, monthStr] = monthMatch;
    const year = parseInt(yearStr);
    const month = parseInt(monthStr); // 1-indexed
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const startKey = toDateKey(new Date(Date.UTC(prevYear, prevMonth - 1, 1)));
    const endKey = toDateKey(new Date(Date.UTC(prevYear, prevMonth, 0)));
    return `AND ${tableName}.${column} >= ${startKey} AND ${tableName}.${column} <= ${endKey}`;
  }

  const ytdMatch = YTD_RANGE_RE.exec(dateRange);
  if (ytdMatch) {
    const year = parseInt(ytdMatch[1]) - 1;
    const startKey = year * 10000 + 101;
    const currentYear = new Date().getUTCFullYear();
    const currentMonthDay = parseInt(new Date().toISOString().slice(5, 10).replace('-', ''));
    const endKey = year * 10000 + currentMonthDay;
    if (ytdMatch[1] !== String(currentYear)) return null; // a past, already-closed YTD year has no well-defined "same elapsed days" prior year
    return `AND ${tableName}.${column} >= ${startKey} AND ${tableName}.${column} <= ${endKey}`;
  }

  const customMatch = CUSTOM_RANGE_RE.exec(dateRange);
  if (customMatch) {
    const [, start, end] = customMatch;
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    const prevEndKey = toDateKey(new Date(startDate.getTime() - 86_400_000));
    const prevStartKey = toDateKey(new Date(dateKeyToDate(prevEndKey).getTime() - (days - 1) * 86_400_000));
    return `AND ${tableName}.${column} >= ${prevStartKey} AND ${tableName}.${column} <= ${prevEndKey}`;
  }

  if (dateRange === '30d') return buildPrevThirtyDayWhereClause(tableName, column);

  // Trailing-365-day default (buildDateWhereClause's own fallback): the
  // previous period is the 365 days immediately before that window.
  return `AND ${tableName}.${column} >= CONVERT(INT, FORMAT(DATEADD(DAY, -730, GETDATE()), 'yyyyMMdd')) AND ${tableName}.${column} < CONVERT(INT, FORMAT(DATEADD(DAY, -365, GETDATE()), 'yyyyMMdd'))`;
}

// KPI row: totals for the current range, plus the same-length immediately-
// preceding period (for the Δ% card) and a distinct-invoice count (Fact_Sales
// is line-grain, so COUNT(*) would overcount orders).
const KPIS_QUERY = (dateWhere: string) => `
  SELECT
    ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
    SUM(fs.QuantitySold) AS UnitsSold,
    COUNT(DISTINCT le.LegalEntityKey) AS ActiveClients,
    COUNT(DISTINCT fs.InvoiceNumber) AS InvoiceCount
  FROM fact.Fact_Sales fs
  ${usdConversionJoin('fs')}
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
  WHERE fs.IsVoided = 0 ${dateWhere}
`;

const PREV_PERIOD_SALES_QUERY = (dateWhere: string) => `
  SELECT ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
  FROM fact.Fact_Sales fs
  ${usdConversionJoin('fs')}
  WHERE fs.IsVoided = 0 ${dateWhere}
`;

// Devoluciones for a period on the selected basis (returnsDateWhere is built
// against `fr` with OriginalInvoiceDateKey or DateKey), USD at factura rate.
const RETURNS_TOTAL_QUERY = (returnsDateWhere: string) => `
  SELECT ${dualAmountExpr('fr', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
  FROM fact.Fact_Returns fr
  ${returnsUsdConversionJoin('fr')}
  WHERE fr.IsVoided = 0 ${returnsDateWhere}
`;

// Top líneas / cadenas (cliente_entidad) by sales in range, for populating
// the comparison-chart multi-selects — same TOP-N-by-volume pattern as
// productos/route.ts's topLineasQuery, just against SalesGross instead of
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

// Per-bucket (day/week/month) salesGross per selected línea/cadena, for the comparison line
// charts. @keys is a comma-joined list of LineCode or LegalEntityKey
// values (2-4 expected, validated by the caller) spliced directly into an
// IN(...) list via parameterized inputs (kN), never string-concatenated.
function comparisonByLineaQuery(dateWhere: string, keyParams: string[], bucket: TrendBucket): string {
  return `
    SELECT ${bucket.keyExpr('d')} AS Bucket, ISNULL(p.LineCode, 'SIN_LINEA') AS SeriesKey, ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} AND ISNULL(p.LineCode, 'SIN_LINEA') IN (${keyParams.join(', ')})
    GROUP BY ${bucket.keyExpr('d')}, ISNULL(p.LineCode, 'SIN_LINEA')
    ORDER BY ${bucket.keyExpr('d')}
  `;
}

function comparisonByClienteQuery(dateWhere: string, keyParams: string[], bucket: TrendBucket): string {
  return `
    SELECT ${bucket.keyExpr('d')} AS Bucket, CAST(le.LegalEntityKey AS varchar(20)) AS SeriesKey, ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} AND le.LegalEntityKey IN (${keyParams.join(', ')})
    GROUP BY ${bucket.keyExpr('d')}, le.LegalEntityKey
    ORDER BY ${bucket.keyExpr('d')}
  `;
}

async function handleKpis(
  dateWhere: string,
  prevDateWhere: string | null,
  returnsDateWhere: string,
  prevReturnsDateWhere: string | null,
): Promise<NextResponse> {
  const pool = await getDwhPool();
  const [kpiResult, prevResult, returnsResult, prevReturnsResult] = await Promise.all([
    pool.request().query(KPIS_QUERY(dateWhere)),
    prevDateWhere !== null ? pool.request().query(PREV_PERIOD_SALES_QUERY(prevDateWhere)) : Promise.resolve(null),
    pool.request().query(RETURNS_TOTAL_QUERY(returnsDateWhere)),
    prevReturnsDateWhere !== null ? pool.request().query(RETURNS_TOTAL_QUERY(prevReturnsDateWhere)) : Promise.resolve(null),
  ]);

  const row = kpiResult.recordset[0] as { SalesGrossBs: number | null; SalesGrossUsd: number | null; UnitsSold: number | null; ActiveClients: number; InvoiceCount: number };
  const salesGross = dualFromRow(row.SalesGrossBs, row.SalesGrossUsd);
  const activeClients = Number(row.ActiveClients ?? 0);
  const invoiceCount = Number(row.InvoiceCount ?? 0);
  const returnsRow = returnsResult.recordset[0] as { ReturnsBs: number | null; ReturnsUsd: number | null } | undefined;
  // An empty returns set sums to NULL in both columns: that is "no returns" (0), not "unknown USD".
  const returns = returnsRow?.ReturnsBs === null || returnsRow === undefined ? { bs: 0, usd: 0 } : dualFromRow(returnsRow.ReturnsBs, returnsRow.ReturnsUsd);
  const salesNet = subtractDual(salesGross, returns);

  let salesNetPrevPeriod: DualAmount | null = null;
  if (prevResult) {
    const prevRow = prevResult.recordset[0] as { SalesGrossBs: number | null; SalesGrossUsd: number | null } | undefined;
    const prevGross = prevRow?.SalesGrossBs === null || prevRow === undefined ? { bs: 0, usd: 0 } : dualFromRow(prevRow.SalesGrossBs, prevRow.SalesGrossUsd);
    const prevReturnsRow = prevReturnsResult?.recordset[0] as { ReturnsBs: number | null; ReturnsUsd: number | null } | undefined;
    const prevReturns = prevReturnsRow?.ReturnsBs === null || prevReturnsRow === undefined ? { bs: 0, usd: 0 } : dualFromRow(prevReturnsRow.ReturnsBs, prevReturnsRow.ReturnsUsd);
    salesNetPrevPeriod = subtractDual(prevGross, prevReturns);
  }

  const kpis: VentasKpis = {
    salesGross,
    returns,
    salesNet,
    salesNetPrevPeriod,
    returnRate: returnRate(returns, salesGross),
    activeClients,
    avgTicket: invoiceCount > 0 ? { bs: salesGross.bs / invoiceCount, usd: salesGross.usd === null ? null : salesGross.usd / invoiceCount } : null,
    unitsSold: Number(row.UnitsSold ?? 0),
    salesPerActiveClient: activeClients > 0 ? { bs: salesGross.bs / activeClients, usd: salesGross.usd === null ? null : salesGross.usd / activeClients } : null,
  };

  const response: VentasKpisResponse = { kpis };
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

async function handleComparison(dateWhere: string, keys: string[], mode: 'linea' | 'cliente', bucket: TrendBucket): Promise<NextResponse> {
  const pool = await getDwhPool();
  const req = pool.request();
  const keyParams = keys.map((k, i) => {
    req.input(`k${i}`, k);
    return `@k${i}`;
  });
  const query = mode === 'linea' ? comparisonByLineaQuery(dateWhere, keyParams, bucket) : comparisonByClienteQuery(dateWhere, keyParams, bucket);
  const result = await req.query(query);

  const byBucket = new Map<string, ComparisonSeriesMonthRow>();
  for (const r of result.recordset as { Bucket: string; SeriesKey: string; SalesGrossBs: number; SalesGrossUsd: number | null }[]) {
    let entry = byBucket.get(r.Bucket);
    if (!entry) {
      entry = { bucket: r.Bucket, values: {} };
      byBucket.set(r.Bucket, entry);
    }
    entry.values[r.SeriesKey] = { bs: Number(r.SalesGrossBs), usd: r.SalesGrossUsd === null ? null : Number(r.SalesGrossUsd) };
  }
  const rows = Array.from(byBucket.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));

  const response: VentasComparisonResponse = { rows, trendMode: bucket.mode };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
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
  const bucketParam = searchParams.get('bucket');
  const trendBucket = parseTrendBucket(searchParams, dateRange);
  const salesRepKeyParam = searchParams.get('salesRepKey');
  const salesRepKey = salesRepKeyParam && /^\d+$/.test(salesRepKeyParam) ? Number(salesRepKeyParam) : null;

  const returnsBasis = parseReturnsBasis(searchParams.get('returnsBasis'));
  const returnsColumn = returnsDateColumn(returnsBasis);

  const section = searchParams.get('section');
  if (section === 'kpis') {
    try {
      const dateWhere = buildDateWhereClause(dateRange, 'fs');
      const prevDateWhere = buildPrevPeriodDateWhereClause(dateRange, 'fs');
      const returnsDateWhere = buildReturnsDateWhereClause(dateRange, 'fr', returnsBasis);
      const prevReturnsDateWhere = buildPrevPeriodDateWhereClause(dateRange, 'fr', returnsColumn);
      return await handleKpis(dateWhere, prevDateWhere, returnsDateWhere, prevReturnsDateWhere);
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
      return await handleComparison(dateWhere, keys, section === 'comparisonLinea' ? 'linea' : 'cliente', parseTrendBucket(searchParams, dateRange));
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  try {
    const pool = await getDwhPool();

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const returnsDateWhere = buildReturnsDateWhereClause(dateRange, 'fr', returnsBasis);
    // clienteQuery's correlated returns subquery aliases Fact_Returns as `fr2`
    // (via spec.correlate), not `fr` like monthlyQuery/lineaQuery, so it needs
    // its own date-where clause built against that alias.
    const clienteReturnsDateWhere = buildReturnsDateWhereClause(dateRange, 'fr2', returnsBasis);

    if (breakdownBy && parentValue && groupByParam === 'linea') {
      const req = pool.request();
      req.input('parentValue', parentValue);
      const result = await req.query(lineaProductBreakdownQuery(salesDateWhere));
      return jsonWithCache({
        breakdown: result.recordset.map(r => ({
          label: r.GroupLabel,
          value: String(r.GroupValue),
          salesGrossBs: Number(r.SalesGrossBs),
          salesGrossUsd: r.SalesGrossUsd === null ? null : Number(r.SalesGrossUsd),
        })),
      });
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
        SELECT TOP 15 ${breakdownSpec.valueExpr} AS GroupValue, ${breakdownSpec.labelExpr} AS GroupLabel, ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
        FROM fact.Fact_Sales fs
        ${usdConversionJoin('fs')}
        ${breakdownSpec.joinClause.replace(/\bf\b/g, 'fs')}
        ${parentSpec.joinClause.replace(/\bf\b/g, 'fs')}
        WHERE fs.IsVoided = 0 AND ${parentSpec.valueExpr.replace(/\bf\b/g, 'fs')} = @parentValue ${salesDateWhere}
        GROUP BY ${breakdownSpec.groupByColumn}
        ORDER BY SalesGrossBs DESC
      `);
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
    const breadcrumb: VentasResponse['breadcrumb'] = [{ label: 'Ventas', groupBy: 'mes' }];

    if (groupBy === 'cliente') {
      const req = pool.request();
      let monthFilter = '';
      let returnsMonthFilter = '';
      if (bucketParam) {
        // Drill-down from a trend bar: filter to that bucket's date span (the
        // clause is built from regex-validated digits, not user text). The
        // returns subquery gets the same span on its own date column.
        const clause = bucketFilterClause(trendBucket.mode, bucketParam, 'fs');
        const returnsClause = bucketFilterClause(trendBucket.mode, bucketParam, 'fr2', returnsColumn);
        if (clause === null || returnsClause === null) {
          return NextResponse.json({ error: 'Parámetro bucket inválido' }, { status: 400 });
        }
        monthFilter = clause;
        returnsMonthFilter = returnsClause;
      } else if (month) {
        if (!/^\d{4}-\d{2}$/.test(month)) {
          return NextResponse.json({ error: 'Parámetro month inválido' }, { status: 400 });
        }
        req.input('month', month);
        monthFilter = 'AND d.YearMonth = @month';
        returnsMonthFilter = buildDateWhereClause(`month:${month}`, 'fr2', returnsColumn);
      }
      let salesRepFilter = '';
      let returnsSalesRepFilter = '';
      if (salesRepKey !== null) {
        req.input('salesRepKey', salesRepKey);
        salesRepFilter = 'AND fs.SalesRepKey = @salesRepKey';
        returnsSalesRepFilter = 'AND fr2.SalesRepKey = @salesRepKey';
      }
      const result = await req.query(clienteQuery(clienteDimension, salesDateWhere, clienteReturnsDateWhere, monthFilter, salesRepFilter, returnsMonthFilter, returnsSalesRepFilter));
      recordset = result.recordset;
      breadcrumb.push({ label: bucketParam ? bucketTitle(trendBucket.mode, bucketParam) : month ? formatYearMonth(month) : 'Clientes', groupBy: 'cliente' });
    } else if (groupBy === 'linea') {
      const result = await pool.request().query(lineaQuery(salesDateWhere, returnsDateWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: 'Líneas', groupBy: 'linea' });
    } else {
      const result = await pool.request().query(monthlyQuery(salesDateWhere, returnsDateWhere, trendBucket, returnsColumn));
      recordset = result.recordset;
    }

    const trendKeys = groupBy === 'mes' ? recordset.map(r => String(r.GroupValue)) : [];
    const trendXLabels = bucketLabels(trendBucket.mode, trendKeys);
    const rows: VentasRow[] = recordset.map((r, i) => {
      const salesGross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
      const returns = dualFromRow(r.ReturnsBs, r.ReturnsUsd);
      const grossAmount = Number(r.GrossAmount);
      const discountAmount = Number(r.DiscountAmount);
      const label = groupBy === 'mes' ? trendXLabels[i] : String(r.GroupLabel);
      return {
        label,
        ...(groupBy === 'mes' ? { title: bucketTitle(trendBucket.mode, String(r.GroupValue)) } : {}),
        value: r.GroupValue as string,
        salesGross,
        returns,
        salesNet: subtractDual(salesGross, returns),
        returnRate: returnRate(returns, salesGross),
        avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
      };
    });

    const response: VentasResponse = { rows, groupBy, breadcrumb, returnsBasis, ...(groupBy === 'mes' ? { trendMode: trendBucket.mode } : {}) };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
