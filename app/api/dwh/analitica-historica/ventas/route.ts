import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { parseTrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { bucketLabels } from '@/app/(app)/analitica/lib/granularity';
import { dualFromRow, returnRate, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import { parseHistParams } from '@/lib/analitica-historica/params';
import { histReturnsWhere, histSalesWhere } from '@/lib/analitica-historica/sql';
import { buildGroupedQuery, groupSpec, isHistGroupBy } from '@/lib/analitica-historica/grouped-query';
import type { HistGroupResponse, HistGroupRow } from '@/app/(app)/analitica-historica/types';

export const dynamic = 'force-dynamic';

const TOP_ROWS = 200; // cliente / producto / vendedor lists are capped, ordered by net sales

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { dateRange, range, basis, dimension, searchParams } = parseHistParams(request);
  const groupBy = searchParams.get('groupBy') ?? 'mes';
  if (!isHistGroupBy(groupBy)) return NextResponse.json({ error: 'Parámetro groupBy inválido' }, { status: 400 });
  const parentValue = searchParams.get('parentValue');
  if (groupBy === 'producto' && !parentValue) {
    return NextResponse.json({ error: 'Parámetro parentValue requerido' }, { status: 400 });
  }
  if (range.empty) return jsonWithCache<HistGroupResponse>({ groupBy, rows: [] });

  const bucket = parseTrendBucket(searchParams, dateRange);
  const sql = buildGroupedQuery(
    groupSpec(groupBy, bucket, basis, dimension),
    histSalesWhere(range, 'fsl'),
    histReturnsWhere(range, basis, 'frl'),
    { top: groupBy === 'mes' ? null : TOP_ROWS },
  );

  try {
    const pool = await getDwhPool();
    const req = pool.request();
    if (groupBy === 'producto') req.input('parentValue', parentValue);
    const result = await req.query(sql);
    const records = result.recordset as Record<string, unknown>[];
    const monthLabels = groupBy === 'mes' ? bucketLabels(bucket.mode, records.map(r => String(r.GroupValue))) : [];

    const rows: HistGroupRow[] = records.map((r, i) => {
      const salesGross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
      const returns = dualFromRow(r.ReturnsBs, r.ReturnsUsd);
      return {
        label: groupBy === 'mes' ? monthLabels[i] : String(r.GroupLabel ?? r.GroupValue),
        value: String(r.GroupValue),
        salesGross,
        returns,
        salesNet: subtractDual(salesGross, returns),
        returnRate: returnRate(returns, salesGross),
        units: Number(r.Units ?? 0),
      };
    });
    return jsonWithCache<HistGroupResponse>({ groupBy, rows });
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
