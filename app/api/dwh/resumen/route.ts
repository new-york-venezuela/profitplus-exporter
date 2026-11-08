import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { DEFAULT_ROOT_SHARE_THRESHOLD, getFlaggedRootCodes } from '@/app/api/dwh/lib/consignment';
import { parseTrendBucket, type TrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import {
  buildDateWhereClause, buildPrevThirtyDayWhereClause, buildReturnsDateWhereClause, parseReturnsBasis, returnsDateColumn, getDimensionSpec, jsonWithCache,
  usdConversionJoin, returnsUsdConversionJoin, returnsAmountSubqueries, dualAmountExpr, rangeEndDateKey, rangeStartDateKey, previousDayKey,
} from '@/app/api/dwh/lib/query-builder';
import { dualFromRow, subtractDual, sumDual } from '@/app/(app)/analitica/lib/net-sales';
import type {
  ResumenResponse,
  MonthlyTrendRow,
  NamedAmount,
  SalesRepRow,
  AgingBucketRow,
  DebtorRow,
  DualAmount,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// All queries here read from the pre-aggregated dwh/dim/fact schema in
// DWH_AlimentosNY (see migrations/dwh/), not the raw Profit Plus ERP —
// so no COLLATE/RTRIM gymnastics are needed here, that work already
// happened at load time.

// `bucket` picks the trend grain (day/week/month/aggregate range). Sales and
// returns are aggregated per bucket in separate CTEs and joined on the bucket
// key, rather than via a correlated subquery: the bucket is a GROUP BY
// *expression*, and SQL Server rejects a subquery that references the outer
// query's un-grouped Dim_Date columns. Both sides are range-scoped, so the
// aggregate 'range' bucket can't sum returns outside the period.
function monthlyTrendQuery(
  dateWhere: string, returnsDateWhere: string, bucket: TrendBucket, returnsColumn: 'DateKey' | 'OriginalInvoiceDateKey',
): string {
  return `
    WITH sales AS (
      SELECT
        ${bucket.keyExpr('d')} AS Bucket,
        ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      WHERE fs.IsVoided = 0 ${dateWhere}
      GROUP BY ${bucket.keyExpr('d')}
    ),
    rets AS (
      SELECT
        ${bucket.keyExpr('dr')} AS Bucket,
        ${dualAmountExpr('fr', 'NetAmount', 'ReturnsNetBs', 'ReturnsNetUsd', 'frfx')}
      FROM fact.Fact_Returns fr
      ${returnsUsdConversionJoin('fr', 'frfx')}
      JOIN dim.Dim_Date dr ON dr.DateKey = fr.${returnsColumn}
      WHERE fr.IsVoided = 0 ${returnsDateWhere}
      GROUP BY ${bucket.keyExpr('dr')}
    )
    SELECT
      s.Bucket,
      s.SalesGrossBs,
      s.SalesGrossUsd,
      ISNULL(r.ReturnsNetBs, 0) AS ReturnsNetBs,
      CASE WHEN r.Bucket IS NULL THEN 0 ELSE r.ReturnsNetUsd END AS ReturnsNetUsd
    FROM sales s
    LEFT JOIN rets r ON r.Bucket = s.Bucket
    ORDER BY s.Bucket
  `;
}

// Grouped by legal entity (cliente_entidad), not individual store/tienda —
// same "por cliente" grain every other analitica tab (Ventas, Devoluciones,
// CxC) uses by default, via the shared dimension mechanism in
// query-builder.ts. A chain's stores should roll up into one bar here, not
// fragment the top-10 list across its own children.
function topCustomersQuery(dateWhere: string): string {
  const spec = getDimensionSpec('cliente_entidad');
  return `
    SELECT TOP 10
      ${spec.labelExpr} AS Name,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesGrossBs DESC
  `;
}

function topProductsQuery(dateWhere: string): string {
  return `
    SELECT TOP 10
      ISNULL(p.ProductName, p.ProductCode) AS Name,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesGrossBs DESC
  `;
}

function salesRepQuery(dateWhere: string, returnsDateWhere: string): string {
  return `
    SELECT
      ISNULL(r.SalesRepName, r.SalesRepCode) AS Name,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      SUM(fs.QuantitySold) AS UnitsSold,
      ${returnsAmountSubqueries({
        alias: 'fr',
        fxAlias: 'frfx',
        where: `AND fr.SalesRepKey = fs.SalesRepKey ${returnsDateWhere}`,
        bsAlias: 'ReturnsNetBs',
        usdAlias: 'ReturnsNetUsd',
      })}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
    ORDER BY SalesGrossBs DESC
  `;
}

// Latest snapshot ON OR BEFORE the range's last day (not "today" and not just
// the newest): Fact_AR_Snapshot only has data for dates it was actually run
// against (a disabled-by-default SQL Agent job; see migrations/dwh/README.md),
// and "pendiente por cobrar" means what was owed when the selected range ended.
const SNAPSHOT_AS_OF_QUERY = `
  SELECT MAX(SnapshotDateKey) AS SnapshotDateKey
  FROM fact.Fact_AR_Snapshot
  WHERE SnapshotDateKey <= @rangeEndKey
`;

// Latest snapshot ON OR BEFORE @openingEndKey (the day before the range starts).
const SNAPSHOT_BEFORE_QUERY = `
  SELECT MAX(SnapshotDateKey) AS SnapshotDateKey
  FROM fact.Fact_AR_Snapshot
  WHERE SnapshotDateKey <= @openingEndKey
`;

// AR balances are valued at the SNAPSHOT date's rate (usdConversionJoin('a',
// 'SnapshotDateKey')), not the original invoice's own DateKey — a deliberate
// exception to this file's otherwise-universal per-row-historical-rate rule,
// confirmed with the user: an outstanding balance is a present-day
// obligation, so it's priced in USD as of today (the snapshot), not as of
// the original sale. See
// docs/superpowers/specs/2026-09-23-historical-usd-conversion-design.md and
// the final-review fix-up that added this exception. Every other fact table
// (Fact_Sales/Fact_Returns/Fact_Collections/Fact_Purchases) keeps the
// invoice-date-rate behavior dualAmountExpr provides — do NOT change those.
const AGING_BUCKETS_QUERY = `
  SELECT AgingBucket,
    SUM(a.OutstandingBalance) AS AmountBs,
    SUM(a.OutstandingBalance / NULLIF(fx.RateSell, 0)) AS AmountUsd
  FROM fact.Fact_AR_Snapshot a
  ${usdConversionJoin('a', 'SnapshotDateKey')}
  WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
  GROUP BY AgingBucket
`;

// Same cliente_entidad grain as topCustomersQuery above — a chain's
// outstanding balance across all its stores should roll up to one row.
function topDebtorsQuery(): string {
  const spec = getDimensionSpec('cliente_entidad');
  return `
    SELECT TOP 10
      ${spec.labelExpr} AS Name,
      SUM(a.OutstandingBalance) AS OutstandingBs,
      SUM(a.OutstandingBalance / NULLIF(fx.RateSell, 0)) AS OutstandingUsd
    FROM fact.Fact_AR_Snapshot a
    ${usdConversionJoin('a', 'SnapshotDateKey')}
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey
    GROUP BY ${spec.groupByColumn}
    HAVING SUM(a.OutstandingBalance) > 0
    ORDER BY OutstandingBs DESC
  `;
}

// Opening AR: same valuation as AGING_BUCKETS_QUERY (snapshot-date rate), credit notes excluded.
const OPENING_BALANCE_QUERY = `
  SELECT
    SUM(a.OutstandingBalance) AS OpeningBs,
    SUM(a.OutstandingBalance / NULLIF(fx.RateSell, 0)) AS OpeningUsd
  FROM fact.Fact_AR_Snapshot a
  ${usdConversionJoin('a', 'SnapshotDateKey')}
  WHERE a.SnapshotDateKey = @openingSnapshotKey AND a.IsCreditNote = 0
`;

// Customer-level KPIs, counted per customer code (one basis per Resumen card):
// - Ventas cards (CustomersWithSales / CustomersWithReturns / CustomersNet): every
//   customer, consignment included, the same basis as the card amounts (totalsQuery
//   and the chart, which include consignment). Sales/returns are summed per customer
//   code so a customer whose returns exceed its sales is not "net".
// - Clientes cards (CustomersTotal / ActiveCustomerCodes / CustomersNew): the CURRENT
//   Dim_Customer row (IsCurrent = 1, not inactive) with consignment roots (@root0,
//   @root1, ...) excluded, as in Seguimiento. Activos is a subset of Total, so the
//   "% del total" can never pass 100%.
function customerKpisQuery(
  salesDateWhere: string, returnsDateWhere: string, registeredWhere: string, rootPlaceholders: string[],
): string {
  const exclude = rootPlaceholders.length > 0
    ? `AND RTRIM(c.CustomerCode) NOT IN (${rootPlaceholders.join(', ')})`
    : '';
  return `
    WITH sales AS (
      SELECT c.CustomerCode, SUM(fs.NetAmount) AS Amount
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 ${salesDateWhere}
      GROUP BY c.CustomerCode
    ),
    rets AS (
      SELECT c.CustomerCode, SUM(fr.NetAmount) AS Amount
      FROM fact.Fact_Returns fr
      JOIN dim.Dim_Customer c ON c.CustomerKey = fr.CustomerKey
      WHERE fr.IsVoided = 0 ${returnsDateWhere}
      GROUP BY c.CustomerCode
    ),
    cur AS (
      SELECT c.CustomerCode,
             CONVERT(INT, CONVERT(CHAR(8), c.RegisteredDate, 112)) AS RegKey,
             c.IsMigrationBatch
      FROM dim.Dim_Customer c
      WHERE c.IsCurrent = 1 AND c.IsInactive = 0 ${exclude}
    )
    SELECT
      (SELECT COUNT(*) FROM cur) AS CustomersTotal,
      (SELECT COUNT(*) FROM cur rc WHERE ISNULL(rc.IsMigrationBatch, 0) = 0 AND rc.RegKey IS NOT NULL ${registeredWhere}) AS CustomersNew,
      (SELECT COUNT(*) FROM cur ac WHERE EXISTS (SELECT 1 FROM sales s WHERE s.CustomerCode = ac.CustomerCode)) AS ActiveCustomerCodes,
      (SELECT COUNT(*) FROM sales) AS CustomersWithSales,
      (SELECT COUNT(*) FROM (
         SELECT s.CustomerCode FROM sales s LEFT JOIN rets r ON r.CustomerCode = s.CustomerCode
         WHERE s.Amount - ISNULL(r.Amount, 0) > 0
       ) n) AS CustomersNet,
      (SELECT COUNT(*) FROM rets) AS CustomersWithReturns
  `;
}

function totalsQuery(salesDateWhere: string, returnsDateWhere: string, collectionsDateWhere: string): string {
  return `
    SELECT
      (SELECT ISNULL(SUM(NetAmount), 0) FROM fact.Fact_Sales fs
         WHERE fs.IsVoided = 0 ${salesDateWhere}) AS SalesGrossPeriodBs,
      (SELECT CASE WHEN COUNT(fs.NetAmount) = 0 THEN 0 ELSE SUM(fs.NetAmount / NULLIF(sfx.RateSell, 0)) END
         FROM fact.Fact_Sales fs ${usdConversionJoin('fs', undefined, 'sfx')}
         WHERE fs.IsVoided = 0 ${salesDateWhere}) AS SalesGrossPeriodUsd,
      (SELECT ISNULL(SUM(NetAmount), 0) FROM fact.Fact_Returns fr
         WHERE fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNetPeriodBs,
      (SELECT CASE WHEN COUNT(fr.NetAmount) = 0 THEN 0 ELSE SUM(fr.NetAmount / NULLIF(rfx.RateSell, 0)) END
         FROM fact.Fact_Returns fr ${returnsUsdConversionJoin('fr', 'rfx')}
         WHERE fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNetPeriodUsd,
      (SELECT ISNULL(SUM(fs.QuantitySold), 0) FROM fact.Fact_Sales fs
         WHERE fs.IsVoided = 0 ${salesDateWhere}) AS UnitsSold,
      (SELECT ISNULL(SUM(fr.QuantityReturned), 0) FROM fact.Fact_Returns fr
         WHERE fr.IsVoided = 0 ${returnsDateWhere}) AS UnitsReturned,
      (SELECT ISNULL(SUM(AmountCollected), 0) FROM fact.Fact_Collections fc
         WHERE fc.IsVoided = 0 ${collectionsDateWhere}) AS CollectedPeriodBs,
      (SELECT CASE WHEN COUNT(fc.AmountCollected) = 0 THEN 0 ELSE SUM(fc.AmountCollected / NULLIF(cfx.RateSell, 0)) END
         FROM fact.Fact_Collections fc ${usdConversionJoin('fc', undefined, 'cfx')}
         WHERE fc.IsVoided = 0 ${collectionsDateWhere}) AS CollectedPeriodUsd
  `;
}

// Same-length period immediately preceding `dateRange`, for the active-
// customers Δ card and churn rate — same convention (and deliberately NOT
// year-over-year, for the same reason) as Ventas'
// buildPrevPeriodDateWhereClause in ../ventas/route.ts. Duplicated rather
// than shared because that's this codebase's existing per-route convention
// for this helper.
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

  if (dateRange === '30d') return buildPrevThirtyDayWhereClause(tableName);

  // Trailing-365-day default (buildDateWhereClause's own fallback): the
  // previous period is the 365 days immediately before that window.
  return `AND ${tableName}.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -730, GETDATE()), 'yyyyMMdd')) AND ${tableName}.DateKey < CONVERT(INT, FORMAT(DATEADD(DAY, -365, GETDATE()), 'yyyyMMdd'))`;
}

// Active customers in the current range, plus how many of the PREVIOUS
// period's active customers placed no order in the current range (churn).
// Built as one query so the "did this prior customer come back" check runs
// against the same current-period customer set the headline count uses.
// Takes the current-period where-clause built against BOTH the `fs` alias
// (for the outer query) and `fs2` (for the NOT EXISTS lookup nested two
// levels deep inside the prev-period subquery) — reusing the `fs`-aliased
// clause there would reference the outer query's own `fs` from inside a
// nested subquery under an aggregate with no GROUP BY, which SQL Server
// rejects with "invalid in the select list" (confirmed live against DWH_AlimentosNY).
function activeCustomersQuery(salesDateWhere: string, salesDateWhereFs2: string, prevSalesDateWhere: string): string {
  return `
    SELECT
      COUNT(DISTINCT le.LegalEntityKey) AS ActiveCustomers,
      (SELECT COUNT(DISTINCT prev_le.LegalEntityKey)
         FROM fact.Fact_Sales prev_fs
         JOIN dim.Dim_Customer prev_c ON prev_c.CustomerKey = prev_fs.CustomerKey
         JOIN dim.Dim_LegalEntity prev_le ON prev_le.LegalEntityKey = prev_c.LegalEntityKey
         WHERE prev_fs.IsVoided = 0 ${prevSalesDateWhere}
      ) AS ActiveCustomersPrevPeriod,
      (SELECT COUNT(DISTINCT prev_le.LegalEntityKey)
         FROM fact.Fact_Sales prev_fs
         JOIN dim.Dim_Customer prev_c ON prev_c.CustomerKey = prev_fs.CustomerKey
         JOIN dim.Dim_LegalEntity prev_le ON prev_le.LegalEntityKey = prev_c.LegalEntityKey
         WHERE prev_fs.IsVoided = 0 ${prevSalesDateWhere}
           AND NOT EXISTS (
             SELECT 1 FROM fact.Fact_Sales fs2
             JOIN dim.Dim_Customer c2 ON c2.CustomerKey = fs2.CustomerKey
             WHERE fs2.IsVoided = 0 ${salesDateWhereFs2} AND c2.LegalEntityKey = prev_le.LegalEntityKey
           )
      ) AS ChurnedCustomers
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    WHERE fs.IsVoided = 0 ${salesDateWhere}
  `;
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const returnsBasis = parseReturnsBasis(searchParams.get('returnsBasis'));

  try {
    const pool = await getDwhPool();

    const trendBucket = parseTrendBucket(searchParams, dateRange);
    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    // Devoluciones attributed to the ORIGINAL factura's date, so the KPI
    // row's brutas − devoluciones = netas for the period (see ReturnsBasis).
    const returnsDateWhere = buildReturnsDateWhereClause(dateRange, 'fr', returnsBasis);
    const collectionsDateWhere = buildDateWhereClause(dateRange, 'fc');
    // activeCustomersQuery's prev-period subqueries alias Fact_Sales as
    // `prev_fs`, not `fs` — reusing an `fs`-aliased clause there would
    // reference the OUTER query's `fs` from inside a subquery under an
    // aggregate with no GROUP BY, which SQL Server rejects with "invalid in
    // the select list" (confirmed live against DWH_AlimentosNY). Same
    // reasoning as salesDateWhereFs2 below, just for the previous period.
    const prevSalesDateWhere = buildPrevPeriodDateWhereClause(dateRange, 'prev_fs');
    // Same current-period bounds as salesDateWhere, built against the `fs2`
    // alias activeCustomersQuery's nested NOT EXISTS lookup uses — see that
    // function's doc comment for why it can't just reuse salesDateWhere.
    const salesDateWhereFs2 = buildDateWhereClause(dateRange, 'fs2');

    const flaggedRoots = await getFlaggedRootCodes(salesDateWhere, DEFAULT_ROOT_SHARE_THRESHOLD);
    const customerKpisReq = pool.request();
    const rootPlaceholders = flaggedRoots.map((code, i) => {
      customerKpisReq.input(`root${i}`, code);
      return `@root${i}`;
    });
    const registeredWhere = buildDateWhereClause(dateRange, 'rc', 'RegKey');
    const openingEndKey = previousDayKey(rangeStartDateKey(dateRange));

    const [trend, topCustomers, topProducts, salesReps, latestSnapshot, totals, activeCustomersResult, customerKpis, openingSnapshot] = await Promise.all([
      pool.request().query(monthlyTrendQuery(salesDateWhere, returnsDateWhere, trendBucket, returnsDateColumn(returnsBasis))),
      pool.request().query(topCustomersQuery(salesDateWhere)),
      pool.request().query(topProductsQuery(salesDateWhere)),
      pool.request().query(salesRepQuery(salesDateWhere, returnsDateWhere)),
      pool.request().input('rangeEndKey', rangeEndDateKey(dateRange)).query(SNAPSHOT_AS_OF_QUERY),
      pool.request().query(totalsQuery(salesDateWhere, returnsDateWhere, collectionsDateWhere)),
      prevSalesDateWhere !== null
        ? pool.request().query(activeCustomersQuery(salesDateWhere, salesDateWhereFs2, prevSalesDateWhere))
        : pool.request().query(`SELECT COUNT(DISTINCT le.LegalEntityKey) AS ActiveCustomers, NULL AS ActiveCustomersPrevPeriod, NULL AS ChurnedCustomers
            FROM fact.Fact_Sales fs
            JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
            JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
            WHERE fs.IsVoided = 0 ${salesDateWhere}`),
      customerKpisReq.query(customerKpisQuery(salesDateWhere, returnsDateWhere, registeredWhere, rootPlaceholders)),
      pool.request().input('openingEndKey', openingEndKey).query(SNAPSHOT_BEFORE_QUERY),
    ]);

    const openingSnapshotKey: number | null = openingSnapshot.recordset[0]?.SnapshotDateKey ?? null;
    let receivableOpening: DualAmount | null = null;
    if (openingSnapshotKey !== null) {
      const opening = await pool.request().input('openingSnapshotKey', openingSnapshotKey).query(OPENING_BALANCE_QUERY);
      const row = opening.recordset[0];
      if (row && row.OpeningBs !== null && row.OpeningBs !== undefined) {
        receivableOpening = dualFromRow(row.OpeningBs, row.OpeningUsd);
      }
    }
    const customerKpisRow = customerKpis.recordset[0] ?? {};

    const snapshotDateKey: number | null = latestSnapshot.recordset[0]?.SnapshotDateKey ?? null;

    let agingBuckets: { AgingBucket: string; AmountBs: number; AmountUsd: number | null }[] = [];
    let topDebtors: { Name: string; OutstandingBs: number; OutstandingUsd: number | null }[] = [];

    if (snapshotDateKey !== null) {
      const [aging, debtors] = await Promise.all([
        pool.request().input('snapshotDateKey', snapshotDateKey).query(AGING_BUCKETS_QUERY),
        pool.request().input('snapshotDateKey', snapshotDateKey).query(topDebtorsQuery()),
      ]);
      agingBuckets = aging.recordset;
      topDebtors = debtors.recordset;
    }

    const totalsRow = totals.recordset[0] ?? { SalesGrossPeriodBs: 0, SalesGrossPeriodUsd: 0, ReturnsNetPeriodBs: 0, ReturnsNetPeriodUsd: 0, CollectedPeriodBs: 0, CollectedPeriodUsd: 0, UnitsSold: 0, UnitsReturned: 0 };
    const salesGrossBs = Number(totalsRow.SalesGrossPeriodBs);
    const salesGrossUsd = totalsRow.SalesGrossPeriodUsd === null ? null : Number(totalsRow.SalesGrossPeriodUsd);
    const returnsNetBs = Number(totalsRow.ReturnsNetPeriodBs);
    const returnsNetUsd = totalsRow.ReturnsNetPeriodUsd === null ? null : Number(totalsRow.ReturnsNetPeriodUsd);

    const activeCustomersRow = activeCustomersResult.recordset[0] ?? {
      ActiveCustomers: 0,
      ActiveCustomersPrevPeriod: null,
      ChurnedCustomers: null,
    };
    const activeCustomers = Number(activeCustomersRow.ActiveCustomers ?? 0);
    const activeCustomersPrevPeriod =
      activeCustomersRow.ActiveCustomersPrevPeriod === null ? null : Number(activeCustomersRow.ActiveCustomersPrevPeriod);
    const churnedCustomers = activeCustomersRow.ChurnedCustomers === null ? null : Number(activeCustomersRow.ChurnedCustomers);
    const churnRate =
      activeCustomersPrevPeriod !== null && activeCustomersPrevPeriod > 0 && churnedCustomers !== null
        ? churnedCustomers / activeCustomersPrevPeriod
        : null;

    const monthlyTrend: MonthlyTrendRow[] = trend.recordset.map(r => {
      const salesGross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
      const returnsNet = dualFromRow(r.ReturnsNetBs, r.ReturnsNetUsd);
      return { bucket: String(r.Bucket), salesGross, returnsNet, salesNet: subtractDual(salesGross, returnsNet) };
    });

    const topCustomersMapped: NamedAmount[] = topCustomers.recordset.map(r => ({
      name: r.Name,
      salesGross: dualFromRow(r.SalesGrossBs, r.SalesGrossUsd),
    }));

    const topProductsMapped: NamedAmount[] = topProducts.recordset.map(r => ({
      name: r.Name,
      salesGross: dualFromRow(r.SalesGrossBs, r.SalesGrossUsd),
    }));

    const salesRepsMapped: SalesRepRow[] = salesReps.recordset.map(r => {
      const salesGross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
      const returnsNet = dualFromRow(r.ReturnsNetBs, r.ReturnsNetUsd);
      return { name: r.Name, salesGross, returnsNet, salesNet: subtractDual(salesGross, returnsNet), units: Number(r.UnitsSold ?? 0) };
    });

    const agingBucketsMapped: AgingBucketRow[] = agingBuckets.map(r => ({
      bucket: r.AgingBucket,
      amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) },
    }));

    const topDebtorsMapped: DebtorRow[] = topDebtors.map(r => ({
      name: r.Name,
      outstanding: { bs: Number(r.OutstandingBs), usd: r.OutstandingUsd === null ? null : Number(r.OutstandingUsd) },
      // Resumen's summary view doesn't compute this (CxC's route does,
      // for its own dedicated top-debtors table) — DebtorRow is shared
      // between the two responses.
      avgDaysToPay: null,
    }));

    const response: ResumenResponse = {
      monthlyTrend,
      trendMode: trendBucket.mode,
      returnsBasis,
      topCustomers: topCustomersMapped,
      topProducts: topProductsMapped,
      salesReps: salesRepsMapped,
      agingBuckets: agingBucketsMapped,
      topDebtors: topDebtorsMapped,
      snapshotDateKey,
      openingSnapshotKey,
      kpis: {
        salesGross: { bs: salesGrossBs, usd: salesGrossUsd },
        returns: { bs: returnsNetBs, usd: returnsNetUsd },
        salesNet: subtractDual({ bs: salesGrossBs, usd: salesGrossUsd }, { bs: returnsNetBs, usd: returnsNetUsd }),
        returnRate: salesGrossBs > 0 ? returnsNetBs / salesGrossBs : null,
        collected: {
          bs: Number(totalsRow.CollectedPeriodBs),
          usd: totalsRow.CollectedPeriodUsd === null ? null : Number(totalsRow.CollectedPeriodUsd),
        },
        activeCustomers,
        activeCustomersPrevPeriod,
        churnRate,
        unitsSold: Number(totalsRow.UnitsSold ?? 0),
        receivable: sumDual(agingBucketsMapped.map(b => b.amount)),
        unitsReturned: Number(totalsRow.UnitsReturned ?? 0),
        customersWithSales: Number(customerKpisRow.CustomersWithSales ?? 0),
        activeCustomerCodes: Number(customerKpisRow.ActiveCustomerCodes ?? 0),
        customersWithReturns: Number(customerKpisRow.CustomersWithReturns ?? 0),
        customersNet: Number(customerKpisRow.CustomersNet ?? 0),
        customersTotal: Number(customerKpisRow.CustomersTotal ?? 0),
        customersNew: Number(customerKpisRow.CustomersNew ?? 0),
        receivableOpening,
        billed: { bs: salesGrossBs, usd: salesGrossUsd },
      },
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
