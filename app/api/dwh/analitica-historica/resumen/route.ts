import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { parseTrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { parseHistParams } from '@/lib/analitica-historica/params';
import { histKpiQueries, mapHistKpis } from '@/lib/analitica-historica/kpis';
import { histTrendQuery, mapHistTrend } from '@/lib/analitica-historica/trend';
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

  const { salesTotalsSql, returnsTotalsSql, customersSql } = histKpiQueries(range, basis);

  const trendSql = histTrendQuery(bucket, range, basis);

  try {
    const pool = await getDwhPool();
    const [salesT, returnsT, customers, trend] = await Promise.all([
      pool.request().query(salesTotalsSql),
      pool.request().query(returnsTotalsSql),
      pool.request().query(customersSql),
      pool.request().query(trendSql),
    ]);

    const body: HistResumenResponse = {
      empty: false,
      kpis: mapHistKpis(salesT.recordset[0], returnsT.recordset[0], customers.recordset[0]),
      trend: mapHistTrend(trend.recordset),
      trendMode: bucket.mode,
    };
    return jsonWithCache(body);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
