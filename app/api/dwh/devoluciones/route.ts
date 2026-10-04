import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { buildDateWhereClause, getDimensionSpec, isDimensionForFact, isClienteDimension, jsonWithCache, returnsUsdConversionJoin, dualAmountExpr, type Dimension } from '@/app/api/dwh/lib/query-builder';
import { pickTopSellerByRate, safeRatio } from '@/app/(app)/analitica/lib/devoluciones-kpis';
import type { DevolucionesResponse, DevolucionesMatrixCell, DevolucionesKpis, DevolucionesKpisResponse, GroupBy } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// This tab reports devoluciones as events of the period: windowed by the
// devolución's own date (Fact_Returns.DateKey), not the original factura's
// (that basis is used wherever returns are netted against sales, e.g. Ventas
// netas). USD converts at the original factura's rate. The tasa denominator
// is ventas brutas of the same group in the same range.
//
// All queries here read from the pre-aggregated dwh/dim/fact schema in
// DWH_AlimentosNY (see migrations/dwh/), not the raw Profit Plus ERP —
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
      ${dualAmountExpr('fr', 'NetAmount', 'ReturnsNetBs', 'ReturnsNetUsd')},
      (SELECT ISNULL(SUM(fs.NetAmount), 0)
         FROM fact.Fact_Sales fs
         WHERE fs.SalesRepKey = fr.SalesRepKey AND fs.IsVoided = 0 ${salesDateWhere}) AS SalesGrossBs
    FROM fact.Fact_Returns fr
    ${returnsUsdConversionJoin('fr')}
    LEFT JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fr.SalesRepKey
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY fr.SalesRepKey, ISNULL(r.SalesRepName, ISNULL(r.SalesRepCode, 'Sin vendedor'))
    ORDER BY ReturnsNetBs DESC
  `;
}

function productoMatrixQuery(returnsDateWhere: string, salesDateWhere: string): string {
  return `
    SELECT TOP 50
      ISNULL(p.ProductName, p.ProductCode) AS GroupName,
      ${dualAmountExpr('fr', 'NetAmount', 'ReturnsNetBs', 'ReturnsNetUsd')},
      (SELECT ISNULL(SUM(fs.NetAmount), 0)
         FROM fact.Fact_Sales fs
         WHERE fs.ProductKey = fr.ProductKey AND fs.IsVoided = 0 ${salesDateWhere}) AS SalesGrossBs
    FROM fact.Fact_Returns fr
    ${returnsUsdConversionJoin('fr')}
    JOIN dim.Dim_Product p ON p.ProductKey = fr.ProductKey
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY fr.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY ReturnsNetBs DESC
  `;
}

function clienteMatrixQuery(dimension: Dimension, returnsDateWhere: string, salesDateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('fr', 'fs2');
  return `
    SELECT TOP 50
      ${spec.valueExpr} AS GroupValue,
      ${spec.labelExpr} AS GroupName,
      ${dualAmountExpr('fr', 'NetAmount', 'ReturnsNetBs', 'ReturnsNetUsd')},
      (SELECT ISNULL(SUM(fs2.NetAmount), 0)
         FROM fact.Fact_Sales fs2
         ${innerJoin}
         WHERE fs2.IsVoided = 0 ${salesDateWhere} AND ${condition}
      ) AS SalesGrossBs
    FROM fact.Fact_Returns fr
    ${returnsUsdConversionJoin('fr')}
    ${spec.joinClause.replace(/\bf\b/g, 'fr')}
    WHERE fr.IsVoided = 0 ${returnsDateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY ReturnsNetBs DESC
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
  row: { GroupName: string; GroupValue?: unknown; ReturnsNetBs: unknown; ReturnsNetUsd: unknown; SalesGrossBs: unknown }
): DevolucionesMatrixCell {
  const returnsNetBs = Number(row.ReturnsNetBs);
  const returnsNetUsd = row.ReturnsNetUsd === null ? null : Number(row.ReturnsNetUsd);
  const salesGrossBs = Number(row.SalesGrossBs);
  const ratioDevolucion = salesGrossBs > 0 ? returnsNetBs / salesGrossBs : null;
  const placeholder = 'Todos';

  return {
    salesRep: groupBy === 'salesrep' ? row.GroupName : placeholder,
    producto: groupBy === 'producto' ? row.GroupName : placeholder,
    cliente: groupBy === 'cliente' ? row.GroupName : placeholder,
    clienteValue: groupBy === 'cliente' && row.GroupValue != null ? String(row.GroupValue) : null,
    ratioDevolucion,
    amountNet: { bs: returnsNetBs, usd: returnsNetUsd },
  };
}

