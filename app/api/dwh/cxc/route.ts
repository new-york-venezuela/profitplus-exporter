import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { buildDateWhereClause, getDimensionSpec, isClienteDimension, jsonWithCache, usdConversionJoin, type Dimension } from '@/app/api/dwh/lib/query-builder';
import { parseTrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { pickLastSnapshotPerBucket, rankByOverdue } from '@/app/(app)/analitica/lib/cxc-trends';
import type {
  CxcResponse, AgingBucketRow, CxcDebtorRow, WeekdayVencimientoRow, DsoTrendRow, AgingTrendRow, DebtConcentrationRow, DebtConcentrationResponse,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY
// (see migrations/dwh/), not the raw Profit Plus ERP.
//
// AR aging is a point-in-time snapshot, not a ranged metric, so unlike
// resumen/dashboard this route ignores dateRange and always reports the
// latest available Fact_AR_Snapshot run — see LATEST_SNAPSHOT_QUERY below.

// Latest available snapshot date, not "today" — Fact_AR_Snapshot only has
// data for dates it was actually run against (it's a disabled-by-default
// SQL Agent job in this phase; see migrations/dwh/README.md).
const LATEST_SNAPSHOT_QUERY = `
  SELECT MAX(SnapshotDateKey) AS SnapshotDateKey FROM fact.Fact_AR_Snapshot
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

function topDebtorsQuery(dimension: Dimension): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('a', 'fc2');
  return `
    SELECT TOP 10
      ${spec.labelExpr} AS Name,
      SUM(a.OutstandingBalance) AS OutstandingBs,
      SUM(a.OutstandingBalance / NULLIF(fx.RateSell, 0)) AS OutstandingUsd,
      SUM(CASE WHEN a.AgingBucket <> 'Current' THEN a.OutstandingBalance ELSE 0 END) AS OverdueBs,
      SUM(CASE WHEN a.AgingBucket <> 'Current' THEN a.OutstandingBalance / NULLIF(fx.RateSell, 0) END) AS OverdueUsd,
      SUM(CASE WHEN a.AgingBucket = 'Current' THEN a.OutstandingBalance ELSE 0 END) AS CurrentBs,
      SUM(CASE WHEN a.AgingBucket = 'Current' THEN a.OutstandingBalance / NULLIF(fx.RateSell, 0) END) AS CurrentUsd,
      (
        SELECT AVG(CAST(fc2.DateKey - fc2.DueDateKey AS float))
        FROM fact.Fact_Collections fc2
        ${innerJoin}
        WHERE fc2.IsVoided = 0 AND fc2.DueDateKey IS NOT NULL AND ${condition}
      ) AS AvgDaysToPay
    FROM fact.Fact_AR_Snapshot a
    ${usdConversionJoin('a', 'SnapshotDateKey')}
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
    GROUP BY ${spec.groupByColumn}
    HAVING SUM(a.OutstandingBalance) > 0
    ORDER BY OutstandingBs DESC
  `;
}

// Part 3e: top 15 customers by VENCIDO balance (any bucket but 'Current', ties
// by total outstanding) at the latest snapshot, broken out by AgingBucket — same bucket set as the aging chart,
// but per-customer instead of aggregated, to show where overdue debt
// concentrates. Reuses the same dimension spec as topDebtorsQuery so the
// Entidad/Tienda toggle applies here too. The 15-customer limit lives ONLY in
// the IN (...) subquery: a TOP on the outer (customer, bucket) rows would cut
// the result off after N bucket rows and silently drop whole customers.
function debtConcentrationQuery(dimension: Dimension): string {
  const spec = getDimensionSpec(dimension);
  return `
    SELECT ${spec.labelExpr} AS Name, a.AgingBucket,
      SUM(a.OutstandingBalance) AS AmountBs,
      SUM(a.OutstandingBalance / NULLIF(fx.RateSell, 0)) AS AmountUsd
    FROM fact.Fact_AR_Snapshot a
    ${usdConversionJoin('a', 'SnapshotDateKey')}
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey AND a.IsCreditNote = 0
      AND ${spec.groupByColumn.split(',')[0].trim()} IN (
        SELECT TOP 15 ${spec.groupByColumn.split(',')[0].trim()}
        FROM fact.Fact_AR_Snapshot a2
        ${spec.joinClause.replace(/\bf\b/g, 'a2')}
        WHERE a2.SnapshotDateKey = @snapshotDateKey AND a2.IsCreditNote = 0
        GROUP BY ${spec.groupByColumn}
        ORDER BY SUM(CASE WHEN a2.AgingBucket <> 'Current' THEN a2.OutstandingBalance ELSE 0 END) DESC,
                 SUM(a2.OutstandingBalance) DESC
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
    SUM(CASE WHEN fc.DateKey = fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS VenceHoyBs,
    CASE WHEN COUNT(CASE WHEN fc.DateKey = fc.DueDateKey THEN fc.AmountCollected END) = 0 THEN 0
         ELSE SUM(CASE WHEN fc.DateKey = fc.DueDateKey THEN fc.AmountCollected / NULLIF(fx.RateSell, 0) END) END AS VenceHoyUsd,
    SUM(CASE WHEN fc.DateKey > fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS VencidaBs,
    CASE WHEN COUNT(CASE WHEN fc.DateKey > fc.DueDateKey THEN fc.AmountCollected END) = 0 THEN 0
         ELSE SUM(CASE WHEN fc.DateKey > fc.DueDateKey THEN fc.AmountCollected / NULLIF(fx.RateSell, 0) END) END AS VencidaUsd,
    SUM(CASE WHEN fc.DateKey < fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS NoVencidaBs,
    CASE WHEN COUNT(CASE WHEN fc.DateKey < fc.DueDateKey THEN fc.AmountCollected END) = 0 THEN 0
         ELSE SUM(CASE WHEN fc.DateKey < fc.DueDateKey THEN fc.AmountCollected / NULLIF(fx.RateSell, 0) END) END AS NoVencidaUsd
  FROM fact.Fact_Collections fc
  ${usdConversionJoin('fc')}
  JOIN dim.Dim_Date dd ON dd.DateKey = fc.DateKey
  WHERE fc.IsVoided = 0 AND fc.DueDateKey IS NOT NULL
  GROUP BY dd.DayOfWeek, dd.DayName
  ORDER BY dd.DayOfWeek
`;

const WEEKDAY_ES_LABELS: Record<string, string> = {
  Sunday: 'Dom', Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mié',
  Thursday: 'Jue', Friday: 'Vie', Saturday: 'Sáb',
};

// Part 3c: DSO = (AR balance at the snapshot / net sales in the trailing 90
// days) x 90, one point per day/week/month bucket (see snapshotDatesQuery and
// pickLastSnapshotPerBucket: each bucket uses its LAST snapshot; there may be
// zero or several runs inside a bucket, since the daily AR snapshot job is
// disabled by default -- see migrations/dwh/README.md's "Enabling the SQL
// Agent jobs" section). The trailing 90-day window is fixed, independent of
// the page's own range.
// Snapshot dates inside the selected range (not all history); the per-bucket
// choice is made in TypeScript.
function snapshotDatesQuery(dateRange: string): string {
  return `
    SELECT DISTINCT a.SnapshotDateKey
    FROM fact.Fact_AR_Snapshot a
    WHERE 1 = 1 ${buildDateWhereClause(dateRange, 'a', 'SnapshotDateKey')}
    ORDER BY a.SnapshotDateKey
  `;
}

function dsoForSnapshotQuery(): string {
  return `
    DECLARE @Balance decimal(18,2) = (
      SELECT ISNULL(SUM(OutstandingBalance), 0) FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = @snapshotDateKey AND IsCreditNote = 0
    );
    DECLARE @TrailingStart int = (
      SELECT CONVERT(int, FORMAT(DATEADD(day, -90, CAST(CAST(@snapshotDateKey AS varchar(8)) AS date)), 'yyyyMMdd'))
    );
    -- Denominator on the SAME basis as the AR balance (saldo, IVA incluido):
    -- sales WITH IVA minus returns WITH IVA (by devolución date, the date
    -- the credit note reduces the balance) over the trailing 90 days.
    DECLARE @NetSales decimal(18,2) = (
      SELECT ISNULL(SUM(fs.NetAmount + ISNULL(fs.TaxAmount, 0)), 0) FROM fact.Fact_Sales fs
      WHERE fs.IsVoided = 0 AND fs.DateKey >= @TrailingStart AND fs.DateKey <= @snapshotDateKey
    ) - (
      SELECT ISNULL(SUM(fr.NetAmount + ISNULL(fr.TaxAmount, 0)), 0) FROM fact.Fact_Returns fr
      WHERE fr.IsVoided = 0 AND fr.DateKey >= @TrailingStart AND fr.DateKey <= @snapshotDateKey
    );
    SELECT @Balance AS Balance, @NetSales AS NetSales;
  `;
}

// Part 3d: same 5 buckets as the single-snapshot aging chart, for the chosen
// snapshots only (one per day/week/month bucket). snapshotKeys are integers
// that came out of snapshotDatesQuery, never user text.
function agingTrendQuery(snapshotKeys: number[]): string {
  return `
    SELECT a.SnapshotDateKey, a.AgingBucket,
      SUM(a.OutstandingBalance) AS AmountBs,
      SUM(a.OutstandingBalance / NULLIF(fx.RateSell, 0)) AS AmountUsd
    FROM fact.Fact_AR_Snapshot a
    ${usdConversionJoin('a', 'SnapshotDateKey')}
    WHERE a.IsCreditNote = 0 AND a.SnapshotDateKey IN (${snapshotKeys.join(', ')})
    GROUP BY a.SnapshotDateKey, a.AgingBucket
    ORDER BY a.SnapshotDateKey
  `;
}

async function handleDebtConcentration(snapshotDateKey: number, clienteDimension: Dimension): Promise<NextResponse> {
  const pool = await getDwhPool();
  const result = await pool.request().input('snapshotDateKey', snapshotDateKey).query(debtConcentrationQuery(clienteDimension));

  const byName = new Map<string, DebtConcentrationRow>();
  for (const r of result.recordset as { Name: string; AgingBucket: string; AmountBs: number; AmountUsd: number | null }[]) {
    let entry = byName.get(r.Name);
    if (!entry) {
      entry = { name: r.Name, buckets: [] };
      byName.set(r.Name, entry);
    }
    entry.buckets.push({ bucket: r.AgingBucket, amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) } });
  }

  // The query picks the top 15 by vencido; the final order is the collection
  // priority (vencido desc, then total), not alphabetical.
  const response: DebtConcentrationResponse = { rows: rankByOverdue(Array.from(byName.values())) };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const clienteDimensionParam = searchParams.get('clienteDimension');
  const clienteDimension: Dimension = isClienteDimension(clienteDimensionParam) ? clienteDimensionParam : 'cliente_entidad';
  // The point-in-time cards (aging, top debtors, concentration) always use the
  // latest snapshot; only the DSO / aging TRENDS follow the page's date range
  // and granularity (day/week/month rules shared with Resumen and Ventas).
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const trendBucket = parseTrendBucket(searchParams, dateRange);

  try {
    const pool = await getDwhPool();

    const latestSnapshot = await pool.request().query(LATEST_SNAPSHOT_QUERY);
    const snapshotDateKey: number | null = latestSnapshot.recordset[0]?.SnapshotDateKey ?? null;

    const section = searchParams.get('section');
    if (section === 'debtConcentration') {
      if (snapshotDateKey === null) {
        return jsonWithCache({ rows: [] } satisfies DebtConcentrationResponse);
      }
      return await handleDebtConcentration(snapshotDateKey, clienteDimension);
    }

    let agingBuckets: { AgingBucket: string; AmountBs: number; AmountUsd: number | null }[] = [];
    let topDebtors: {
      Name: string; OutstandingBs: number; OutstandingUsd: number | null; AvgDaysToPay: number | null;
      OverdueBs: number; OverdueUsd: number | null; CurrentBs: number; CurrentUsd: number | null;
    }[] = [];
    let weekdayRows: { DayOfWeek: number; DayName: string; VenceHoyBs: number; VenceHoyUsd: number | null; VencidaBs: number; VencidaUsd: number | null; NoVencidaBs: number; NoVencidaUsd: number | null }[] = [];

    // Weekday x vencimiento reads all of Fact_Collections' history and the
    // snapshot-date list is range-scoped; neither depends on "latest", so they
    // run even if no snapshot has ever been taken.
    const [weekdayResult, snapshotDatesResult] = await Promise.all([
      pool.request().query(WEEKDAY_VENCIMIENTO_QUERY),
      pool.request().query(snapshotDatesQuery(dateRange)),
    ]);
    weekdayRows = weekdayResult.recordset;
    const snapshotDates = snapshotDatesResult.recordset.map(r => Number(r.SnapshotDateKey)).filter(Number.isInteger);
    const picks = pickLastSnapshotPerBucket(snapshotDates, trendBucket.mode);

    if (snapshotDateKey !== null) {
      const [aging, debtors] = await Promise.all([
        pool.request().input('snapshotDateKey', snapshotDateKey).query(AGING_BUCKETS_QUERY),
        pool.request().input('snapshotDateKey', snapshotDateKey).query(topDebtorsQuery(clienteDimension)),
      ]);
      agingBuckets = aging.recordset;
      topDebtors = debtors.recordset;
    }

    // One aging query for all chosen snapshots, plus one DSO scalar query per
    // chosen snapshot (each has its own balance / trailing net sales pair),
    // run in parallel like every other Promise.all in this route.
    const agingTrendResult = picks.length > 0
      ? await pool.request().query(agingTrendQuery(picks.map(p => p.snapshotDateKey)))
      : { recordset: [] as { SnapshotDateKey: number; AgingBucket: string; AmountBs: number; AmountUsd: number | null }[] };
    const dsoTrend: DsoTrendRow[] = await Promise.all(
      picks.map(async p => {
        const req = pool.request();
        req.input('snapshotDateKey', p.snapshotDateKey);
        const result = await req.query(dsoForSnapshotQuery());
        // dsoForSnapshotQuery() has no named result sets, so `recordsets` is
        // always positional here -- mssql's type union with the named-sets
        // dictionary form doesn't reflect that, hence the cast.
        const recordsets = result.recordsets as unknown as { Balance: number; NetSales: number }[][];
        const row = recordsets[recordsets.length - 1][0] as { Balance: number; NetSales: number } | undefined;
        const balance = Number(row?.Balance ?? 0);
        const netSales = Number(row?.NetSales ?? 0);
        return { bucket: p.bucket, snapshotDateKey: p.snapshotDateKey, dso: netSales > 0 ? (balance / netSales) * 90 : null };
      })
    );

    const agingBucketsMapped: AgingBucketRow[] = agingBuckets.map(r => ({
      bucket: r.AgingBucket,
      amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) },
    }));

    const weekdayVencimiento: WeekdayVencimientoRow[] = weekdayRows.map(r => ({
      weekday: WEEKDAY_ES_LABELS[r.DayName] ?? r.DayName,
      venceHoy: { bs: Number(r.VenceHoyBs), usd: r.VenceHoyUsd === null ? null : Number(r.VenceHoyUsd) },
      vencida: { bs: Number(r.VencidaBs), usd: r.VencidaUsd === null ? null : Number(r.VencidaUsd) },
      noVencida: { bs: Number(r.NoVencidaBs), usd: r.NoVencidaUsd === null ? null : Number(r.NoVencidaUsd) },
    }));

    const agingBySnapshot = new Map<number, AgingBucketRow[]>();
    for (const r of agingTrendResult.recordset) {
      const list = agingBySnapshot.get(Number(r.SnapshotDateKey)) ?? [];
      list.push({ bucket: r.AgingBucket, amount: { bs: Number(r.AmountBs), usd: r.AmountUsd === null ? null : Number(r.AmountUsd) } });
      agingBySnapshot.set(Number(r.SnapshotDateKey), list);
    }
    const agingTrend: AgingTrendRow[] = picks.map(p => ({
      bucket: p.bucket,
      snapshotDateKey: p.snapshotDateKey,
      buckets: agingBySnapshot.get(p.snapshotDateKey) ?? [],
    }));

    // A SUM over zero rows of one kind is NULL in SQL; with no BS amount there
    // either, that is "nothing of this kind" (0), not an unknown USD figure.
    const usdOrZero = (usd: number | null, bs: number): number | null => (usd === null ? (bs === 0 ? 0 : null) : Number(usd));
    const topDebtorsMapped: CxcDebtorRow[] = topDebtors.map(r => ({
      name: r.Name,
      outstanding: { bs: Number(r.OutstandingBs), usd: r.OutstandingUsd === null ? null : Number(r.OutstandingUsd) },
      avgDaysToPay: r.AvgDaysToPay !== null && r.AvgDaysToPay !== undefined ? Number(r.AvgDaysToPay) : null,
      overdue: { bs: Number(r.OverdueBs), usd: usdOrZero(r.OverdueUsd, Number(r.OverdueBs)) },
      current: { bs: Number(r.CurrentBs), usd: usdOrZero(r.CurrentUsd, Number(r.CurrentBs)) },
    }));

    const totalOutstanding = agingBucketsMapped.reduce((sum, b) => sum + b.amount.bs, 0);
    const overdueOutstanding = agingBucketsMapped
      .filter(b => b.bucket !== 'Current')
      .reduce((sum, b) => sum + b.amount.bs, 0);
    const overdueShare = totalOutstanding > 0 ? overdueOutstanding / totalOutstanding : null;

    const response: CxcResponse = {
      agingBuckets: agingBucketsMapped,
      topDebtors: topDebtorsMapped,
      overdueShare,
      snapshotDateKey,
      weekdayVencimiento,
      trendMode: trendBucket.mode,
      dsoTrend,
      agingTrend,
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
