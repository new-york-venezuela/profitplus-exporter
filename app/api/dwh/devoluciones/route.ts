import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimensionForFact, isClienteDimension, type Dimension } from '@/app/api/dwh/lib/query-builder';
import type { DevolucionesResponse, DevolucionesMatrixCell, GroupBy } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// All queries here read from the pre-aggregated dwh/dim/fact schema in
// DWH_AlimentosNY (see dwh-migrations/), not the raw Profit Plus ERP —
// so no COLLATE/RTRIM gymnastics are needed here, that work already
// happened at load time.

type DevolucionesGroupBy = 'salesrep' | 'producto' | 'cliente';

const GROUP_LABELS: Record<DevolucionesGroupBy, string> = {
  salesrep: 'Vendedor',
  producto: 'Producto',
  cliente: 'Cliente',
};

function isDevolucionesGroupBy(value: string | null): value is DevolucionesGroupBy {
  return value === 'salesrep' || value === 'producto' || value === 'cliente';
}

// Capped at 50 rows — this is a table view, not a chart, but an unbounded
// matrix over the full customer/product base would be unusable. Sorted by
// returns volume so the rows that matter most surface first.
function salesRepMatrixQuery(returnsDateWhere: string, salesDateWhere: string): string {
  return `
    SELECT TOP 50
      ISNULL(r.SalesRepName, ISNULL(r.SalesRepCode, 'Sin vendedor')) AS GroupName,
      SUM(fr.NetAmount) AS ReturnsNet,
      (SELECT ISNULL(SUM(fs.NetAmount), 0)
         FROM fact.Fact_Sales fs
         WHERE fs.SalesRepKey = fr.SalesRepKey AND fs.IsVoided = 0 ${salesDateWhere}) AS SalesNet
    FROM fact.Fact_Returns fr
    LEFT JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fr.SalesRepKey
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY fr.SalesRepKey, ISNULL(r.SalesRepName, ISNULL(r.SalesRepCode, 'Sin vendedor'))
    ORDER BY ReturnsNet DESC
  `;
}

function productoMatrixQuery(returnsDateWhere: string, salesDateWhere: string): string {
  return `
    SELECT TOP 50
      ISNULL(p.ProductName, p.ProductCode) AS GroupName,
      SUM(fr.NetAmount) AS ReturnsNet,
      (SELECT ISNULL(SUM(fs.NetAmount), 0)
         FROM fact.Fact_Sales fs
         WHERE fs.ProductKey = fr.ProductKey AND fs.IsVoided = 0 ${salesDateWhere}) AS SalesNet
    FROM fact.Fact_Returns fr
    JOIN dim.Dim_Product p ON p.ProductKey = fr.ProductKey
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY fr.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY ReturnsNet DESC
  `;
}

function clienteMatrixQuery(dimension: Dimension, returnsDateWhere: string, salesDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fr', 'fs2');
  return `
    SELECT TOP 50
      ${spec.valueExpr} AS GroupValue,
      ${spec.labelExpr} AS GroupName,
      SUM(fr.NetAmount) AS ReturnsNet,
      (SELECT ISNULL(SUM(fs2.NetAmount), 0)
         FROM fact.Fact_Sales fs2
         ${innerJoin}
         WHERE fs2.IsVoided = 0 ${salesDateWhere} AND ${condition}
      ) AS SalesNet
    FROM fact.Fact_Returns fr
    ${spec.joinClause.replace(/\bf\b/g, 'fr')}
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY ReturnsNet DESC
  `;
}

function matrixQuery(groupBy: DevolucionesGroupBy, clienteDimension: Dimension, returnsDateWhere: string, salesDateWhere: string): string {
  switch (groupBy) {
    case 'producto':
      return productoMatrixQuery(returnsDateWhere, salesDateWhere);
    case 'cliente':
      return clienteMatrixQuery(clienteDimension, returnsDateWhere, salesDateWhere);
    case 'salesrep':
    default:
      return salesRepMatrixQuery(returnsDateWhere, salesDateWhere);
  }
}

