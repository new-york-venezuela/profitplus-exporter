import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import type {
  ProductosResponse, ProductosRow, GroupBy,
  ProfundidadLineaResponse, ProfundidadLineaRow,
  UnitsByLineaResponse, UnitsByLineaMonthRow,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// migrations/dwh/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.
//
// Drill-down is by product line name rather than by dim.Dim_Product surrogate
// key, matching the pattern used in the ventas route (drilling by the group
// label itself). LineName/SubLineName are 1:1 with their codes in the
// dimension table, so this is safe and avoids widening the shared
// ProductosRow contract with a drill key field.
//
// GrossProfitAmount is currently NULL for all Fact_Sales rows (CostSourceFlag
// = 'NO_COST_DATA', see migrations/dwh/0009_fact_sales.sql) — margin will
// read as "—" until a cost source is wired up. The query and mapping below
// are written to work correctly once that data is populated.

type ProductosGroupBy = 'linea' | 'sublinea' | 'sku';

const NO_LINEA = 'Sin línea';
const NO_SUBLINEA = 'Sin sublínea';

function isProductosGroupBy(value: string | null): value is ProductosGroupBy {
  return value === 'linea' || value === 'sublinea' || value === 'sku';
}

function lineaQuery(dateWhere: string, tiendaWhere: string): string {
  return `
    SELECT TOP 30
      ISNULL(p.LineName, '${NO_LINEA}') AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
    GROUP BY ISNULL(p.LineName, '${NO_LINEA}')
    ORDER BY SalesNet DESC
  `;
}

function sublineaQuery(dateWhere: string, tiendaWhere: string): string {
  return `
    SELECT TOP 30
      ISNULL(p.SubLineName, '${NO_SUBLINEA}') AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere} AND ISNULL(p.LineName, '${NO_LINEA}') = @linea
    GROUP BY ISNULL(p.SubLineName, '${NO_SUBLINEA}')
    ORDER BY SalesNet DESC
  `;
}

function skuQuery(dateWhere: string, tiendaWhere: string): string {
  return `
    SELECT TOP 50
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
      AND ISNULL(p.LineName, '${NO_LINEA}') = @linea
      AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublinea
    GROUP BY ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesNet DESC
  `;
}

function tiendasQuery(): string {
  return `
    SELECT c.CustomerKey, ISNULL(c.CustomerName, c.CustomerCode) AS CustomerName
    FROM dim.Dim_Customer c
    JOIN fact.Fact_Sales fs ON fs.CustomerKey = c.CustomerKey
    WHERE fs.IsVoided = 0
    GROUP BY c.CustomerKey, ISNULL(c.CustomerName, c.CustomerCode)
    ORDER BY CustomerName
  `;
}

// Top-15 SKUs by sales net, flat leaderboard independent of the línea/
// sublínea/sku breadcrumb above. Clientes = distinct legal entities
// (Dim_LegalEntity), tiendas = distinct Dim_Customer rows — the same
// entidad/tienda distinction query-builder.ts's cliente_entidad/cliente_tienda
// dimensions use elsewhere, inlined here since this query also needs
// per-product returns and a distinct-month count in the same pass.
function profundidadLineaQuery(dateWhere: string, returnsDateWhere: string, tiendaWhere: string, returnsTiendaWhere: string): string {
  return `
    SELECT TOP 15
      ISNULL(p.ProductName, p.ProductCode) AS Sku,
      COUNT(DISTINCT le.LegalEntityKey) AS ClientCount,
      COUNT(DISTINCT fs.CustomerKey) AS StoreCount,
      COUNT(DISTINCT d.YearMonth) AS MonthCount,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.QuantitySold) AS QuantitySold,
      ISNULL((SELECT SUM(fr.NetAmount) FROM fact.Fact_Returns fr
              WHERE fr.ProductKey = p.ProductKey AND fr.IsVoided = 0 ${returnsDateWhere} ${returnsTiendaWhere}), 0) AS ReturnsNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
    GROUP BY p.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesNet DESC
  `;
}

// Total distinct clients/stores active (any sale) in the same range — the
// denominator for each row's clientShare/storeShare above.
function activeTotalsQuery(dateWhere: string, tiendaWhere: string): string {
  return `
    SELECT
      COUNT(DISTINCT le.LegalEntityKey) AS TotalClients,
      COUNT(DISTINCT fs.CustomerKey) AS TotalStores
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
  `;
}

// Units sold by month, stacked by línea — top 7 líneas by total volume in
// range get their own series, the rest are bucketed into "Otras" so the
// stacked bar chart stays legible regardless of how many líneas exist.
function topLineasQuery(dateWhere: string, tiendaWhere: string): string {
  return `
    SELECT TOP 7 ISNULL(p.LineName, '${NO_LINEA}') AS LineName, SUM(fs.QuantitySold) AS QuantitySold
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
    GROUP BY ISNULL(p.LineName, '${NO_LINEA}')
    ORDER BY QuantitySold DESC
  `;
}

function unitsByLineaMonthQuery(dateWhere: string, tiendaWhere: string): string {
  return `
    SELECT
      d.YearMonth AS YearMonth,
      ISNULL(p.LineName, '${NO_LINEA}') AS LineName,
      SUM(fs.QuantitySold) AS QuantitySold,
      SUM(fs.NetAmount) AS SalesNet
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
    GROUP BY d.YearMonth, ISNULL(p.LineName, '${NO_LINEA}')
    ORDER BY d.YearMonth
  `;
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const idx = parseInt(m, 10) - 1;
  return MONTH_NAMES[idx] ? `${MONTH_NAMES[idx]} ${y.slice(2)}` : ym;
}

async function handleProfundidad(dateWhere: string, returnsDateWhere: string, tiendaWhere: string, tiendaKey: number | null, currency: string): Promise<NextResponse> {
  const pool = await getDwhPool();
  const returnsTiendaWhere = tiendaKey !== null ? 'AND fr.CustomerKey = @tiendaKey' : '';

  const rowsReq = pool.request();
  if (tiendaKey !== null) rowsReq.input('tiendaKey', tiendaKey);
  const rowsResult = await rowsReq.query(profundidadLineaQuery(dateWhere, returnsDateWhere, tiendaWhere, returnsTiendaWhere));

  const totalsReq = pool.request();
  if (tiendaKey !== null) totalsReq.input('tiendaKey', tiendaKey);
  const totalsResult = await totalsReq.query(activeTotalsQuery(dateWhere, tiendaWhere));
  const totalClients = Number(totalsResult.recordset[0]?.TotalClients ?? 0);
  const totalStores = Number(totalsResult.recordset[0]?.TotalStores ?? 0);

  const usdRate = currency === 'usd' ? await getUsdRate() : null;

  const rows: ProfundidadLineaRow[] = rowsResult.recordset.map(r => {
    const clientCount = Number(r.ClientCount);
    const storeCount = Number(r.StoreCount);
    const monthCount = Number(r.MonthCount) || 1;
    const salesNet = Number(r.SalesNet);
    const quantitySold = Number(r.QuantitySold);
    const returnsNet = Number(r.ReturnsNet);

    return {
      sku: String(r.Sku),
      clientCount,
      clientShare: totalClients > 0 ? clientCount / totalClients : null,
      storeCount,
      storeShare: totalStores > 0 ? storeCount / totalStores : null,
      avgMonthlyPrice: quantitySold > 0 ? salesNet / quantitySold : 0,
      avgMonthlyUnits: quantitySold / monthCount,
      returnRate: salesNet > 0 ? returnsNet / salesNet : null,
    };
  });

  const response: ProfundidadLineaResponse = { rows, usdRate };
  return jsonWithCache(response);
}

async function handlePorLineaMes(dateWhere: string, tiendaWhere: string, tiendaKey: number | null, currency: string): Promise<NextResponse> {
  const pool = await getDwhPool();

  const topReq = pool.request();
  if (tiendaKey !== null) topReq.input('tiendaKey', tiendaKey);
  const topResult = await topReq.query(topLineasQuery(dateWhere, tiendaWhere));
  const topLineas = new Set(topResult.recordset.map(r => String(r.LineName)));

  const monthReq = pool.request();
  if (tiendaKey !== null) monthReq.input('tiendaKey', tiendaKey);
  const monthResult = await monthReq.query(unitsByLineaMonthQuery(dateWhere, tiendaWhere));

  const byMonth = new Map<string, UnitsByLineaMonthRow>();
  const lineasSeen: string[] = [];
  let hasOtras = false;

  for (const r of monthResult.recordset) {
    const yearMonthValue = String(r.YearMonth);
    const rawLinea = String(r.LineName);
    const linea = topLineas.has(rawLinea) ? rawLinea : 'Otras';
    if (linea === 'Otras') hasOtras = true;
    else if (!lineasSeen.includes(linea)) lineasSeen.push(linea);

    let bucket = byMonth.get(yearMonthValue);
    if (!bucket) {
      bucket = { yearMonth: formatYearMonth(yearMonthValue), yearMonthValue, units: {}, salesNet: {}, totalSalesNet: 0 };
      byMonth.set(yearMonthValue, bucket);
    }
    bucket.units[linea] = (bucket.units[linea] ?? 0) + Number(r.QuantitySold);
    bucket.salesNet[linea] = (bucket.salesNet[linea] ?? 0) + Number(r.SalesNet);
    bucket.totalSalesNet += Number(r.SalesNet);
  }

  const rows = Array.from(byMonth.values()).sort((a, b) => a.yearMonthValue.localeCompare(b.yearMonthValue));
  const lineas = hasOtras ? [...lineasSeen, 'Otras'] : lineasSeen;

  const usdRate = currency === 'usd' ? await getUsdRate() : null;
  const response: UnitsByLineaResponse = { rows, lineas, usdRate };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const groupByParam = searchParams.get('groupBy');
  const lineaParam = searchParams.get('linea');
  const sublineaParam = searchParams.get('sublinea');
  const tiendaParam = searchParams.get('tienda');
  const tiendaKey = tiendaParam && /^\d+$/.test(tiendaParam) ? Number(tiendaParam) : null;

  if (searchParams.get('tiendas') === '1') {
    try {
      const pool = await getDwhPool();
      const result = await pool.request().query(tiendasQuery());
      return jsonWithCache({
        tiendas: result.recordset.map(r => ({ value: String(r.CustomerKey), label: r.CustomerName })),
      });
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  const section = searchParams.get('section');
  if (section === 'profundidad' || section === 'porLineaMes') {
    try {
      const dateWhere = buildDateWhereClause(dateRange, 'fs');
      const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
      const tiendaWhere = tiendaKey !== null ? 'AND fs.CustomerKey = @tiendaKey' : '';
      return section === 'profundidad'
        ? await handleProfundidad(dateWhere, returnsDateWhere, tiendaWhere, tiendaKey, currency)
        : await handlePorLineaMes(dateWhere, tiendaWhere, tiendaKey, currency);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  // Fall back to a shallower level if the params needed to scope a deeper
  // drill are missing (e.g. a stale/hand-built URL) rather than erroring.
  let groupBy: ProductosGroupBy = isProductosGroupBy(groupByParam) ? groupByParam : 'linea';
  if (groupBy === 'sublinea' && !lineaParam) groupBy = 'linea';
  if (groupBy === 'sku' && (!lineaParam || !sublineaParam)) groupBy = 'linea';

  try {
    const pool = await getDwhPool();

    const dateWhere = buildDateWhereClause(dateRange, 'fs');
    const tiendaWhere = tiendaKey !== null ? 'AND fs.CustomerKey = @tiendaKey' : '';

    let recordset: Record<string, unknown>[];
    const breadcrumb: ProductosResponse['breadcrumb'] = [{ label: 'Líneas', groupBy: 'linea' }];

    if (groupBy === 'sku') {
      const req = pool.request().input('linea', lineaParam).input('sublinea', sublineaParam);
      if (tiendaKey !== null) req.input('tiendaKey', tiendaKey);
      const result = await req.query(skuQuery(dateWhere, tiendaWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: lineaParam as string, groupBy: 'sublinea' });
      breadcrumb.push({ label: sublineaParam as string, groupBy: 'sku' });
    } else if (groupBy === 'sublinea') {
      const req = pool.request().input('linea', lineaParam);
      if (tiendaKey !== null) req.input('tiendaKey', tiendaKey);
      const result = await req.query(sublineaQuery(dateWhere, tiendaWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: lineaParam as string, groupBy: 'sublinea' });
    } else {
      const req = pool.request();
      if (tiendaKey !== null) req.input('tiendaKey', tiendaKey);
      const result = await req.query(lineaQuery(dateWhere, tiendaWhere));
      recordset = result.recordset;
    }

    const usdRate = currency === 'usd' ? await getUsdRate() : null;

    const totalSalesNet = recordset.reduce((sum, r) => sum + Number(r.SalesNet), 0);

    const rows: ProductosRow[] = recordset.map(r => {
      const salesNet = Number(r.SalesNet);
      const rotacion = Number(r.QuantitySold);
      const grossProfit = r.GrossProfitAmount === null || r.GrossProfitAmount === undefined
        ? null
        : Number(r.GrossProfitAmount);
      const margin = grossProfit !== null && salesNet !== 0 ? grossProfit / salesNet : null;
      const salesShare = totalSalesNet > 0 ? salesNet / totalSalesNet : null;
      const label = String(r.GroupLabel);

      return {
        sku: groupBy === 'sku' ? label : '',
        linea: groupBy === 'linea' ? label : (lineaParam ?? ''),
        sublinea: groupBy === 'sku' ? (sublineaParam ?? '') : groupBy === 'sublinea' ? label : '',
        rotacion,
        salesShare,
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

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
