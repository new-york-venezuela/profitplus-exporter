import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimension, type Dimension } from '@/app/api/dwh/lib/query-builder';
import type { ClientesResponse, ClientesRow } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.

// Pareto (80/20) thresholds: customers are ranked by net sales descending,
// then bucketed by cumulative share of total net sales. A = top 20% of
// cumulative sales, B = next 30% (up to 50% cumulative), C = the rest.
const PARETO_THRESHOLDS = { a: 0.2, b: 0.5 };

function customerQuery(dimension: Dimension, salesDateWhere: string, returnsDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fs', 'fr2');
  return `
    SELECT
      ${spec.labelExpr} AS Name,
      SUM(fs.NetAmount) AS SalesNet,
      (SELECT ISNULL(SUM(fr2.NetAmount), 0)
         FROM fact.Fact_Returns fr2
         ${innerJoin}
         WHERE fr2.IsVoided = 0 ${returnsDateWhere} AND ${condition}
      ) AS ReturnsNet
    FROM fact.Fact_Sales fs
    ${spec.joinClause.replace(/\bf\b/g, 'fs')}
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY SalesNet DESC
  `;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasDwhAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const clienteDimensionParam = searchParams.get('clienteDimension');
  const clienteDimension: Dimension = isDimension(clienteDimensionParam) ? clienteDimensionParam : 'cliente_entidad';

  try {
    const pool = await getDwhPool();

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    // customerQuery's correlated returns subquery aliases Fact_Returns as
    // `fr2` (via spec.correlate), not `fr`, so it needs its own date-where
    // clause built against that alias.
    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr2');

    const [customers, usdRate] = await Promise.all([
      pool.request().query(customerQuery(clienteDimension, salesDateWhere, returnsDateWhere)),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

    // Query already orders by SalesNet DESC, which is the ranking Pareto
    // segmentation needs — walk it once, accumulating cumulative share of
    // total net sales to assign each customer's A/B/C segment.
    const totalSalesNet = customers.recordset.reduce((sum, r) => sum + Number(r.SalesNet), 0);

    let cumulativeSalesNet = 0;
    const rows: ClientesRow[] = customers.recordset.map(r => {
      const salesNet = Number(r.SalesNet);
      const returnsNet = Number(r.ReturnsNet);

      cumulativeSalesNet += salesNet;
      const cumulativeShare = totalSalesNet > 0 ? cumulativeSalesNet / totalSalesNet : 0;
      const pareto: ClientesRow['pareto'] =
        cumulativeShare <= PARETO_THRESHOLDS.a ? 'A' : cumulativeShare <= PARETO_THRESHOLDS.b ? 'B' : 'C';

      return {
        name: r.Name,
        salesNet,
        returnsNet,
        returnRate: salesNet > 0 ? returnsNet / salesNet : null,
        pareto,
      };
    });

    const response: ClientesResponse = { rows, paretoThresholds: PARETO_THRESHOLDS, usdRate };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
