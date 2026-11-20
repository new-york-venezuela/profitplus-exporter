import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import {
  buildDateWhereClause, buildPrevThirtyDayWhereClause, buildReturnsDateWhereClause, getDimensionSpec, isClienteDimension,
  jsonWithCache, usdConversionJoin, returnsAmountSubqueries, dualAmountExpr, type Dimension,
} from '@/app/api/dwh/lib/query-builder';
import { buildPrevPeriodDateWhereClause as sharedPrevPeriodWhere, rangeEndDateKey, rangeStartDateKey } from '@/app/api/dwh/lib/query-builder';
import { rollUpTrayectoria, type ClientesTrayectoriaResponse, type StoreAggregate } from '@/lib/clientes/trayectoria';
import { trayectoriaQuery } from '@/lib/clientes/trayectoria-sql';
import { subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import { bucketLabels, bucketSpan } from '@/app/(app)/analitica/lib/granularity';
import { parseTrendBucket, type TrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import {
  CLIENTES_GROUPS_QUERY, CLIENTES_ROUTES_QUERY, customerScope, parseCarteraScope, type CarteraScope,
} from '@/lib/clientes/scope';
import type {
  ClientesResponse,
  ClientesRow,
  ClientesTrendResponse,
  ClientesTrendRow,
  ClientesChurnedResponse,
  ClientesChurnedRow,
  ClientesFiltersResponse,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// migrations/dwh/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.

// Pareto (80/20) thresholds: customers are ranked by net sales descending,
// then bucketed by cumulative share of total net sales. A = top 20% of
// cumulative sales, B = next 30% (up to 50% cumulative), C = the rest.
const PARETO_THRESHOLDS = { a: 0.2, b: 0.5 };

const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE_RE = /^month:(\d{4})-(\d{2})$/;
const YTD_RANGE_RE = /^ytd:(\d{4})$/;

function dateKey(d: Date): number {
  return parseInt(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
}

// Mirrors buildDateWhereClause's own per-kind start-date parsing (see
// query-builder.ts), but returns that start date rather than a ready-made
// WHERE clause — trendQuery needs the raw date to (a) widen the fact-table
// window back by one calendar month, so the first requested month has a
// prior month to diff churn against, and (b) know the real requested
// start's YearMonth, to trim that extra leading month back off before
// returning rows.
function rangeStart(dateRange: string): Date {
  const customMatch = CUSTOM_RANGE_RE.exec(dateRange);
  if (customMatch) return new Date(`${customMatch[1]}T00:00:00Z`);

  const monthMatch = MONTH_RANGE_RE.exec(dateRange);
  if (monthMatch) {
    const [, yearStr, monthStr] = monthMatch;
    return new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, 1));
  }

  const ytdMatch = YTD_RANGE_RE.exec(dateRange);
  if (ytdMatch) return new Date(Date.UTC(parseInt(ytdMatch[1]), 0, 1));

  if (dateRange === '30d') return new Date(Date.now() - 29 * 86_400_000);

  // Trailing-365-day default — same fallback as buildDateWhereClause.
  return new Date(Date.now() - 365 * 86_400_000);
}

function widenedDateWhereClause(dateRange: string): string {
  const start = rangeStart(dateRange);
  const widenedStartKey = dateKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1)));
  const endWhere = buildDateWhereClause(dateRange, 'fs').match(/AND fs\.DateKey <= \d+/)?.[0] ?? '';
  return `AND fs.DateKey >= ${widenedStartKey} ${endWhere}`;
}

// Same-length period immediately preceding `dateRange`, for the churned-
// customers list. Duplicated from ../resumen/route.ts's function of the
// same name/body rather than shared — that's this codebase's existing
// per-route convention for this helper (see that file's own copy).
function buildPrevPeriodDateWhereClause(dateRange: string, tableName: string): string | null {
  const monthMatch = MONTH_RANGE_RE.exec(dateRange);
  if (monthMatch) {
    const [, yearStr, monthStr] = monthMatch;
    const year = parseInt(yearStr);
    const month = parseInt(monthStr); // 1-indexed
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const startKey = dateKey(new Date(Date.UTC(prevYear, prevMonth - 1, 1)));
    const endKey = dateKey(new Date(Date.UTC(prevYear, prevMonth, 0)));
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
    const prevEndKey = dateKey(new Date(startDate.getTime() - 86_400_000));
    const prevStartDate = new Date(startDate.getTime() - days * 86_400_000);
    const prevStartKey = dateKey(prevStartDate);
    return `AND ${tableName}.DateKey >= ${prevStartKey} AND ${tableName}.DateKey <= ${prevEndKey}`;
  }

  if (dateRange === '30d') return buildPrevThirtyDayWhereClause(tableName);

  // Trailing-365-day default (buildDateWhereClause's own fallback): the
  // previous period is the 365 days immediately before that window.
  return `AND ${tableName}.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -730, GETDATE()), 'yyyyMMdd')) AND ${tableName}.DateKey < CONVERT(INT, FORMAT(DATEADD(DAY, -365, GETDATE()), 'yyyyMMdd'))`;
}

