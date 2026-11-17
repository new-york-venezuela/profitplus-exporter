import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { parseTrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { dualFromRow, returnRate, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import { parseHistParams } from '@/lib/analitica-historica/params';
import { histReturnsWhere, histSalesWhere } from '@/lib/analitica-historica/sql';
import { histKpiQueries, mapHistKpis } from '@/lib/analitica-historica/kpis';
import { buildGroupedQuery, groupSpec } from '@/lib/analitica-historica/grouped-query';
import { histTrendQuery, mapHistTrend } from '@/lib/analitica-historica/trend';
import type { HistVendedorRow, HistVendedoresResponse } from '@/app/(app)/analitica-historica/types';

export const dynamic = 'force-dynamic';

// Sellers are attributed by the document's OWN seller (legacy has no "current
// customer seller"); documents with no seller group as "Sin vendedor" (key 0 in SQL,
// null in the response) so the rows always add up to the total.
export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { dateRange, range, basis, searchParams } = parseHistParams(request);
  const keyParam = searchParams.get('salesRepKey');
  if (keyParam !== null && !/^\d{1,9}$/.test(keyParam)) {
    return NextResponse.json({ error: 'Parámetro salesRepKey inválido' }, { status: 400 });
  }
  const salesRepKey = keyParam === null ? null : Number(keyParam);
  const bucket = parseTrendBucket(searchParams, dateRange);
  if (range.empty) {
    return jsonWithCache<HistVendedoresResponse>({ empty: true, rows: [], total: null, trend: [], trendMode: bucket.mode });
  }

  const salesWhere = histSalesWhere(range, 'fsl');
  const { salesTotalsSql, returnsTotalsSql, customersSql } = histKpiQueries(range, basis);
  const groupedSql = buildGroupedQuery(groupSpec('vendedor', bucket, basis), salesWhere, histReturnsWhere(range, basis, 'frl'), { top: null });
  const sellerCustomersSql = `
    SELECT CAST(ISNULL(fsl.SalesRepLegacyKey, 0) AS varchar(20)) AS GroupKey, COUNT(DISTINCT fsl.CustomerLegacyKey) AS Customers
    FROM fact.Fact_Sales_Legacy fsl
    WHERE 1 = 1 ${salesWhere}
    GROUP BY ISNULL(fsl.SalesRepLegacyKey, 0)`;

  try {
    const pool = await getDwhPool();
    const trendReq = pool.request();
    if (salesRepKey !== null) trendReq.input('salesRepKey', salesRepKey);
    const [salesT, returnsT, customers, grouped, perSeller, trend] = await Promise.all([
      pool.request().query(salesTotalsSql),
      pool.request().query(returnsTotalsSql),
      pool.request().query(customersSql),
      pool.request().query(groupedSql),
      pool.request().query(sellerCustomersSql),
      trendReq.query(histTrendQuery(bucket, range, basis, salesRepKey !== null)),
    ]);

    const customersBySeller = new Map<string, number>();
    for (const r of perSeller.recordset as Record<string, unknown>[]) customersBySeller.set(String(r.GroupKey), Number(r.Customers ?? 0));

    const rows: HistVendedorRow[] = (grouped.recordset as Record<string, unknown>[]).map(r => {
      const salesGross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
      const returns = dualFromRow(r.ReturnsBs, r.ReturnsUsd);
      const key = String(r.GroupValue);
      return {
        salesRepKey: key === '0' ? null : Number(key),
        label: key === '0' ? 'Sin vendedor' : String(r.GroupLabel ?? key),
        salesGross,
        returns,
        salesNet: subtractDual(salesGross, returns),
        returnRate: returnRate(returns, salesGross),
        units: Number(r.Units ?? 0),
        customersServed: customersBySeller.get(key) ?? 0,
      };
    });

    const k = mapHistKpis(salesT.recordset[0], returnsT.recordset[0], customers.recordset[0]);
    return jsonWithCache<HistVendedoresResponse>({
      empty: false,
      rows,
      total: {
        salesGross: k.salesGross, returns: k.returns, salesNet: k.salesNet, returnRate: k.returnRate,
        units: k.unitsSold, customersServed: k.customersWithSales,
      },
      trend: mapHistTrend(trend.recordset),
      trendMode: bucket.mode,
    });
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
