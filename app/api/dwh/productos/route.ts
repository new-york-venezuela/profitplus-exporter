import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause } from '@/app/api/dwh/lib/query-builder';
import type { ProductosResponse, ProductosRow, GroupBy } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.
//
// Drill-down is by product line name rather than by dim.Dim_Product surrogate
// key, matching the pattern used in the ventas route (drilling by the group
// label itself). LineName/SubLineName are 1:1 with their codes in the
// dimension table, so this is safe and avoids widening the shared
// ProductosRow contract with a drill key field.
//
// GrossProfitAmount is currently NULL for all Fact_Sales rows (CostSourceFlag
// = 'NO_COST_DATA', see dwh-migrations/0009_fact_sales.sql) — margin will
// read as "—" until a cost source is wired up. The query and mapping below
// are written to work correctly once that data is populated.

type ProductosGroupBy = 'linea' | 'sublinea' | 'sku';

const NO_LINEA = 'Sin línea';
const NO_SUBLINEA = 'Sin sublínea';

function isProductosGroupBy(value: string | null): value is ProductosGroupBy {
  return value === 'linea' || value === 'sublinea' || value === 'sku';
}

function lineaQuery(dateWhere: string): string {
  return `
    SELECT TOP 30
      ISNULL(p.LineName, '${NO_LINEA}') AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.LineName, '${NO_LINEA}')
    ORDER BY SalesNet DESC
  `;
}

function sublineaQuery(dateWhere: string): string {
  return `
    SELECT TOP 30
      ISNULL(p.SubLineName, '${NO_SUBLINEA}') AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} AND ISNULL(p.LineName, '${NO_LINEA}') = @linea
    GROUP BY ISNULL(p.SubLineName, '${NO_SUBLINEA}')
    ORDER BY SalesNet DESC
  `;
}

function skuQuery(dateWhere: string): string {
  return `
    SELECT TOP 50
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere}
      AND ISNULL(p.LineName, '${NO_LINEA}') = @linea
      AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublinea
    GROUP BY ISNULL(p.ProductName, p.ProductCode)
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
  const groupByParam = searchParams.get('groupBy');
  const lineaParam = searchParams.get('linea');
  const sublineaParam = searchParams.get('sublinea');

  // Fall back to a shallower level if the params needed to scope a deeper
  // drill are missing (e.g. a stale/hand-built URL) rather than erroring.
  let groupBy: ProductosGroupBy = isProductosGroupBy(groupByParam) ? groupByParam : 'linea';
  if (groupBy === 'sublinea' && !lineaParam) groupBy = 'linea';
  if (groupBy === 'sku' && (!lineaParam || !sublineaParam)) groupBy = 'linea';

  try {
    const pool = await getDwhPool();

    const dateWhere = buildDateWhereClause(dateRange, 'fs');

    let recordset: Record<string, unknown>[];
    const breadcrumb: ProductosResponse['breadcrumb'] = [{ label: 'Líneas', groupBy: 'linea' }];

    if (groupBy === 'sku') {
      const result = await pool
        .request()
        .input('linea', lineaParam)
        .input('sublinea', sublineaParam)
        .query(skuQuery(dateWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: lineaParam as string, groupBy: 'sublinea' });
      breadcrumb.push({ label: sublineaParam as string, groupBy: 'sku' });
    } else if (groupBy === 'sublinea') {
      const result = await pool.request().input('linea', lineaParam).query(sublineaQuery(dateWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: lineaParam as string, groupBy: 'sublinea' });
    } else {
      const result = await pool.request().query(lineaQuery(dateWhere));
      recordset = result.recordset;
    }

    const usdRate = currency === 'usd' ? await getUsdRate() : null;

    const rows: ProductosRow[] = recordset.map(r => {
      const salesNet = Number(r.SalesNet);
      const rotacion = Number(r.QuantitySold);
      const grossProfit = r.GrossProfitAmount === null || r.GrossProfitAmount === undefined
        ? null
        : Number(r.GrossProfitAmount);
      const margin = grossProfit !== null && salesNet !== 0 ? grossProfit / salesNet : null;
      const label = String(r.GroupLabel);

      return {
        sku: groupBy === 'sku' ? label : '',
        linea: groupBy === 'linea' ? label : (lineaParam ?? ''),
        sublinea: groupBy === 'sku' ? (sublineaParam ?? '') : groupBy === 'sublinea' ? label : '',
        rotacion,
        salesNet,
        margin,
      };
    });

    const response: ProductosResponse = {
      rows,
      groupBy: groupBy as GroupBy,
      breadcrumb,
      usdRate,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