function toMatrixCell(
  groupBy: DevolucionesGroupBy,
  row: { GroupName: string; GroupValue?: unknown; ReturnsNet: unknown; SalesNet: unknown }
): DevolucionesMatrixCell {
  const returnsNet = Number(row.ReturnsNet);
  const salesNet = Number(row.SalesNet);
  const ratioDevolucion = salesNet > 0 ? returnsNet / salesNet : null;
  const placeholder = 'Todos';

  return {
    salesRep: groupBy === 'salesrep' ? row.GroupName : placeholder,
    producto: groupBy === 'producto' ? row.GroupName : placeholder,
    cliente: groupBy === 'cliente' ? row.GroupName : placeholder,
    clienteValue: groupBy === 'cliente' && row.GroupValue != null ? String(row.GroupValue) : null,
    ratioDevolucion,
    amountNet: returnsNet,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const groupByParam = searchParams.get('groupBy');
  const groupBy: DevolucionesGroupBy = isDevolucionesGroupBy(groupByParam) ? groupByParam : 'salesrep';
  const clienteDimensionParam = searchParams.get('clienteDimension');
  const clienteDimension: Dimension = isClienteDimension(clienteDimensionParam) ? clienteDimensionParam : 'cliente_entidad';
  const breakdownByParam = searchParams.get('breakdownBy');
  const breakdownBy: Dimension | null = isDimensionForFact(breakdownByParam, 'returns') ? breakdownByParam : null;
  const parentValue = searchParams.get('parentValue');

  try {
    const pool = await getDwhPool();

    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
    // clienteMatrixQuery's correlated sales subquery aliases Fact_Sales as
    // `fs2` (via spec.correlate), not `fs` like salesRepMatrixQuery/
    // productoMatrixQuery, so it needs its own date-where clause built
    // against that alias.
    const salesDateWhere = buildDateWhereClause(dateRange, groupBy === 'cliente' ? 'fs2' : 'fs');

    // Row-expand fetch for the shared GroupedDrilldownTable (see tab-ventas.tsx
    // for the pattern this mirrors). breakdownBy is always producto/vendedor
    // (per spec §5 — never cliente_tienda), so it never collides aliases with
    // clienteDimension's own join (le/c vs p/r) — same reasoning as Ventas'
    // identical branch.
    if (breakdownBy && parentValue) {
      const breakdownSpec = getDimensionSpec(breakdownBy);
      const parentSpec = getDimensionSpec(clienteDimension);
      const req = pool.request();
      req.input('parentValue', parentValue);
      const result = await req.query(`
        SELECT TOP 15 ${breakdownSpec.valueExpr} AS GroupValue, ${breakdownSpec.labelExpr} AS GroupLabel, SUM(fr.NetAmount) AS ReturnsNet
        FROM fact.Fact_Returns fr
        ${breakdownSpec.joinClause.replace(/\bf\b/g, 'fr')}
        ${parentSpec.joinClause.replace(/\bf\b/g, 'fr')}
        WHERE fr.IsVoided = 0 AND ${parentSpec.valueExpr.replace(/\bf\b/g, 'fr')} = @parentValue ${returnsDateWhere}
        GROUP BY ${breakdownSpec.groupByColumn}
        ORDER BY ReturnsNet DESC
      `);
      return NextResponse.json({
        breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), returnsNet: Number(r.ReturnsNet) })),
      });
    }

    const [matrix, usdRate] = await Promise.all([
      pool.request().query(matrixQuery(groupBy, clienteDimension, returnsDateWhere, salesDateWhere)),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

    const rows: DevolucionesMatrixCell[] = matrix.recordset.map(r => toMatrixCell(groupBy, r));

    const response: DevolucionesResponse = {
      rows,
      groupBy: groupBy as GroupBy,
      breadcrumb: [{ label: GROUP_LABELS[groupBy], groupBy }],
      usdRate,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