// Customers/stores (at whichever grain `dimension` resolves to) with >=1
// sale in the PRIOR period but none in the current period — the row-level
// detail behind ClientesTrendRow.churnRate's aggregate percentage. Grouped
// by the prior period's own EntityKey so a customer who churned still shows
// their prior name/activity even if Dim_Customer's current row has since
// changed (SCD2) — labelExpr/valueExpr are evaluated against the SAME
// joined alias the NOT EXISTS lookup correlates on, so this doesn't need a
// separate "used to be called X" concept.
function churnedQuery(dimension: Dimension, prevDateWhere: string, currentDateWhere: string, scopeWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fs2');
  return `
    SELECT TOP 200
      ${spec.labelExpr} AS Name,
      MAX(fs.DateKey) AS LastPurchaseDateKey,
      ${dualAmountExpr('fs', 'NetAmount', 'LostRevenueBs', 'LostRevenueUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${prevDateWhere} ${scopeWhere}
      AND NOT EXISTS (
        SELECT 1 FROM fact.Fact_Sales fs2
        ${innerJoin}
        WHERE fs2.IsVoided = 0 ${currentDateWhere} AND ${condition}
      )
    GROUP BY ${spec.groupByColumn}
    ORDER BY LostRevenueBs DESC
  `;
}

async function handleChurned(dimension: Dimension, dateRange: string, scope: CarteraScope): Promise<NextResponse> {
  const prevSalesDateWhere = buildPrevPeriodDateWhereClause(dateRange, 'fs');
  if (prevSalesDateWhere === null) {
    const response: ClientesChurnedResponse = { rows: [], available: false };
    return jsonWithCache(response);
  }

  const pool = await getDwhPool();
  // churnedQuery's correlated NOT EXISTS lookup aliases Fact_Sales as `fs2`
  // (via spec.correlate), not `fs`, so it needs its own current-period
  // where-clause built against that alias — same reasoning as
  // salesDateWhereFs2 in the main GET handler below.
  const currentSalesDateWhere = buildDateWhereClause(dateRange, 'fs2');

  const sc = customerScope(scope, 'c');
  const req = pool.request();
  sc.bind(req);
  const churned = await req.query(churnedQuery(dimension, prevSalesDateWhere, currentSalesDateWhere, sc.where));

  const rows: ClientesChurnedRow[] = churned.recordset.map(r => ({
    name: r.Name,
    lastPurchaseDateKey: Number(r.LastPurchaseDateKey),
    lostRevenue: { bs: Number(r.LostRevenueBs), usd: r.LostRevenueUsd === null ? null : Number(r.LostRevenueUsd) },
  }));

  const response: ClientesChurnedResponse = { rows, available: true };
  return jsonWithCache(response);
}

// Active-customers + churn trend per bucket (day | week | month, from the shared granularity rules; "range" is
// one aggregate bucket). CustomerBucket is the distinct (BucketKey, EntityKey) grain: one row per customer
// (at whichever grain `dimension` resolves to: legal entity/cadena, or individual tienda) per bucket they
// bought anything. Unless the mode is "range", the fact window starts one calendar month before the requested
// range (widenedDateWhere) so the FIRST in-range bucket has a preceding bucket to diff against; buckets that
// end before the requested start are dropped in handleTrend. Churn for bucket B = customers present in the
// previous bucket that have data but are absent in B, as a share of the previous bucket's total (same
// "prior active, gone now" definition as activeCustomersQuery in ../resumen/route.ts, walked forward bucket
// by bucket). EntityKey is whatever spec.valueExpr resolves to (LegalEntityKey for cliente_entidad,
// CustomerKey for cliente_tienda): a cadena that opens a new tienda shows as "no churn, same customer" at the
// Entidad grain and as a new customer at the Tienda grain.
function trendQuery(dimension: Dimension, dateWhere: string, scopeWhere: string, bucketKeyExpr: string): string {
  const spec = getDimensionSpec(dimension);
  return `
    WITH CustomerBucket AS (
      SELECT DISTINCT ${bucketKeyExpr} AS BucketKey, ${spec.valueExpr} AS EntityKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      ${spec.joinClause.replace(/\bf\b/g, 'fs')}
      WHERE fs.IsVoided = 0 ${dateWhere} ${scopeWhere}
    ),
    BucketList AS (
      SELECT DISTINCT BucketKey FROM CustomerBucket
    ),
    PrevBucket AS (
      SELECT
        b.BucketKey,
        (SELECT MAX(b2.BucketKey) FROM BucketList b2 WHERE b2.BucketKey < b.BucketKey) AS PrevBucketKey
      FROM BucketList b
    )
    SELECT
      cb.BucketKey,
      COUNT(DISTINCT cb.EntityKey) AS ActiveCustomers,
      pb.PrevBucketKey,
      (SELECT COUNT(DISTINCT prev.EntityKey)
         FROM CustomerBucket prev
         WHERE prev.BucketKey = pb.PrevBucketKey
      ) AS ActiveCustomersPrevBucket,
      (SELECT COUNT(DISTINCT prev.EntityKey)
         FROM CustomerBucket prev
         WHERE prev.BucketKey = pb.PrevBucketKey
           AND NOT EXISTS (
             SELECT 1 FROM CustomerBucket cur
             WHERE cur.BucketKey = cb.BucketKey AND cur.EntityKey = prev.EntityKey
           )
      ) AS ChurnedCustomers
    FROM CustomerBucket cb
    JOIN PrevBucket pb ON pb.BucketKey = cb.BucketKey
    GROUP BY cb.BucketKey, pb.PrevBucketKey
    ORDER BY cb.BucketKey
  `;
}

