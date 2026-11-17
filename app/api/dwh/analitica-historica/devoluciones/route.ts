import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { parseTrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { bucketLabels } from '@/app/(app)/analitica/lib/granularity';
import { dualFromRow, returnRate } from '@/app/(app)/analitica/lib/net-sales';
import { parseHistParams } from '@/lib/analitica-historica/params';
import { histReturnsWhere, histSalesWhere } from '@/lib/analitica-historica/sql';
import { histKpiQueries, mapHistKpis } from '@/lib/analitica-historica/kpis';
import { buildGroupedQuery, groupSpec } from '@/lib/analitica-historica/grouped-query';
import type { HistDevolucionesResponse, HistDevolucionRow } from '@/app/(app)/analitica-historica/types';

export const dynamic = 'force-dynamic';

const GROUPS = ['mes', 'cliente', 'sku'] as const;
type DevGroup = (typeof GROUPS)[number];
const TOP_ROWS = 100;

// Returns are windowed by `returnsBasis` (devolución date by default, the original
// factura's date for 'factura'); a return with no resolvable factura was loaded with
// OriginalInvoiceDateKey = DateKey, so it counts at its own date under either basis.
// The rate's denominator is the same group's ventas brutas in the same range.
export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { dateRange, range, basis, dimension, searchParams } = parseHistParams(request);
  const groupBy = (searchParams.get('groupBy') ?? 'cliente') as DevGroup;
  if (!(GROUPS as readonly string[]).includes(groupBy)) {
    return NextResponse.json({ error: 'Parámetro groupBy inválido' }, { status: 400 });
  }
  if (range.empty) {
    return jsonWithCache<HistDevolucionesResponse>({ empty: true, groupBy, kpis: null, rows: [] });
  }

  const bucket = parseTrendBucket(searchParams, dateRange);
  const { salesTotalsSql, returnsTotalsSql, customersSql } = histKpiQueries(range, basis);
  const groupedSql = buildGroupedQuery(
    groupSpec(groupBy, bucket, basis, dimension),
    histSalesWhere(range, 'fsl'),
    histReturnsWhere(range, basis, 'frl'),
    { top: groupBy === 'mes' ? null : TOP_ROWS, returnsOnly: true, orderBy: groupBy === 'mes' ? undefined : 'returns' },
  );

  try {
    const pool = await getDwhPool();
    const [salesT, returnsT, customers, grouped] = await Promise.all([
      pool.request().query(salesTotalsSql),
      pool.request().query(returnsTotalsSql),
      pool.request().query(customersSql),
      pool.request().query(groupedSql),
    ]);
    const records = grouped.recordset as Record<string, unknown>[];
    const monthLabels = groupBy === 'mes' ? bucketLabels(bucket.mode, records.map(r => String(r.GroupValue))) : [];
    const rows: HistDevolucionRow[] = records.map((r, i) => {
      const returns = dualFromRow(r.ReturnsBs, r.ReturnsUsd);
      const salesGross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
      return {
        label: groupBy === 'mes' ? monthLabels[i] : String(r.GroupLabel ?? r.GroupValue),
        value: String(r.GroupValue),
        returns,
        salesGross,
        returnRate: returnRate(returns, salesGross),
        unitsReturned: Number(r.ReturnsUnits ?? 0),
      };
    });
    return jsonWithCache<HistDevolucionesResponse>({
      empty: false,
      groupBy,
      kpis: mapHistKpis(salesT.recordset[0], returnsT.recordset[0], customers.recordset[0]),
      rows,
    });
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
