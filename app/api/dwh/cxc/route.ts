import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, getDimensionSpec, isClienteDimension, jsonWithCache, type Dimension } from '@/app/api/dwh/lib/query-builder';
import type {
  CxcResponse, AgingBucketRow, DebtorRow, WeekdayVencimientoRow, DsoTrendRow, AgingTrendRow, DebtConcentrationRow, DebtConcentrationResponse,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY
// (see dwh-migrations/), not the raw Profit Plus ERP.
//
// AR aging is a point-in-time snapshot, not a ranged metric, so unlike
// resumen/dashboard this route ignores dateRange and always reports the
// latest available Fact_AR_Snapshot run — see LATEST_SNAPSHOT_QUERY below.

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

function topDebtorsQuery(dimension: Dimension): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('a', 'fc2');
  return `
    SELECT TOP 10
      ${spec.labelExpr} AS Name,
      SUM(a.OutstandingBalance) AS Outstanding,
      (
        SELECT AVG(CAST(fc2.DateKey - fc2.DueDateKey AS float))
        FROM fact.Fact_Collections fc2
        ${innerJoin}
        WHERE fc2.IsVoided = 0 AND fc2.DueDateKey IS NOT NULL AND ${condition}
      ) AS AvgDaysToPay
    FROM fact.Fact_AR_Snapshot a
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey
    GROUP BY ${spec.groupByColumn}
    HAVING SUM(a.OutstandingBalance) > 0
    ORDER BY Outstanding DESC
  `;
}

// Part 3e: top 15 customers by total outstanding balance at the latest
// snapshot, broken out by AgingBucket — same bucket set as the aging chart,
// but per-customer instead of aggregated, to show where overdue debt
// concentrates. Reuses the same dimension spec as topDebtorsQuery so the
// Entidad/Tienda toggle applies here too.
function debtConcentrationQuery(dimension: Dimension): string {
  const spec = getDimensionSpec(dimension);
  return `
    SELECT TOP 15 ${spec.labelExpr} AS Name, a.AgingBucket, SUM(a.OutstandingBalance) AS Amount
    FROM fact.Fact_AR_Snapshot a
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
      AND ${spec.groupByColumn.split(',')[0].trim()} IN (
        SELECT TOP 15 ${spec.groupByColumn.split(',')[0].trim()}
        FROM fact.Fact_AR_Snapshot a2
        ${spec.joinClause.replace(/\bf\b/g, 'a2')}
        WHERE a2.SnapshotDateKey = @snapshotDateKey AND a2.IsCreditNote = 0
        GROUP BY ${spec.groupByColumn}
        ORDER BY SUM(a2.OutstandingBalance) DESC
      )
    GROUP BY ${spec.groupByColumn}, a.AgingBucket
    ORDER BY ${spec.groupByColumn.split(',')[0].trim()}
  `;
}

// Part 3b: for each Fact_Collections row with a resolvable DueDateKey
// (0027_fact_collections_due_date.sql), bucket its AmountCollected into one
// of 3 vencimiento-status series based on comparing DateKey (payment date)
// to DueDateKey (invoice due date), then group by the payment date's
// weekday. dd (joined on fc.DateKey) supplies DayOfWeek/DayName; a second
// unaliased comparison against fc.DueDateKey needs no extra join since
// DateKey/DueDateKey are both plain int columns on Fact_Collections itself.
const WEEKDAY_VENCIMIENTO_QUERY = `
  SELECT
    dd.DayOfWeek,
    dd.DayName,
    SUM(CASE WHEN fc.DateKey = fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS VenceHoy,
    SUM(CASE WHEN fc.DateKey > fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS Vencida,
    SUM(CASE WHEN fc.DateKey < fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS NoVencida
  FROM fact.Fact_Collections fc
  JOIN dim.Dim_Date dd ON dd.DateKey = fc.DateKey
  WHERE fc.IsVoided = 0 AND fc.DueDateKey IS NOT NULL
  GROUP BY dd.DayOfWeek, dd.DayName
  ORDER BY dd.DayOfWeek
`;

const WEEKDAY_ES_LABELS: Record<string, string> = {
  Sunday: 'Dom', Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mié',
  Thursday: 'Jue', Friday: 'Vie', Saturday: 'Sáb',
};