// Group/route scope filters the SALES rows by the customer's current attributes; the correlated returns subquery is per entity/tienda and is not scoped (exact at Tienda grain).
function customerQuery(dimension: Dimension, salesDateWhere: string, returnsDateWhere: string, scopeWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fr2');
  return `
    SELECT
      ${spec.labelExpr} AS Name,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      ${returnsAmountSubqueries({
        alias: 'fr2',
        fxAlias: 'r2fx',
        extraJoins: innerJoin,
        where: `${returnsDateWhere} AND ${condition}`,
        bsAlias: 'ReturnsNetBs',
        usdAlias: 'ReturnsNetUsd',
      })}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${salesDateWhere} ${scopeWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesGrossBs DESC
  `;
}

async function handleTrend(dimension: Dimension, dateRange: string, scope: CarteraScope, trend: TrendBucket) {
  const pool = await getDwhPool();
  const sc = customerScope(scope, 'c');
  const req = pool.request();
  sc.bind(req);
  const dateWhere = trend.mode === 'range' ? buildDateWhereClause(dateRange, 'fs') : widenedDateWhereClause(dateRange);
  const result = await req.query(trendQuery(dimension, dateWhere, sc.where, trend.keyExpr('d')));

  const startIso = rangeStart(dateRange).toISOString().slice(0, 10);
  const kept = result.recordset.filter(r => {
    if (trend.mode === 'range') return true;
    const span = bucketSpan(trend.mode, String(r.BucketKey));
    return span === null || span.end >= startIso;
  });
  const keys = kept.map(r => String(r.BucketKey));
  const labels = bucketLabels(trend.mode, keys);

  const rows: ClientesTrendRow[] = kept.map((r, i) => {
    const prev = r.ActiveCustomersPrevBucket === null || r.ActiveCustomersPrevBucket === undefined ? null : Number(r.ActiveCustomersPrevBucket);
    const churned = r.ChurnedCustomers === null || r.ChurnedCustomers === undefined ? null : Number(r.ChurnedCustomers);
    return {
      bucketKey: keys[i],
      label: labels[i],
      activeCustomers: Number(r.ActiveCustomers),
      churnRate: prev !== null && prev > 0 && churned !== null ? churned / prev : null,
    };
  });

  const response: ClientesTrendResponse = { rows, granularity: trend.granularity };
  return jsonWithCache(response);
}

// Chain -> store trajectory: per-store sales, units and orders for the period and the previous equal period,
// rolled up under the casa matriz in TypeScript (lib/clientes/trayectoria.ts).
async function handleTrayectoria(dateRange: string, scope: CarteraScope) {
  const pool = await getDwhPool();
  const sc = customerScope(scope, 'c');
  const prevWhere = sharedPrevPeriodWhere(dateRange, 'fs');
  const req = pool.request();
  sc.bind(req);
  const result = await req.query(trayectoriaQuery(sc.where, buildDateWhereClause(dateRange, 'fs'), prevWhere));

  const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  const dual = (bs: unknown, usd: unknown) => ({ bs: Number(bs ?? 0), usd: bs === null || bs === undefined ? 0 : num(usd) });
  const stores: StoreAggregate[] = result.recordset.map(r => ({
    code: String(r.Code).trim(),
    name: String(r.Name ?? r.Code).trim(),
    entityKey: num(r.LegalEntityKey),
    entityName: r.LegalEntityName ? String(r.LegalEntityName).trim() : null,
    sales: dual(r.SalesBs, r.SalesUsd),
    salesPrev: prevWhere === null ? null : dual(r.PrevBs, r.PrevUsd),
    units: Number(r.Units ?? 0),
    unitsPrev: prevWhere === null ? null : Number(r.PrevUnits ?? 0),
    orders: Number(r.Orders ?? 0),
    lastOrderKey: num(r.LastDateKey),
    firstInvoiceKey: num(r.FirstDateKey),
  }));
  const rows = rollUpTrayectoria(stores, { periodStartKey: rangeStartDateKey(dateRange), periodEndKey: rangeEndDateKey(dateRange) });
  const response: ClientesTrayectoriaResponse = { available: prevWhere !== null, rows };
  return jsonWithCache(response);
}