// Headline KPI queries (section=kpis). Same basis as the matrices below:
// returns windowed by devolución date, USD at the original factura's rate.
const KPI_TOTALS_QUERY = (returnsWhere: string, salesWhere: string) => `
  SELECT
    (SELECT ISNULL(SUM(fr.NetAmount), 0) FROM fact.Fact_Returns fr WHERE fr.IsVoided = 0 ${returnsWhere}) AS ReturnsBs,
    (SELECT CASE WHEN COUNT(fr.NetAmount) = 0 THEN 0 ELSE SUM(fr.NetAmount / NULLIF(rfx.RateSell, 0)) END
       FROM fact.Fact_Returns fr ${returnsUsdConversionJoin('fr', 'rfx')} WHERE fr.IsVoided = 0 ${returnsWhere}) AS ReturnsUsd,
    (SELECT ISNULL(SUM(fr.QuantityReturned), 0) FROM fact.Fact_Returns fr WHERE fr.IsVoided = 0 ${returnsWhere}) AS UnitsReturned,
    (SELECT COUNT(DISTINCT fr.CreditNoteNumber) FROM fact.Fact_Returns fr WHERE fr.IsVoided = 0 ${returnsWhere}) AS CreditNotes,
    (SELECT ISNULL(SUM(fs.NetAmount), 0) FROM fact.Fact_Sales fs WHERE fs.IsVoided = 0 ${salesWhere}) AS SalesBs,
    (SELECT ISNULL(SUM(fs.QuantitySold), 0) FROM fact.Fact_Sales fs WHERE fs.IsVoided = 0 ${salesWhere}) AS UnitsSold
`;

const KPI_TOP_PRODUCT_QUERY = (returnsWhere: string) => `
  SELECT TOP 1 ISNULL(p.ProductName, p.ProductCode) AS Name,
    ${dualAmountExpr('fr', 'NetAmount', 'AmountBs', 'AmountUsd')}
  FROM fact.Fact_Returns fr
  ${returnsUsdConversionJoin('fr')}
  JOIN dim.Dim_Product p ON p.ProductKey = fr.ProductKey
  WHERE fr.IsVoided = 0 ${returnsWhere}
  GROUP BY fr.ProductKey, ISNULL(p.ProductName, p.ProductCode)
  ORDER BY AmountBs DESC
`;

function kpiTopEntidadQuery(returnsWhere: string): string {
  const spec = getDimensionSpec('cliente_entidad');
  return `
    SELECT TOP 1 ${spec.labelExpr} AS Name,
      ${dualAmountExpr('fr', 'NetAmount', 'AmountBs', 'AmountUsd')}
    FROM fact.Fact_Returns fr
    ${returnsUsdConversionJoin('fr')}
    ${spec.joinClause.replace(/\bf\b/g, 'fr')}
    WHERE fr.IsVoided = 0 ${returnsWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY AmountBs DESC
  `;
}

