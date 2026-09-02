import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { getDwhPool } from '@/lib/db/dwh-mssql';

export const dynamic = 'force-dynamic';

// All queries here read from the pre-aggregated dwh/dim/fact schema in
// DWH_AlimentosNY (see dwh-migrations/), not the raw Profit Plus ERP —
// so no COLLATE/RTRIM gymnastics are needed here, that work already
// happened at load time.

const MONTHLY_TREND_QUERY = `
  SELECT
    d.YearMonth,
    SUM(fs.NetAmount) AS SalesNet,
    (SELECT ISNULL(SUM(fr.NetAmount), 0)
       FROM fact.Fact_Returns fr
       JOIN dim.Dim_Date dr ON dr.DateKey = fr.DateKey
       WHERE dr.YearMonth = d.YearMonth AND fr.IsVoided = 0) AS ReturnsNet
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
  WHERE fs.IsVoided = 0 AND d.FullDate >= DATEADD(month, -12, CAST(GETUTCDATE() AS date))
  GROUP BY d.YearMonth
  ORDER BY d.YearMonth
`;

const TOP_CUSTOMERS_QUERY = `
  SELECT TOP 10
    ISNULL(c.CustomerName, c.CustomerCode) AS Name,
    SUM(fs.NetAmount) AS NetRevenue
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  WHERE fs.IsVoided = 0 AND fs.DateKey >= CONVERT(int, FORMAT(DATEADD(month, -12, GETUTCDATE()), 'yyyyMMdd'))
  GROUP BY ISNULL(c.CustomerName, c.CustomerCode)
  ORDER BY NetRevenue DESC
`;

const TOP_PRODUCTS_QUERY = `
  SELECT TOP 10
    ISNULL(p.ProductName, p.ProductCode) AS Name,
    SUM(fs.NetAmount) AS NetRevenue
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
  WHERE fs.IsVoided = 0 AND fs.DateKey >= CONVERT(int, FORMAT(DATEADD(month, -12, GETUTCDATE()), 'yyyyMMdd'))
  GROUP BY ISNULL(p.ProductName, p.ProductCode)
  ORDER BY NetRevenue DESC
`;

const SALES_REP_QUERY = `
  SELECT
    ISNULL(r.SalesRepName, r.SalesRepCode) AS Name,
    SUM(fs.NetAmount) AS SalesNet,
    (SELECT ISNULL(SUM(fr.NetAmount), 0)
       FROM fact.Fact_Returns fr
       WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0
         AND fr.DateKey >= CONVERT(int, FORMAT(DATEADD(month, -12, GETUTCDATE()), 'yyyyMMdd'))) AS ReturnsNet
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
  WHERE fs.IsVoided = 0 AND fs.DateKey >= CONVERT(int, FORMAT(DATEADD(month, -12, GETUTCDATE()), 'yyyyMMdd'))
  GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
  ORDER BY SalesNet DESC
`;

// Latest available snapshot date, not "today" — Snapshot_Fact_AR only has
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

const TOTALS_QUERY = `
  SELECT
    (SELECT ISNULL(SUM(NetAmount), 0) FROM fact.Fact_Sales
       WHERE IsVoided = 0 AND DateKey >= CONVERT(int, FORMAT(DATEADD(month, -12, GETUTCDATE()), 'yyyyMMdd'))) AS SalesNet12mo,
    (SELECT ISNULL(SUM(NetAmount), 0) FROM fact.Fact_Returns
       WHERE IsVoided = 0 AND DateKey >= CONVERT(int, FORMAT(DATEADD(month, -12, GETUTCDATE()), 'yyyyMMdd'))) AS ReturnsNet12mo,
    (SELECT ISNULL(SUM(AmountCollected), 0) FROM fact.Fact_Collections
       WHERE IsVoided = 0 AND DateKey >= CONVERT(int, FORMAT(DATEADD(month, -12, GETUTCDATE()), 'yyyyMMdd'))) AS Collected12mo
`;

const EXCHANGE_RATE_QUERY = `
  SELECT TOP 1
    c.CurrencyCode,
    f.RateSell AS ExchangeRate
  FROM fact.Fact_ExchangeRate f
  JOIN dim.Dim_Currency c ON c.CurrencyKey = f.CurrencyKey
  WHERE c.IsBaseCurrency = 0
    AND c.CurrencyCode NOT IN ('BS    ', 'VES   ')
    AND f.DateKey = (SELECT MAX(DateKey) FROM fact.Fact_ExchangeRate)
  ORDER BY f.DateKey DESC, c.CurrencyCode
`;

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasDwhAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  try {
    const pool = await getDwhPool();

    const [trend, topCustomers, topProducts, salesReps, latestSnapshot, totals, exchangeRates] = await Promise.all([
      pool.request().query(MONTHLY_TREND_QUERY),
      pool.request().query(TOP_CUSTOMERS_QUERY),
      pool.request().query(TOP_PRODUCTS_QUERY),
      pool.request().query(SALES_REP_QUERY),
      pool.request().query(LATEST_SNAPSHOT_QUERY),
      pool.request().query(TOTALS_QUERY),
      pool.request().query(EXCHANGE_RATE_QUERY),
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

    const totalsRow = totals.recordset[0] ?? { SalesNet12mo: 0, ReturnsNet12mo: 0, Collected12mo: 0 };
    const salesNet = Number(totalsRow.SalesNet12mo);
    const returnsNet = Number(totalsRow.ReturnsNet12mo);

    const usdRate = exchangeRates.recordset[0]?.ExchangeRate ?? null;

    return NextResponse.json({
      monthlyTrend: trend.recordset.map(r => ({
        yearMonth: r.YearMonth,
        salesNet: Number(r.SalesNet),
        returnsNet: Number(r.ReturnsNet),
      })),
      topCustomers: topCustomers.recordset.map(r => ({ name: r.Name, netRevenue: Number(r.NetRevenue) })),
      topProducts: topProducts.recordset.map(r => ({ name: r.Name, netRevenue: Number(r.NetRevenue) })),
      salesReps: salesReps.recordset.map(r => ({
        name: r.Name,
        salesNet: Number(r.SalesNet),
        returnsNet: Number(r.ReturnsNet),
      })),
      agingBuckets: agingBuckets.map(r => ({ bucket: r.AgingBucket, amount: Number(r.Amount) })),
      topDebtors: topDebtors.map(r => ({ name: r.Name, outstanding: Number(r.Outstanding) })),
      snapshotDateKey,
      usdRate,
      kpis: {
        salesNet12mo: salesNet,
        returnsNet12mo: returnsNet,
        returnRate: salesNet > 0 ? returnsNet / salesNet : null,
        collected12mo: Number(totalsRow.Collected12mo),
      },
    });
  } catch (error) {
    console.error('DWH dashboard error:', error);
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