// Part 3c: DSO = (AR balance at month end / net sales in a trailing period)
// x days in period — one point per YearMonth that has at least one
// Fact_AR_Snapshot run, using each month's LATEST snapshot as "month end"
// (there may be 0 or several snapshot runs within a given month, since the
// daily AR snapshot job is disabled by default -- see dwh-migrations/README.md's
// "Enabling the SQL Agent jobs" section). Net sales trailing period =
// the 90 days ending on that same snapshot date (fixed 90-day trailing
// window, independent of the CxC tab's own date handling, per the spec).
const DSO_TREND_QUERY = `
  SELECT
    d.YearMonth,
    MAX(a.SnapshotDateKey) AS MonthEndSnapshotDateKey
  FROM fact.Fact_AR_Snapshot a
  JOIN dim.Dim_Date d ON d.DateKey = a.SnapshotDateKey
  GROUP BY d.YearMonth
  ORDER BY d.YearMonth
`;

function dsoForSnapshotQuery(): string {
  return `
    DECLARE @Balance decimal(18,2) = (
      SELECT ISNULL(SUM(OutstandingBalance), 0) FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = @snapshotDateKey AND IsCreditNote = 0
    );
    DECLARE @TrailingStart int = (
      SELECT CONVERT(int, FORMAT(DATEADD(day, -90, CAST(CAST(@snapshotDateKey AS varchar(8)) AS date)), 'yyyyMMdd'))
    );
    DECLARE @NetSales decimal(18,2) = (
      SELECT ISNULL(SUM(fs.NetAmount), 0) FROM fact.Fact_Sales fs
      WHERE fs.IsVoided = 0 AND fs.DateKey >= @TrailingStart AND fs.DateKey <= @snapshotDateKey
    );
    SELECT @Balance AS Balance, @NetSales AS NetSales;
  `;
}

// Part 3d: same 5 buckets as the existing single-snapshot aging chart
// (tab-cxc.tsx's BUCKET_ORDER/BUCKET_COLORS), trended across every distinct
// SnapshotDateKey instead of just MAX(SnapshotDateKey). Ordered so the UI
// can render oldest-to-newest without a client-side sort.
const AGING_TREND_QUERY = `
  SELECT a.SnapshotDateKey, a.AgingBucket, SUM(a.OutstandingBalance) AS Amount
  FROM fact.Fact_AR_Snapshot a
  WHERE a.IsCreditNote = 0
  GROUP BY a.SnapshotDateKey, a.AgingBucket
  ORDER BY a.SnapshotDateKey
`;

