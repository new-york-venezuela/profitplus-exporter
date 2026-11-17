import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { dualFromRow, returnRate, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import { classifyPareto } from '@/lib/productos/pareto';
import { parseHistParams } from '@/lib/analitica-historica/params';
import { escapeLike, histClienteKeySql, histDualSum, histReturnsUsdJoin, histReturnsWhere, histSalesWhere, histUsdJoin } from '@/lib/analitica-historica/sql';
import { HIST_END_KEY, HIST_START_KEY } from '@/lib/analitica-historica/window';
import type { HistClienteRow, HistClientesResponse } from '@/app/(app)/analitica-historica/types';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 5000;

// Client universe = every legacy client (casa matriz, or customer with `clienteDimension=tienda`)
// with a non-voided sale anywhere in the legacy window, plus any with returns in the selected range.
// A client with no sale in the range is listed as 'sin_compras'. With the default `entidad`
// dimension every store rolls up to its casa matriz (dim.Dim_LegalEntity_Legacy, the same rule as the
// main analytics); `stores` = stores of the client that bought in the range. Legacy customers carry
// no route, group, visit frequency or registration date, so none of those appear.
export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { range, basis, dimension, searchParams } = parseHistParams(request);
  if (range.empty) return jsonWithCache<HistClientesResponse>({ empty: true, rows: [] });

  const q = searchParams.get('q')?.trim() || null;
  const k = histClienteKeySql(dimension);
  const sql = `
    WITH a AS (
      SELECT ${k.key} AS EKey, MAX(${k.name}) AS Name, MAX(${k.code}) AS Code,
             MIN(fsl.DateKey) AS FirstKey, MAX(fsl.DateKey) AS LastKey
      FROM fact.Fact_Sales_Legacy fsl
      ${k.joins('fsl')}
      WHERE fsl.IsVoided = 0 AND fsl.DateKey >= ${HIST_START_KEY} AND fsl.DateKey <= ${HIST_END_KEY}
      GROUP BY ${k.key}
    ), s AS (
      SELECT ${k.key} AS EKey,
             ${histDualSum('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
             ISNULL(SUM(fsl.QuantitySold), 0) AS Units,
             COUNT(DISTINCT fsl.InvoiceNumber) AS Invoices,
             COUNT(DISTINCT fsl.CustomerLegacyKey) AS Stores
      FROM fact.Fact_Sales_Legacy fsl
      ${histUsdJoin('fsl')}
      ${k.joins('fsl')}
      WHERE 1 = 1 ${histSalesWhere(range, 'fsl')}
      GROUP BY ${k.key}
    ), r AS (
      SELECT ${k.key} AS EKey, MAX(${k.name}) AS Name, MAX(${k.code}) AS Code,
             ${histDualSum('frl', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
      FROM fact.Fact_Returns_Legacy frl
      ${histReturnsUsdJoin('frl')}
      ${k.joins('frl')}
      WHERE 1 = 1 ${histReturnsWhere(range, basis, 'frl')}
      GROUP BY ${k.key}
    ), k AS (
      SELECT EKey, Name, Code FROM a
      UNION
      SELECT EKey, Name, Code FROM r
    )
    SELECT TOP ${MAX_ROWS}
           k.EKey, k.Name, k.Code, a.FirstKey, a.LastKey,
           ISNULL(s.Invoices, 0) AS Invoices, ISNULL(s.Stores, 0) AS Stores,
           ISNULL(s.SalesGrossBs, 0) AS SalesGrossBs,
           CASE WHEN s.EKey IS NULL THEN 0 ELSE s.SalesGrossUsd END AS SalesGrossUsd,
           ISNULL(r.ReturnsBs, 0) AS ReturnsBs,
           CASE WHEN r.EKey IS NULL THEN 0 ELSE r.ReturnsUsd END AS ReturnsUsd,
           ISNULL(s.Units, 0) AS Units,
           CASE WHEN s.EKey IS NULL THEN 0 ELSE 1 END AS InRange
    FROM k
    LEFT JOIN a ON a.EKey = k.EKey
    LEFT JOIN s ON s.EKey = k.EKey
    LEFT JOIN r ON r.EKey = k.EKey
    WHERE 1 = 1
      ${q ? "AND (k.Code LIKE @q ESCAPE '\\' OR k.Name LIKE @q ESCAPE '\\')" : ''}
    ORDER BY ISNULL(s.SalesGrossBs, 0) - ISNULL(r.ReturnsBs, 0) DESC`;

  try {
    const pool = await getDwhPool();
    const req = pool.request();
    if (q) req.input('q', `%${escapeLike(q)}%`);
    const result = await req.query(sql);
    const records = result.recordset as Record<string, unknown>[];

    const partial = records.map(r => {
      const salesGross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
      const returns = dualFromRow(r.ReturnsBs, r.ReturnsUsd);
      return { r, salesGross, returns, salesNet: subtractDual(salesGross, returns) };
    });
    const totalNetBs = partial.reduce((sum, p) => sum + p.salesNet.bs, 0);
    // Pareto ranks by net Bs (independent of the currency toggle, so the class does not flip with it).
    const classes = classifyPareto(partial.map(p => ({ key: String(p.r.EKey), value: p.salesNet.bs })));

    const rows: HistClienteRow[] = partial.map(({ r, salesGross, returns, salesNet }) => ({
      key: String(r.EKey),
      code: String(r.Code ?? '').trim(),
      name: String(r.Name ?? '').trim() || String(r.Code ?? '').trim(),
      firstInvoiceKey: r.FirstKey === null || r.FirstKey === undefined ? null : Number(r.FirstKey),
      lastInvoiceKey: r.LastKey === null || r.LastKey === undefined ? null : Number(r.LastKey),
      invoices: Number(r.Invoices ?? 0),
      stores: Number(r.Stores ?? 0),
      salesGross,
      returns,
      salesNet,
      returnRate: returnRate(returns, salesGross),
      units: Number(r.Units ?? 0),
      sharePct: totalNetBs > 0 ? salesNet.bs / totalNetBs : null,
      pareto: classes.get(String(r.EKey)) ?? null,
      status: Number(r.InRange) === 1 ? 'activo' : 'sin_compras',
    }));
    return jsonWithCache<HistClientesResponse>({ empty: false, rows });
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
