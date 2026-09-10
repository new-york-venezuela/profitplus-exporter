import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate } from '@/app/api/dwh/lib/query-builder';
import type { CxcResponse, AgingBucketRow, DebtorRow } from '@/app/(app)/analitica/types';

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

const TOP_DEBTORS_QUERY = `
  SELECT TOP 10
    ISNULL(c.CustomerName, c.CustomerCode) AS Name,
    SUM(a.OutstandingBalance) AS Outstanding
  FROM fact.Fact_AR_Snapshot a
  JOIN dim.Dim_Customer c ON c.CustomerKey = a.CustomerKey
  WHERE a.SnapshotDateKey = @snapshotDateKey
  GROUP BY ISNULL(c.CustomerName, c.CustomerCode)
  HAVING SUM(a.OutstandingBalance) > 0
  ORDER BY Outstanding DESC
`;

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasDwhAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const currency = searchParams.get('currency') ?? 'bs';

  try {
    const pool = await getDwhPool();

    const [latestSnapshot, usdRate] = await Promise.all([
      pool.request().query(LATEST_SNAPSHOT_QUERY),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

    const snapshotDateKey: number | null = latestSnapshot.recordset[0]?.SnapshotDateKey ?? null;

    let agingBuckets: { AgingBucket: string; Amount: number }[] = [];
    let topDebtors: { Name: string; Outstanding: number }[] = [];

    if (snapshotDateKey !== null) {
      const [aging, debtors] = await Promise.all([
        pool.request().input('snapshotDateKey', snapshotDateKey).query(AGING_BUCKETS_QUERY),
        pool.request().input('snapshotDateKey', snapshotDateKey).query(TOP_DEBTORS_QUERY),
      ]);
      agingBuckets = aging.recordset;
      topDebtors = debtors.recordset;
    }

    const agingBucketsMapped: AgingBucketRow[] = agingBuckets.map(r => ({
      bucket: r.AgingBucket,
      amount: Number(r.Amount),
    }));

    const topDebtorsMapped: DebtorRow[] = topDebtors.map(r => ({
      name: r.Name,
      outstanding: Number(r.Outstanding),
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
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
