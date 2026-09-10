import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause } from '@/app/api/dwh/lib/query-builder';
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

function clienteMatrixQuery(returnsDateWhere: string, salesDateWhere: string): string {
  return `
    SELECT TOP 50
      ISNULL(c.CustomerName, c.CustomerCode) AS GroupName,
      SUM(fr.NetAmount) AS ReturnsNet,
      (SELECT ISNULL(SUM(fs.NetAmount), 0)
         FROM fact.Fact_Sales fs
         WHERE fs.CustomerKey = fr.CustomerKey AND fs.IsVoided = 0 ${salesDateWhere}) AS SalesNet
    FROM fact.Fact_Returns fr
    JOIN dim.Dim_Customer c ON c.CustomerKey = fr.CustomerKey
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY fr.CustomerKey, ISNULL(c.CustomerName, c.CustomerCode)
    ORDER BY ReturnsNet DESC
  `;
}

function matrixQuery(groupBy: DevolucionesGroupBy, returnsDateWhere: string, salesDateWhere: string): string {
  switch (groupBy) {
    case 'producto':
      return productoMatrixQuery(returnsDateWhere, salesDateWhere);
    case 'cliente':
      return clienteMatrixQuery(returnsDateWhere, salesDateWhere);
    case 'salesrep':
    default:
      return salesRepMatrixQuery(returnsDateWhere, salesDateWhere);
  }
}

function toMatrixCell(groupBy: DevolucionesGroupBy, row: { GroupName: string; ReturnsNet: unknown; SalesNet: unknown }): DevolucionesMatrixCell {
  const returnsNet = Number(row.ReturnsNet);
  const salesNet = Number(row.SalesNet);
  const ratioDevolucion = salesNet > 0 ? returnsNet / salesNet : null;
  const placeholder = 'Todos';

  return {
    salesRep: groupBy === 'salesrep' ? row.GroupName : placeholder,
    producto: groupBy === 'producto' ? row.GroupName : placeholder,
    cliente: groupBy === 'cliente' ? row.GroupName : placeholder,
    ratioDevolucion,
    amountNet: returnsNet,
  };
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
  const groupBy: DevolucionesGroupBy = isDevolucionesGroupBy(groupByParam) ? groupByParam : 'salesrep';

  try {
    const pool = await getDwhPool();

    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');

    const [matrix, usdRate] = await Promise.all([
      pool.request().query(matrixQuery(groupBy, returnsDateWhere, salesDateWhere)),
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
