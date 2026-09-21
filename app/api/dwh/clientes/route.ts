import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isClienteDimension, jsonWithCache, type Dimension } from '@/app/api/dwh/lib/query-builder';
import type {
  ClientesResponse,
  ClientesRow,
  ClientesTrendResponse,
  ClientesTrendRow,
  ClientesChurnedResponse,
  ClientesChurnedRow,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.

// Pareto (80/20) thresholds: customers are ranked by net sales descending,
// then bucketed by cumulative share of total net sales. A = top 20% of
// cumulative sales, B = next 30% (up to 50% cumulative), C = the rest.
const PARETO_THRESHOLDS = { a: 0.2, b: 0.5 };

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const idx = parseInt(m, 10) - 1;
  return names[idx] ? `${names[idx]} ${y.slice(2)}` : ym;
}

const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE_RE = /^month:(\d{4})-(\d{2})$/;
const YTD_RANGE_RE = /^ytd:(\d{4})$/;

function dateKey(d: Date): number {
  return parseInt(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
}

function toYearMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
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
function churnedQuery(dimension: Dimension, prevDateWhere: string, currentDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fs2');
  return `
    SELECT TOP 200
      ${spec.labelExpr} AS Name,
      MAX(fs.DateKey) AS LastPurchaseDateKey,
      SUM(fs.NetAmount) AS LostRevenue
    FROM fact.Fact_Sales fs
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${prevDateWhere}
      AND NOT EXISTS (
        SELECT 1 FROM fact.Fact_Sales fs2
        ${innerJoin}
        WHERE fs2.IsVoided = 0 ${currentDateWhere} AND ${condition}
      )
    GROUP BY ${spec.groupByColumn}
    ORDER BY LostRevenue DESC
  `;
}

async function handleChurned(dimension: Dimension, dateRange: string, currency: string) {
  const prevSalesDateWhere = buildPrevPeriodDateWhereClause(dateRange, 'fs');
  if (prevSalesDateWhere === null) {
    const response: ClientesChurnedResponse = { rows: [], available: false, usdRate: null };
    return jsonWithCache(response);
  }

  const pool = await getDwhPool();
  // churnedQuery's correlated NOT EXISTS lookup aliases Fact_Sales as `fs2`
  // (via spec.correlate), not `fs`, so it needs its own current-period
  // where-clause built against that alias — same reasoning as
  // salesDateWhereFs2 in the main GET handler below.
  const currentSalesDateWhere = buildDateWhereClause(dateRange, 'fs2');

  const [churned, usdRate] = await Promise.all([
    pool.request().query(churnedQuery(dimension, prevSalesDateWhere, currentSalesDateWhere)),
    currency === 'usd' ? getUsdRate() : Promise.resolve(null),
  ]);

  const rows: ClientesChurnedRow[] = churned.recordset.map(r => ({
    name: r.Name,
    lastPurchaseDateKey: Number(r.LastPurchaseDateKey),
    lostRevenue: Number(r.LostRevenue),
  }));

  const response: ClientesChurnedResponse = { rows, available: true, usdRate };
  return jsonWithCache(response);
}

// Monthly active-customers + churn trend. CustomerMonth is the distinct
// (YearMonth, EntityKey) grain — one row per customer (at whichever grain
// `dimension` resolves to — legal entity/cadena, or individual tienda) per
// month they bought anything — built from a widened window (widenedDateWhere)
// that starts one calendar month before the requested range, purely so the
// FIRST in-range month has a preceding month to diff against for its churn
// figure; the final WHERE cm.YearMonth >= @minYearMonth then drops that
// extra leading month from the emitted rows. Churn for month M = customers
// present in M-1 but absent in M, as a share of M-1's total — the same
// "prior active, gone now" definition used by activeCustomersQuery in
// ../resumen/route.ts, just walked forward month-by-month instead of
// collapsed to a single before/after pair. EntityKey is whatever
// spec.valueExpr resolves to (LegalEntityKey for cliente_entidad,
// CustomerKey for cliente_tienda) — this is what lets a cadena that opens a
// new tienda (same LegalEntityKey, new CustomerKey) show up as "no churn,
// same customer" at the Entidad grain but as a new/incremental customer at
// the Tienda grain, per the actual business distinction being asked for.
function trendQuery(dimension: Dimension, widenedDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  return `
    WITH CustomerMonth AS (
      SELECT DISTINCT d.YearMonth, ${spec.valueExpr} AS EntityKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      ${spec.joinClause.replace(/\bf\b/g, 'fs')}
      WHERE fs.IsVoided = 0 ${widenedDateWhere}
    ),
    MonthList AS (
      SELECT DISTINCT YearMonth FROM CustomerMonth
    ),
    PrevMonth AS (
      SELECT
        m.YearMonth,
        (SELECT MAX(m2.YearMonth) FROM MonthList m2 WHERE m2.YearMonth < m.YearMonth) AS PrevYearMonth
      FROM MonthList m
    )
    SELECT
      cm.YearMonth,
      COUNT(DISTINCT cm.EntityKey) AS ActiveCustomers,
      pm.PrevYearMonth,
      (SELECT COUNT(DISTINCT prev.EntityKey)
         FROM CustomerMonth prev
         WHERE prev.YearMonth = pm.PrevYearMonth
      ) AS ActiveCustomersPrevMonth,
      (SELECT COUNT(DISTINCT prev.EntityKey)
         FROM CustomerMonth prev
         WHERE prev.YearMonth = pm.PrevYearMonth
           AND NOT EXISTS (
             SELECT 1 FROM CustomerMonth cur
             WHERE cur.YearMonth = cm.YearMonth AND cur.EntityKey = prev.EntityKey
           )
      ) AS ChurnedCustomers
    FROM CustomerMonth cm
    JOIN PrevMonth pm ON pm.YearMonth = cm.YearMonth
    WHERE cm.YearMonth >= @minYearMonth
    GROUP BY cm.YearMonth, pm.PrevYearMonth
    ORDER BY cm.YearMonth
  `;
}

function customerQuery(dimension: Dimension, salesDateWhere: string, returnsDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fr2');
  return `
    SELECT
      ${spec.labelExpr} AS Name,
      SUM(fs.NetAmount) AS SalesNet,
      (SELECT ISNULL(SUM(fr2.NetAmount), 0)
         FROM fact.Fact_Returns fr2
         ${innerJoin}
         WHERE fr2.IsVoided = 0 ${returnsDateWhere} AND ${condition}
      ) AS ReturnsNet
    FROM fact.Fact_Sales fs
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesNet DESC
  `;
}

async function handleTrend(dimension: Dimension, dateRange: string) {
  const pool = await getDwhPool();
  const minYearMonth = toYearMonth(rangeStart(dateRange));
  const result = await pool
    .request()
    .input('minYearMonth', minYearMonth)
    .query(trendQuery(dimension, widenedDateWhereClause(dateRange)));

  const rows: ClientesTrendRow[] = result.recordset.map(r => {
    const activeCustomersPrevMonth = r.ActiveCustomersPrevMonth === null ? null : Number(r.ActiveCustomersPrevMonth);
    const churnedCustomers = r.ChurnedCustomers === null ? null : Number(r.ChurnedCustomers);
    return {
      yearMonth: formatYearMonth(String(r.YearMonth)),
      activeCustomers: Number(r.ActiveCustomers),
      churnRate:
        activeCustomersPrevMonth !== null && activeCustomersPrevMonth > 0 && churnedCustomers !== null
          ? churnedCustomers / activeCustomersPrevMonth
          : null,
    };
  });

  const response: ClientesTrendResponse = { rows };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const clienteDimensionParam = searchParams.get('clienteDimension');
  const clienteDimension: Dimension = isClienteDimension(clienteDimensionParam) ? clienteDimensionParam : 'cliente_entidad';

  if (searchParams.get('section') === 'trend') {
    try {
      return await handleTrend(clienteDimension, dateRange);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (searchParams.get('section') === 'churned') {
    try {
      return await handleChurned(clienteDimension, dateRange, currency);
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
    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr2');

    const [customers, usdRate] = await Promise.all([
      pool.request().query(customerQuery(clienteDimension, salesDateWhere, returnsDateWhere)),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

    // Query already orders by SalesNet DESC, which is the ranking Pareto
    // segmentation needs — walk it once, accumulating cumulative share of
    // total net sales to assign each customer's A/B/C segment.
    const totalSalesNet = customers.recordset.reduce((sum, r) => sum + Number(r.SalesNet), 0);

    let cumulativeSalesNet = 0;
    const rows: ClientesRow[] = customers.recordset.map(r => {
      const salesNet = Number(r.SalesNet);
      const returnsNet = Number(r.ReturnsNet);

      cumulativeSalesNet += salesNet;
      const cumulativeShare = totalSalesNet > 0 ? cumulativeSalesNet / totalSalesNet : 0;
      const pareto: ClientesRow['pareto'] =
        cumulativeShare <= PARETO_THRESHOLDS.a ? 'A' : cumulativeShare <= PARETO_THRESHOLDS.b ? 'B' : 'C';

      return {
        name: r.Name,
        salesNet,
        returnsNet,
        returnRate: salesNet > 0 ? returnsNet / salesNet : null,
        pareto,
      };
    });

    const response: ClientesResponse = { rows, paretoThresholds: PARETO_THRESHOLDS, usdRate };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
