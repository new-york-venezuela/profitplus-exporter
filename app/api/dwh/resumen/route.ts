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

    const [trend, topCustomers, topProducts, salesReps, latestSnapshot, totals, usdRate] = await Promise.all([
      pool.request().query(monthlyTrendQuery(salesDateWhere)),
      pool.request().query(topCustomersQuery(salesDateWhere)),
      pool.request().query(topProductsQuery(salesDateWhere)),
      pool.request().query(salesRepQuery(salesDateWhere, returnsDateWhere)),
      pool.request().query(LATEST_SNAPSHOT_QUERY),
      pool.request().query(totalsQuery(salesDateWhere, returnsDateWhere, collectionsDateWhere)),
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
      },
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