// A NULL/blank SegmentName or ZoneName must not render as the text "null": fall back to the code.
function optionLabel(name: unknown, code: string): string {
  const label = name === null || name === undefined ? '' : String(name).trim();
  return label === '' ? code : label;
}

async function handleFilters(): Promise<NextResponse> {
  const pool = await getDwhPool();
  const [groups, routes] = await Promise.all([
    pool.request().query(CLIENTES_GROUPS_QUERY),
    pool.request().query(CLIENTES_ROUTES_QUERY),
  ]);
  const response: ClientesFiltersResponse = {
    groups: groups.recordset.map(r => {
      const value = String(r.Code).trim();
      return { value, label: optionLabel(r.Name, value) };
    }),
    routes: routes.recordset.map(r => {
      const value = String(r.RouteNumber).trim();
      return { value, label: optionLabel(r.ZoneName, value) };
    }),
  };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const clienteDimensionParam = searchParams.get('clienteDimension');
  const clienteDimension: Dimension = isClienteDimension(clienteDimensionParam) ? clienteDimensionParam : 'cliente_entidad';
  const scope = parseCarteraScope(searchParams);

  if (searchParams.get('section') === 'filters') {
    try {
      return await handleFilters();
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (searchParams.get('section') === 'trend') {
    try {
      return await handleTrend(clienteDimension, dateRange, scope, parseTrendBucket(searchParams, dateRange));
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (searchParams.get('section') === 'trayectoria') {
    try {
      return await handleTrayectoria(dateRange, scope);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (searchParams.get('section') === 'churned') {
    try {
      return await handleChurned(clienteDimension, dateRange, scope);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  try {
    const pool = await getDwhPool();

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    // customerQuery's correlated returns subquery aliases Fact_Returns as
    // `fr2` (via spec.correlate), not `fr`, so it needs its own date-where
    // clause built against that alias.
    // Devoluciones by their own devolución date (this tab ignores returnsBasis).
    const returnsDateWhere = buildReturnsDateWhereClause(dateRange, 'fr2');

    const sc = customerScope(scope, 'c');
    const req = pool.request();
    sc.bind(req);
    const customers = await req.query(customerQuery(clienteDimension, salesDateWhere, returnsDateWhere, sc.where));

    // Query already orders by SalesGrossBs DESC, which is the ranking Pareto
    // segmentation needs — walk it once, accumulating cumulative share of
    // total net sales to assign each customer's A/B/C segment.
    const totalSalesGross = customers.recordset.reduce((sum, r) => sum + Number(r.SalesGrossBs), 0);

    let cumulativeSalesGross = 0;
    const rows: ClientesRow[] = customers.recordset.map(r => {
      const salesGrossBs = Number(r.SalesGrossBs);
      const salesGrossUsd = r.SalesGrossUsd === null ? null : Number(r.SalesGrossUsd);
      const returnsNetBs = Number(r.ReturnsNetBs);
      const returnsNetUsd = r.ReturnsNetUsd === null ? null : Number(r.ReturnsNetUsd);

      cumulativeSalesGross += salesGrossBs;
      const cumulativeShare = totalSalesGross > 0 ? cumulativeSalesGross / totalSalesGross : 0;
      const pareto: ClientesRow['pareto'] =
        cumulativeShare <= PARETO_THRESHOLDS.a ? 'A' : cumulativeShare <= PARETO_THRESHOLDS.b ? 'B' : 'C';

      return {
        name: r.Name,
        salesGross: { bs: salesGrossBs, usd: salesGrossUsd },
        returnsNet: { bs: returnsNetBs, usd: returnsNetUsd },
        salesNet: subtractDual({ bs: salesGrossBs, usd: salesGrossUsd }, { bs: returnsNetBs, usd: returnsNetUsd }),
        returnRate: salesGrossBs > 0 ? returnsNetBs / salesGrossBs : null,
        pareto,
      };
    });

    const response: ClientesResponse = { rows, paretoThresholds: PARETO_THRESHOLDS };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