async function handleDebtConcentration(snapshotDateKey: number, clienteDimension: Dimension, currency: string) {
  const pool = await getDwhPool();
  const [result, usdRate] = await Promise.all([
    pool.request().input('snapshotDateKey', snapshotDateKey).query(debtConcentrationQuery(clienteDimension)),
    currency === 'usd' ? getUsdRate() : Promise.resolve(null),
  ]);

  const byName = new Map<string, DebtConcentrationRow>();
  for (const r of result.recordset as { Name: string; AgingBucket: string; Amount: number }[]) {
    let entry = byName.get(r.Name);
    if (!entry) {
      entry = { name: r.Name, buckets: [] };
      byName.set(r.Name, entry);
    }
    entry.buckets.push({ bucket: r.AgingBucket, amount: Number(r.Amount) });
  }

  const response: DebtConcentrationResponse = { rows: Array.from(byName.values()), usdRate };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const currency = searchParams.get('currency') ?? 'bs';
  const clienteDimensionParam = searchParams.get('clienteDimension');
  const clienteDimension: Dimension = isClienteDimension(clienteDimensionParam) ? clienteDimensionParam : 'cliente_entidad';

  try {
    const pool = await getDwhPool();

    const [latestSnapshot, usdRate] = await Promise.all([
      pool.request().query(LATEST_SNAPSHOT_QUERY),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

    const snapshotDateKey: number | null = latestSnapshot.recordset[0]?.SnapshotDateKey ?? null;

    const section = searchParams.get('section');
    if (section === 'debtConcentration') {
      if (snapshotDateKey === null) {
        return jsonWithCache({ rows: [], usdRate: null } satisfies DebtConcentrationResponse);
      }
      return await handleDebtConcentration(snapshotDateKey, clienteDimension, currency);
    }

    let agingBuckets: { AgingBucket: string; Amount: number }[] = [];
    let topDebtors: { Name: string; Outstanding: number; AvgDaysToPay: number | null }[] = [];
    let weekdayRows: { DayOfWeek: number; DayName: string; VenceHoy: number; Vencida: number; NoVencida: number }[] = [];
    let agingTrendRows: { SnapshotDateKey: number; AgingBucket: string; Amount: number }[] = [];
    let dsoMonths: { YearMonth: string; MonthEndSnapshotDateKey: number }[] = [];

    // Weekday x vencimiento and aging-trend queries don't depend on
    // "latest" snapshot — they read across all of Fact_Collections/
    // Fact_AR_Snapshot's history, so they run regardless of whether a
    // snapshot has ever been taken, unlike the two snapshot-scoped queries
    // below (kept inside the snapshotDateKey !== null guard, unchanged).
    const [weekdayResult, agingTrendResult] = await Promise.all([
      pool.request().query(WEEKDAY_VENCIMIENTO_QUERY),
      pool.request().query(AGING_TREND_QUERY),
    ]);
    weekdayRows = weekdayResult.recordset;
    agingTrendRows = agingTrendResult.recordset;

    if (snapshotDateKey !== null) {
      const [aging, debtors, dsoMonthsResult] = await Promise.all([
        pool.request().input('snapshotDateKey', snapshotDateKey).query(AGING_BUCKETS_QUERY),
        pool.request().input('snapshotDateKey', snapshotDateKey).query(topDebtorsQuery(clienteDimension)),
        pool.request().query(DSO_TREND_QUERY),
      ]);
      agingBuckets = aging.recordset;
      topDebtors = debtors.recordset;
      dsoMonths = dsoMonthsResult.recordset;
    }

    // DSO needs one extra scalar query PER month-end snapshot (each month's
    // own balance/net-sales pair) -- run them in parallel rather than
    // sequentially, same pattern as every other Promise.all in this route.
    const dsoTrend: DsoTrendRow[] = await Promise.all(
      dsoMonths.map(async m => {
        const req = pool.request();
        req.input('snapshotDateKey', m.MonthEndSnapshotDateKey);
        const result = await req.query(dsoForSnapshotQuery());
        // dsoForSnapshotQuery() has no named result sets, so `recordsets` is
        // always positional here -- mssql's type union with the named-sets
        // dictionary form doesn't reflect that, hence the cast.
        const recordsets = result.recordsets as unknown as { Balance: number; NetSales: number }[][];
        const row = recordsets[recordsets.length - 1][0] as { Balance: number; NetSales: number } | undefined;
        const balance = Number(row?.Balance ?? 0);
        const netSales = Number(row?.NetSales ?? 0);
        return { yearMonth: m.YearMonth, dso: netSales > 0 ? (balance / netSales) * 90 : null };
      })
    );

    const agingBucketsMapped: AgingBucketRow[] = agingBuckets.map(r => ({
      bucket: r.AgingBucket,
      amount: Number(r.Amount),
    }));

    const weekdayVencimiento: WeekdayVencimientoRow[] = weekdayRows.map(r => ({
      weekday: WEEKDAY_ES_LABELS[r.DayName] ?? r.DayName,
      venceHoy: Number(r.VenceHoy),
      vencida: Number(r.Vencida),
      noVencida: Number(r.NoVencida),
    }));

    const agingTrendByMonth = new Map<string, AgingBucketRow[]>();
    for (const r of agingTrendRows) {
      // SnapshotDateKey is an int like 20260915 -- slice to YYYY-MM without
      // an extra Dim_Date join, same int->string convention formatSnapshotDate
      // already uses client-side in tab-cxc.tsx.
      const s = String(r.SnapshotDateKey);
      const yearMonth = `${s.slice(0, 4)}-${s.slice(4, 6)}`;
      const existing = agingTrendByMonth.get(yearMonth) ?? [];
      existing.push({ bucket: r.AgingBucket, amount: Number(r.Amount) });
      agingTrendByMonth.set(yearMonth, existing);
    }
    const agingTrend: AgingTrendRow[] = Array.from(agingTrendByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([yearMonth, buckets]) => ({ yearMonth, buckets }));

    const topDebtorsMapped: DebtorRow[] = topDebtors.map(r => ({
      name: r.Name,
      outstanding: Number(r.Outstanding),
      avgDaysToPay: r.AvgDaysToPay !== null && r.AvgDaysToPay !== undefined ? Number(r.AvgDaysToPay) : null,
    }));

    const totalOutstanding = agingBucketsMapped.reduce((sum, b) => sum + b.amount, 0);
    const overdueOutstanding = agingBucketsMapped
      .filter(b => b.bucket !== 'Current')
      .reduce((sum, b) => sum + b.amount, 0);
    const overdueShare = totalOutstanding > 0 ? overdueOutstanding / totalOutstanding : null;

    const response: CxcResponse = {
      agingBuckets: agingBucketsMapped,
      topDebtors: topDebtorsMapped,
      overdueShare,
      snapshotDateKey,
      usdRate,
      weekdayVencimiento,
      dsoTrend,
      agingTrend,
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