// Every seller with returns in the range plus their ventas brutas in the same
// range (sales aggregated in its own CTE, no correlated subquery).
const KPI_SELLERS_QUERY = (returnsWhere: string, salesWhere: string) => `
  WITH rets AS (
    SELECT fr.SalesRepKey, ${dualAmountExpr('fr', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
    FROM fact.Fact_Returns fr
    ${returnsUsdConversionJoin('fr')}
    WHERE fr.IsVoided = 0 ${returnsWhere}
    GROUP BY fr.SalesRepKey
  ),
  sales AS (
    SELECT fs.SalesRepKey, SUM(fs.NetAmount) AS SalesBs
    FROM fact.Fact_Sales fs
    WHERE fs.IsVoided = 0 ${salesWhere}
    GROUP BY fs.SalesRepKey
  )
  SELECT ISNULL(r.SalesRepName, ISNULL(r.SalesRepCode, 'Sin vendedor')) AS Name,
         rt.ReturnsBs, rt.ReturnsUsd, ISNULL(s.SalesBs, 0) AS SalesBs
  FROM rets rt
  LEFT JOIN sales s ON s.SalesRepKey = rt.SalesRepKey
  LEFT JOIN dim.Dim_SalesRep r ON r.SalesRepKey = rt.SalesRepKey
`;

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
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

    if (searchParams.get('section') === 'kpis') {
      const kpiSalesWhere = buildDateWhereClause(dateRange, 'fs');
      const [totals, topProduct, topEntidad, sellers] = await Promise.all([
        pool.request().query(KPI_TOTALS_QUERY(returnsDateWhere, kpiSalesWhere)),
        pool.request().query(KPI_TOP_PRODUCT_QUERY(returnsDateWhere)),
        pool.request().query(kpiTopEntidadQuery(returnsDateWhere)),
        pool.request().query(KPI_SELLERS_QUERY(returnsDateWhere, kpiSalesWhere)),
      ]);
      const t = totals.recordset[0];
      const returnsNet = { bs: Number(t.ReturnsBs), usd: t.ReturnsUsd === null ? null : Number(t.ReturnsUsd) };
      const creditNotes = Number(t.CreditNotes);
      const salesBs = Number(t.SalesBs);
      const sellerRows = sellers.recordset.map(r => ({
        name: String(r.Name).trim(),
        returnsBs: Number(r.ReturnsBs),
        returnsUsd: r.ReturnsUsd === null ? null : Number(r.ReturnsUsd),
        salesBs: Number(r.SalesBs),
      }));
      const top = pickTopSellerByRate(sellerRows, salesBs);
      const topSellerRow = top ? sellerRows.find(r => r.name === top.name) : undefined;
      const named = (rs: { recordset: Record<string, unknown>[] }) => {
        const row = rs.recordset[0];
        if (!row) return null;
        return {
          name: String(row.Name).trim(),
          amount: { bs: Number(row.AmountBs), usd: row.AmountUsd === null ? null : Number(row.AmountUsd) },
        };
      };
      const kpis: DevolucionesKpis = {
        returnsNet,
        returnRate: safeRatio(returnsNet.bs, salesBs),
        unitsReturned: Number(t.UnitsReturned),
        unitsReturnRate: safeRatio(Number(t.UnitsReturned), Number(t.UnitsSold)),
        creditNotes,
        avgCreditNote: creditNotes > 0
          ? { bs: returnsNet.bs / creditNotes, usd: returnsNet.usd === null ? null : returnsNet.usd / creditNotes }
          : null,
        topProduct: named(topProduct),
        topCustomer: named(topEntidad),
        topSellerByRate: top && topSellerRow
          ? { name: top.name, rate: top.rate, amount: { bs: topSellerRow.returnsBs, usd: topSellerRow.returnsUsd } }
          : null,
      };
      const kpiResponse: DevolucionesKpisResponse = { kpis };
      return jsonWithCache(kpiResponse);
    }

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
        SELECT TOP 15 ${breakdownSpec.valueExpr} AS GroupValue, ${breakdownSpec.labelExpr} AS GroupLabel, ${dualAmountExpr('fr', 'NetAmount', 'ReturnsNetBs', 'ReturnsNetUsd')}
        FROM fact.Fact_Returns fr
        ${returnsUsdConversionJoin('fr')}
        ${breakdownSpec.joinClause.replace(/\bf\b/g, 'fr')}
        ${parentSpec.joinClause.replace(/\bf\b/g, 'fr')}
        WHERE fr.IsVoided = 0 AND ${parentSpec.valueExpr.replace(/\bf\b/g, 'fr')} = @parentValue ${returnsDateWhere}
        GROUP BY ${breakdownSpec.groupByColumn}
        ORDER BY ReturnsNetBs DESC
      `);
      return jsonWithCache({
        breakdown: result.recordset.map(r => ({
          label: r.GroupLabel,
          value: String(r.GroupValue),
          returnsNetBs: Number(r.ReturnsNetBs),
          returnsNetUsd: r.ReturnsNetUsd === null ? null : Number(r.ReturnsNetUsd),
        })),
      });
    }

    const matrix = await pool.request().query(matrixQuery(groupBy, clienteDimension, returnsDateWhere, salesDateWhere));

    const rows: DevolucionesMatrixCell[] = matrix.recordset.map(r => toMatrixCell(groupBy, r));

    const response: DevolucionesResponse = {
      rows,
      groupBy: groupBy as GroupBy,
      breadcrumb: [{ label: GROUP_LABELS[groupBy], groupBy }],
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
