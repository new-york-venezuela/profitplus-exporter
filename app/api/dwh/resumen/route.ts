import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import type {
  ResumenResponse,
  MonthlyTrendRow,
  NamedAmount,
  SalesRepRow,
  AgingBucketRow,
  DebtorRow,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// All queries here read from the pre-aggregated dwh/dim/fact schema in
// DWH_AlimentosNY (see dwh-migrations/), not the raw Profit Plus ERP —
// so no COLLATE/RTRIM gymnastics are needed here, that work already
// happened at load time.

function monthlyTrendQuery(dateWhere: string): string {
  return `
    SELECT
      d.YearMonth,
      SUM(fs.NetAmount) AS SalesNet,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         JOIN dim.Dim_Date dr ON dr.DateKey = fr.DateKey
         WHERE dr.YearMonth = d.YearMonth AND fr.IsVoided = 0) AS ReturnsNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY d.YearMonth
    ORDER BY d.YearMonth
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
      SUM(fs.NetAmount) AS NetRevenue
    FROM fact.Fact_Sales fs
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY NetRevenue DESC
  `;
}

function topProductsQuery(dateWhere: string): string {
  return `
    SELECT TOP 10
      ISNULL(p.ProductName, p.ProductCode) AS Name,
      SUM(fs.NetAmount) AS NetRevenue
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.ProductName, p.ProductCode)
    ORDER BY NetRevenue DESC
  `;
}

function salesRepQuery(dateWhere: string, returnsDateWhere: string): string {
  return `
    SELECT
      ISNULL(r.SalesRepName, r.SalesRepCode) AS Name,
      SUM(fs.NetAmount) AS SalesNet,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
    ORDER BY SalesNet DESC
  `;
}

// Latest available snapshot date, not "today" — Fact_AR_Snapshot only has
// data for dates it was actually run against (it's a disabled-by-default
// SQL Agent job in this phase; see dwh-migrations/README.md).
const LATEST_SNAPSHOT_QUERY = `
  SELECT MAX(SnapshotDateKey) AS SnapshotDateKey FROM fact.Fact_AR_Snapshot
`;

const AGING_BUCKETS_QUERY = `
  SELECT AgingBucket, SUM(OutstandingBalance) AS Amount
  FROM fact.Fact_AR_Snapshot
  WHERE SnapshotDateKey = @snapshotDateKey AND IsCreditNote = 0
  GROUP BY AgingBucket
`;

// Same cliente_entidad grain as topCustomersQuery above — a chain's
// outstanding balance across all its stores should roll up to one row.
function topDebtorsQuery(): string {
  const spec = getDimensionSpec('cliente_entidad');
  return `
    SELECT TOP 10
      ${spec.labelExpr} AS Name,
      SUM(a.OutstandingBalance) AS Outstanding
    FROM fact.Fact_AR_Snapshot a
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey
    GROUP BY ${spec.groupByColumn}
    HAVING SUM(a.OutstandingBalance) > 0
    ORDER BY Outstanding DESC
  `;
}

function totalsQuery(salesDateWhere: string, returnsDateWhere: string, collectionsDateWhere: string): string {
  return `
    SELECT
      (SELECT ISNULL(SUM(NetAmount), 0) FROM fact.Fact_Sales fs
         WHERE fs.IsVoided = 0 ${salesDateWhere}) AS SalesNet12mo,
      (SELECT ISNULL(SUM(NetAmount), 0) FROM fact.Fact_Returns fr
         WHERE fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNet12mo,
      (SELECT ISNULL(SUM(AmountCollected), 0) FROM fact.Fact_Collections fc
         WHERE fc.IsVoided = 0 ${collectionsDateWhere}) AS Collected12mo
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
  const currency = searchParams.get('currency') ?? 'bs';

  try {
    const pool = await getDwhPool();

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
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

    const [trend, topCustomers, topProducts, salesReps, latestSnapshot, totals, activeCustomersResult, usdRate] = await Promise.all([
      pool.request().query(monthlyTrendQuery(salesDateWhere)),
      pool.request().query(topCustomersQuery(salesDateWhere)),
      pool.request().query(topProductsQuery(salesDateWhere)),
      pool.request().query(salesRepQuery(salesDateWhere, returnsDateWhere)),
      pool.request().query(LATEST_SNAPSHOT_QUERY),
      pool.request().query(totalsQuery(salesDateWhere, returnsDateWhere, collectionsDateWhere)),
      prevSalesDateWhere !== null
        ? pool.request().query(activeCustomersQuery(salesDateWhere, salesDateWhereFs2, prevSalesDateWhere))
        : pool.request().query(`SELECT COUNT(DISTINCT le.LegalEntityKey) AS ActiveCustomers, NULL AS ActiveCustomersPrevPeriod, NULL AS ChurnedCustomers
            FROM fact.Fact_Sales fs
            JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
            JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
            WHERE fs.IsVoided = 0 ${salesDateWhere}`),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

    const snapshotDateKey: number | null = latestSnapshot.recordset[0]?.SnapshotDateKey ?? null;

    let agingBuckets: { AgingBucket: string; Amount: number }[] = [];
    let topDebtors: { Name: string; Outstanding: number }[] = [];

    if (snapshotDateKey !== null) {
      const [aging, debtors] = await Promise.all([
        pool.request().input('snapshotDateKey', snapshotDateKey).query(AGING_BUCKETS_QUERY),
        pool.request().input('snapshotDateKey', snapshotDateKey).query(topDebtorsQuery()),
      ]);
      agingBuckets = aging.recordset;
      topDebtors = debtors.recordset;
    }

    const totalsRow = totals.recordset[0] ?? { SalesNet12mo: 0, ReturnsNet12mo: 0, Collected12mo: 0 };
    const salesNet = Number(totalsRow.SalesNet12mo);
    const returnsNet = Number(totalsRow.ReturnsNet12mo);

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

    const monthlyTrend: MonthlyTrendRow[] = trend.recordset.map(r => ({
      yearMonth: r.YearMonth,
      salesNet: Number(r.SalesNet),
      returnsNet: Number(r.ReturnsNet),
    }));

    const topCustomersMapped: NamedAmount[] = topCustomers.recordset.map(r => ({
      name: r.Name,
      netRevenue: Number(r.NetRevenue),
    }));

    const topProductsMapped: NamedAmount[] = topProducts.recordset.map(r => ({
      name: r.Name,
      netRevenue: Number(r.NetRevenue),
    }));

    const salesRepsMapped: SalesRepRow[] = salesReps.recordset.map(r => ({
      name: r.Name,
      salesNet: Number(r.SalesNet),
      returnsNet: Number(r.ReturnsNet),
    }));

    const agingBucketsMapped: AgingBucketRow[] = agingBuckets.map(r => ({
      bucket: r.AgingBucket,
      amount: Number(r.Amount),
    }));

    const topDebtorsMapped: DebtorRow[] = topDebtors.map(r => ({
      name: r.Name,
      outstanding: Number(r.Outstanding),
      // Resumen's summary view doesn't compute this (CxC's route does,
      // for its own dedicated top-debtors table) — DebtorRow is shared
      // between the two responses.
      avgDaysToPay: null,
    }));

    const response: ResumenResponse = {
      monthlyTrend,
      topCustomers: topCustomersMapped,
      topProducts: topProductsMapped,
      salesReps: salesRepsMapped,
      agingBuckets: agingBucketsMapped,
      topDebtors: topDebtorsMapped,
      snapshotDateKey,
      usdRate,
      kpis: {
        salesNet12mo: salesNet,
        returnsNet12mo: returnsNet,
        returnRate: salesNet > 0 ? returnsNet / salesNet : null,
        collected12mo: Number(totalsRow.Collected12mo),
        activeCustomers,
        activeCustomersPrevPeriod,
        churnRate,
      },
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
