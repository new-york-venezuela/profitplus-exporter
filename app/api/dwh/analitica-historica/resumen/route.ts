import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { jsonWithCache, returnsDateColumn } from '@/app/api/dwh/lib/query-builder';
import { parseTrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { dualFromRow, returnRate, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import { parseHistParams } from '@/lib/analitica-historica/params';
import { histDualSum, histReturnsUsdJoin, histReturnsWhere, histSalesWhere, histUsdJoin } from '@/lib/analitica-historica/sql';
import type { HistResumenResponse } from '@/app/(app)/analitica-historica/types';

export const dynamic = 'force-dynamic';

// Reads only the legacy (pre-March-2026) tables; USD via fact.Fact_ExchangeRate_Legacy.
// Spec: docs/superpowers/specs/2026-11-16-historico-section-design.md.

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { dateRange, range, basis, searchParams } = parseHistParams(request);
  const bucket = parseTrendBucket(searchParams, dateRange);
  if (range.empty) {
    const empty: HistResumenResponse = { empty: true, kpis: null, trend: [], trendMode: bucket.mode };
    return jsonWithCache(empty);
  }

  const salesWhere = histSalesWhere(range, 'fsl');
  const returnsWhere = histReturnsWhere(range, basis, 'frl');

  const salesTotalsSql = `
    SELECT ${histDualSum('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
           ISNULL(SUM(fsl.QuantitySold), 0) AS UnitsSold
    FROM fact.Fact_Sales_Legacy fsl
    ${histUsdJoin('fsl')}
    WHERE 1 = 1 ${salesWhere}`;

  const returnsTotalsSql = `
    SELECT ${histDualSum('frl', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')},
           ISNULL(SUM(frl.QuantityReturned), 0) AS UnitsReturned
    FROM fact.Fact_Returns_Legacy frl
    ${histReturnsUsdJoin('frl')}
    WHERE 1 = 1 ${returnsWhere}`;

  const customersSql = `
    WITH s AS (
      SELECT fsl.CustomerLegacyKey, SUM(fsl.NetAmount) AS Amt
      FROM fact.Fact_Sales_Legacy fsl WHERE 1 = 1 ${salesWhere}
      GROUP BY fsl.CustomerLegacyKey
    ), r AS (
      SELECT frl.CustomerLegacyKey, SUM(frl.NetAmount) AS Amt
      FROM fact.Fact_Returns_Legacy frl WHERE 1 = 1 ${returnsWhere}
      GROUP BY frl.CustomerLegacyKey
    )
    SELECT (SELECT COUNT(*) FROM s) AS CustomersWithSales,
           (SELECT COUNT(*) FROM r) AS CustomersWithReturns,
           (SELECT COUNT(*) FROM s LEFT JOIN r ON r.CustomerLegacyKey = s.CustomerLegacyKey
             WHERE s.Amt - ISNULL(r.Amt, 0) > 0) AS CustomersNet`;

  // Sales and returns are aggregated per bucket separately and joined on the
  // bucket key (the bucket is a GROUP BY expression, which a correlated
  // subquery cannot reference). FULL JOIN: a bucket with returns but no sales
  // still appears.
  const trendSql = `
    WITH sales AS (
      SELECT ${bucket.keyExpr('d')} AS Bucket,
             ${histDualSum('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
      FROM fact.Fact_Sales_Legacy fsl
      ${histUsdJoin('fsl')}
      JOIN dim.Dim_Date d ON d.DateKey = fsl.DateKey
      WHERE 1 = 1 ${salesWhere}
      GROUP BY ${bucket.keyExpr('d')}
    ), rets AS (
      SELECT ${bucket.keyExpr('dr')} AS Bucket,
             ${histDualSum('frl', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
      FROM fact.Fact_Returns_Legacy frl
      ${histReturnsUsdJoin('frl')}
      JOIN dim.Dim_Date dr ON dr.DateKey = frl.${returnsDateColumn(basis)}
      WHERE 1 = 1 ${returnsWhere}
      GROUP BY ${bucket.keyExpr('dr')}
    )
    SELECT COALESCE(s.Bucket, r.Bucket) AS Bucket,
           ISNULL(s.SalesGrossBs, 0) AS SalesGrossBs, s.SalesGrossUsd AS SalesGrossUsd,
           ISNULL(r.ReturnsBs, 0) AS ReturnsBs, ISNULL(r.ReturnsUsd, 0) AS ReturnsUsd
    FROM sales s FULL OUTER JOIN rets r ON r.Bucket = s.Bucket
    ORDER BY COALESCE(s.Bucket, r.Bucket)`;

  try {
    const pool = await getDwhPool();
    const [salesT, returnsT, customers, trend] = await Promise.all([
      pool.request().query(salesTotalsSql),
      pool.request().query(returnsTotalsSql),
      pool.request().query(customersSql),
      pool.request().query(trendSql),
    ]);

    const s = salesT.recordset[0] ?? {};
    const r = returnsT.recordset[0] ?? {};
    const c = customers.recordset[0] ?? {};
    const salesGross = dualFromRow(s.SalesGrossBs, s.SalesGrossUsd);
    const returns = dualFromRow(r.ReturnsBs, r.ReturnsUsd);

    const body: HistResumenResponse = {
      empty: false,
      kpis: {
        salesGross,
        returns,
        salesNet: subtractDual(salesGross, returns),
        returnRate: returnRate(returns, salesGross),
        unitsSold: Number(s.UnitsSold ?? 0),
        unitsReturned: Number(r.UnitsReturned ?? 0),
        customersWithSales: Number(c.CustomersWithSales ?? 0),
        customersWithReturns: Number(c.CustomersWithReturns ?? 0),
        customersNet: Number(c.CustomersNet ?? 0),
      },
      trend: (trend.recordset as Record<string, unknown>[]).map(row => {
        const gross = dualFromRow(row.SalesGrossBs, row.SalesGrossUsd);
        const ret = dualFromRow(row.ReturnsBs, row.ReturnsUsd);
        return { bucket: String(row.Bucket), salesGross: gross, returnsNet: ret, salesNet: subtractDual(gross, ret) };
      }),
      trendMode: bucket.mode,
    };
    return jsonWithCache(body);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
