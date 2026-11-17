import { returnsDateColumn, type ReturnsBasis } from '@/app/api/dwh/lib/query-builder';
import type { TrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { dualFromRow, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import type { MonthlyTrendRow } from '@/app/(app)/analitica/types';
import { histDualSum, histReturnsUsdJoin, histReturnsWhere, histSalesWhere, histUsdJoin } from './sql';
import type { HistRange } from './window';

// Gross / returns per trend bucket. Sales and returns are aggregated per bucket
// separately and joined on the bucket key (the bucket is a GROUP BY expression, which
// a correlated subquery cannot reference); FULL JOIN so a bucket with returns but no
// sales still appears. With `bySeller` the query needs a bound `@salesRepKey`
// (0 = documents with no seller).
export function histTrendQuery(bucket: TrendBucket, range: HistRange, basis: ReturnsBasis, bySeller: boolean = false): string {
  const salesSeller = bySeller ? 'AND ISNULL(fsl.SalesRepLegacyKey, 0) = @salesRepKey' : '';
  const returnsSeller = bySeller ? 'AND ISNULL(frl.SalesRepLegacyKey, 0) = @salesRepKey' : '';
  return `
    WITH sales AS (
      SELECT ${bucket.keyExpr('d')} AS Bucket,
             ${histDualSum('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
      FROM fact.Fact_Sales_Legacy fsl
      ${histUsdJoin('fsl')}
      JOIN dim.Dim_Date d ON d.DateKey = fsl.DateKey
      WHERE 1 = 1 ${histSalesWhere(range, 'fsl')} ${salesSeller}
      GROUP BY ${bucket.keyExpr('d')}
    ), rets AS (
      SELECT ${bucket.keyExpr('dr')} AS Bucket,
             ${histDualSum('frl', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
      FROM fact.Fact_Returns_Legacy frl
      ${histReturnsUsdJoin('frl')}
      JOIN dim.Dim_Date dr ON dr.DateKey = frl.${returnsDateColumn(basis)}
      WHERE 1 = 1 ${histReturnsWhere(range, basis, 'frl')} ${returnsSeller}
      GROUP BY ${bucket.keyExpr('dr')}
    )
    SELECT COALESCE(s.Bucket, r.Bucket) AS Bucket,
           ISNULL(s.SalesGrossBs, 0) AS SalesGrossBs,
           CASE WHEN s.Bucket IS NULL THEN 0 ELSE s.SalesGrossUsd END AS SalesGrossUsd,
           ISNULL(r.ReturnsBs, 0) AS ReturnsBs,
           CASE WHEN r.Bucket IS NULL THEN 0 ELSE r.ReturnsUsd END AS ReturnsUsd
    FROM sales s FULL OUTER JOIN rets r ON r.Bucket = s.Bucket
    ORDER BY COALESCE(s.Bucket, r.Bucket)`;
}

export function mapHistTrend(records: Record<string, unknown>[]): MonthlyTrendRow[] {
  return records.map(row => {
    const gross = dualFromRow(row.SalesGrossBs, row.SalesGrossUsd);
    const ret = dualFromRow(row.ReturnsBs, row.ReturnsUsd);
    return { bucket: String(row.Bucket), salesGross: gross, returnsNet: ret, salesNet: subtractDual(gross, ret) };
  });
}

