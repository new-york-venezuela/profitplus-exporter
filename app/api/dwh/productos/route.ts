import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { parseTrendBucket, type TrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { buildDateWhereClause, buildReturnsDateWhereClause, jsonWithCache, usdConversionJoin, returnsAmountSubqueries, returnsUsdConversionJoin, dualAmountExpr } from '@/app/api/dwh/lib/query-builder';
import { dualFromRow, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import type { DualAmount } from '@/app/(app)/analitica/types';
import { classifyTier, DEFAULT_TIER_THRESHOLDS } from '@/lib/dwh/depth-tier';
import { buildGroupShareMatrix } from '@/lib/productos/group-share';
import { CLIENTES_GROUPS_QUERY } from '@/lib/clientes/scope';
import { bindItemFilter, itemFilterSql, parseItemFilter, returnsItemFilterSql, type ItemFilter } from '@/lib/productos/item-filter';
import { classifyPareto } from '@/lib/productos/pareto';
import { fetchCategorias, fetchGroupShare, parseCategoria } from '@/lib/productos/queries';
import { bindTienda, parseTienda, tiendaKeysSql, type TiendaFilter } from '@/lib/productos/tienda-filter';
import type {
  ProductosResponse, ProductosRow, GroupBy,
  ProfundidadLineaResponse, ProfundidadLineaRow,
  UnitsByLineaResponse, UnitsByLineaMonthRow,
  ProductosGroupShareResponse, ProductosCategoriasResponse,
  CatalogoRow, CatalogoResponse, ProductosFiltrosResponse, Currency,
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

// Each drill level also carries that group's devoluciones attributed by the
// devolución date (returnsDateWhere is built on DateKey; this tab ignores
// returnsBasis), USD at the original factura's rate.
function lineaQuery(dateWhere: string, tiendaWhere: string, returnsDateWhere: string, returnsTiendaWhere: string): string {
  return `
    SELECT TOP 30
      ISNULL(p.LineName, '${NO_LINEA}') AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      ${returnsAmountSubqueries({
        alias: 'fr',
        fxAlias: 'frfx',
        extraJoins: 'JOIN dim.Dim_Product pr ON pr.ProductKey = fr.ProductKey',
        where: `AND ISNULL(pr.LineName, '${NO_LINEA}') = ISNULL(p.LineName, '${NO_LINEA}') ${returnsDateWhere} ${returnsTiendaWhere}`,
        bsAlias: 'ReturnsBs',
        usdAlias: 'ReturnsUsd',
      })},
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
    GROUP BY ISNULL(p.LineName, '${NO_LINEA}')
    ORDER BY SalesGrossBs DESC
  `;
}

function sublineaQuery(dateWhere: string, tiendaWhere: string, returnsDateWhere: string, returnsTiendaWhere: string): string {
  return `
    SELECT TOP 30
      ISNULL(p.SubLineName, '${NO_SUBLINEA}') AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      ${returnsAmountSubqueries({
        alias: 'fr',
        fxAlias: 'frfx',
        extraJoins: 'JOIN dim.Dim_Product pr ON pr.ProductKey = fr.ProductKey',
        where: `AND ISNULL(pr.LineName, '${NO_LINEA}') = @linea AND ISNULL(pr.SubLineName, '${NO_SUBLINEA}') = ISNULL(p.SubLineName, '${NO_SUBLINEA}') ${returnsDateWhere} ${returnsTiendaWhere}`,
        bsAlias: 'ReturnsBs',
        usdAlias: 'ReturnsUsd',
      })},
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere} AND ISNULL(p.LineName, '${NO_LINEA}') = @linea
    GROUP BY ISNULL(p.SubLineName, '${NO_SUBLINEA}')
    ORDER BY SalesGrossBs DESC
  `;
}

function skuQuery(dateWhere: string, tiendaWhere: string, returnsDateWhere: string, returnsTiendaWhere: string): string {
  return `
    SELECT TOP 50
      ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
      SUM(fs.QuantitySold) AS QuantitySold,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      ${returnsAmountSubqueries({
        alias: 'fr',
        fxAlias: 'frfx',
        extraJoins: 'JOIN dim.Dim_Product pr ON pr.ProductKey = fr.ProductKey',
        where: `AND ISNULL(pr.LineName, '${NO_LINEA}') = @linea AND ISNULL(pr.SubLineName, '${NO_SUBLINEA}') = @sublinea AND ISNULL(pr.ProductName, pr.ProductCode) = ISNULL(p.ProductName, p.ProductCode) ${returnsDateWhere} ${returnsTiendaWhere}`,
        bsAlias: 'ReturnsBs',
        usdAlias: 'ReturnsUsd',
      })},
      SUM(fs.GrossProfitAmount) AS GrossProfitAmount
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
      AND ISNULL(p.LineName, '${NO_LINEA}') = @linea
      AND ISNULL(p.SubLineName, '${NO_SUBLINEA}') = @sublinea
    GROUP BY ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesGrossBs DESC
  `;
}

// A tienda is a customer (CustomerCode), not a Dim_Customer row: the dimension is SCD2, so one
// customer can own several CustomerKeys (one per tracked change). The picker lists each code once
// (named by its CURRENT row) and the filter matches every version of that code.
// Casas matriz: legal entities with more than one store and at least one non-voided sale.
function entidadesQuery(): string {
  return `
    SELECT le.LegalEntityKey, le.LegalEntityName, le.StoreCount
    FROM dim.Dim_LegalEntity le
    WHERE le.StoreCount > 1
      AND EXISTS (
        SELECT 1 FROM dim.Dim_Customer cur
        JOIN dim.Dim_Customer c ON c.CustomerCode = cur.CustomerCode
        JOIN fact.Fact_Sales fs ON fs.CustomerKey = c.CustomerKey
        WHERE cur.IsCurrent = 1 AND cur.LegalEntityKey = le.LegalEntityKey AND fs.IsVoided = 0
      )
    ORDER BY le.LegalEntityName
  `;
}

function tiendasQuery(): string {
  return `
    SELECT cur.CustomerCode, ISNULL(cur.CustomerName, cur.CustomerCode) AS CustomerName
    FROM dim.Dim_Customer cur
    WHERE cur.IsCurrent = 1
      AND EXISTS (
        SELECT 1 FROM dim.Dim_Customer c
        JOIN fact.Fact_Sales fs ON fs.CustomerKey = c.CustomerKey
        WHERE c.CustomerCode = cur.CustomerCode AND fs.IsVoided = 0
      )
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
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      SUM(fs.QuantitySold) AS QuantitySold,
      ISNULL((SELECT SUM(fr.NetAmount) FROM fact.Fact_Returns fr
              WHERE fr.ProductKey = p.ProductKey AND fr.IsVoided = 0 ${returnsDateWhere} ${returnsTiendaWhere}), 0) AS ReturnsNetBs
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
    GROUP BY p.ProductKey, ISNULL(p.ProductName, p.ProductCode)
    ORDER BY SalesGrossBs DESC
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

// Units sold per trend bucket (day/week/month), stacked by línea — top 7 líneas by total volume in
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

function unitsByLineaMonthQuery(dateWhere: string, tiendaWhere: string, bucket: TrendBucket): string {
  return `
    SELECT
      ${bucket.keyExpr('d')} AS Bucket,
      ISNULL(p.LineName, '${NO_LINEA}') AS LineName,
      SUM(fs.QuantitySold) AS QuantitySold,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${tiendaWhere}
    GROUP BY ${bucket.keyExpr('d')}, ISNULL(p.LineName, '${NO_LINEA}')
    ORDER BY ${bucket.keyExpr('d')}
  `;
}

function bindFilters(req: { input(name: string, value: unknown): unknown }, tienda: TiendaFilter | null, categoria: string | null): void {
  bindTienda(req, tienda);
  if (categoria !== null) req.input('categoria', categoria);
}

async function handleProfundidad(
  dateWhere: string, returnsDateWhere: string, salesFilterWhere: string, tiendaOnlyWhere: string,
  tienda: TiendaFilter | null, categoria: string | null,
): Promise<NextResponse> {
  const pool = await getDwhPool();
  const returnsTiendaWhere = tienda !== null ? `AND fr.CustomerKey IN (${tiendaKeysSql(tienda)})` : '';

  const rowsReq = pool.request();
  bindFilters(rowsReq, tienda, categoria);
  const rowsResult = await rowsReq.query(profundidadLineaQuery(dateWhere, returnsDateWhere, salesFilterWhere, returnsTiendaWhere));

  // Denominator: all clients/stores active in range (category NOT applied).
  const totalsReq = pool.request();
  bindFilters(totalsReq, tienda, null);
  const totalsResult = await totalsReq.query(activeTotalsQuery(dateWhere, tiendaOnlyWhere));
  const totalClients = Number(totalsResult.recordset[0]?.TotalClients ?? 0);
  const totalStores = Number(totalsResult.recordset[0]?.TotalStores ?? 0);

  const rows: ProfundidadLineaRow[] = rowsResult.recordset.map(r => {
    const clientCount = Number(r.ClientCount);
    const storeCount = Number(r.StoreCount);
    const monthCount = Number(r.MonthCount) || 1;
    const salesGrossBs = Number(r.SalesGrossBs);
    const salesGrossUsd = r.SalesGrossUsd === null ? null : Number(r.SalesGrossUsd);
    const quantitySold = Number(r.QuantitySold);
    const returnsNetBs = Number(r.ReturnsNetBs);
    const clientShare = totalClients > 0 ? clientCount / totalClients : null;

    return {
      sku: String(r.Sku),
      clientCount,
      clientShare,
      storeCount,
      storeShare: totalStores > 0 ? storeCount / totalStores : null,
      avgMonthlyPrice: quantitySold > 0
        ? { bs: salesGrossBs / quantitySold, usd: salesGrossUsd === null ? null : salesGrossUsd / quantitySold }
        : { bs: 0, usd: 0 },
      avgMonthlyUnits: quantitySold / monthCount,
      returnRate: salesGrossBs > 0 ? returnsNetBs / salesGrossBs : null,
      tier: classifyTier(clientShare, salesGrossBs > 0, DEFAULT_TIER_THRESHOLDS),
    };
  });

  const response: ProfundidadLineaResponse = { rows };
  return jsonWithCache(response);
}

async function handlePorLineaMes(
  dateWhere: string, salesFilterWhere: string, tienda: TiendaFilter | null, categoria: string | null, trend: TrendBucket,
): Promise<NextResponse> {
  const pool = await getDwhPool();

  const topReq = pool.request();
  bindFilters(topReq, tienda, categoria);
  const topResult = await topReq.query(topLineasQuery(dateWhere, salesFilterWhere));
  const topLineas = new Set(topResult.recordset.map(r => String(r.LineName)));

  const monthReq = pool.request();
  bindFilters(monthReq, tienda, categoria);
  const monthResult = await monthReq.query(unitsByLineaMonthQuery(dateWhere, salesFilterWhere, trend));

  const byMonth = new Map<string, UnitsByLineaMonthRow>();
  // Tracks whether ANY row contributing to a given salesGross[linea]/totalSalesGross
  // accumulator had a resolvable USD rate — null propagates to the accumulated
  // total only when EVERY contributing row lacked a rate, not when any single
  // one did (see the SQL-side CASE WHEN COUNT(...) = 0 rule this mirrors).
  const sawUsd = new Map<string, Set<string>>(); // bucketKey -> set of lineas with at least one non-null usd row
  const sawUsdTotal = new Set<string>(); // bucketKey with at least one non-null usd row overall
  const lineasSeen: string[] = [];
  let hasOtras = false;

  for (const r of monthResult.recordset) {
    const bucketKey = String(r.Bucket); // bucket key (YYYY-MM-DD | YYYY-Www | YYYY-MM | 'range')
    const rawLinea = String(r.LineName);
    const linea = topLineas.has(rawLinea) ? rawLinea : 'Otras';
    if (linea === 'Otras') hasOtras = true;
    else if (!lineasSeen.includes(linea)) lineasSeen.push(linea);

    let bucket = byMonth.get(bucketKey);
    if (!bucket) {
      bucket = { bucket: bucketKey, units: {}, salesGross: {}, totalSalesGross: { bs: 0, usd: 0 } };
      byMonth.set(bucketKey, bucket);
    }
    let lineaUsdSeen = sawUsd.get(bucketKey);
    if (!lineaUsdSeen) {
      lineaUsdSeen = new Set<string>();
      sawUsd.set(bucketKey, lineaUsdSeen);
    }

    const rowSalesGrossBs = Number(r.SalesGrossBs);
    const rowSalesGrossUsd = r.SalesGrossUsd === null ? null : Number(r.SalesGrossUsd);
    if (rowSalesGrossUsd !== null) {
      lineaUsdSeen.add(linea);
      sawUsdTotal.add(bucketKey);
    }
    bucket.units[linea] = (bucket.units[linea] ?? 0) + Number(r.QuantitySold);
    const existing = bucket.salesGross[linea] ?? { bs: 0, usd: 0 };
    bucket.salesGross[linea] = {
      bs: existing.bs + rowSalesGrossBs,
      usd: (existing.usd ?? 0) + (rowSalesGrossUsd ?? 0),
    };
    bucket.totalSalesGross = {
      bs: bucket.totalSalesGross.bs + rowSalesGrossBs,
      usd: (bucket.totalSalesGross.usd ?? 0) + (rowSalesGrossUsd ?? 0),
    };
  }

  // Second pass: null out usd for any linea/total accumulator that never saw
  // a single resolvable rate (the "all contributors lacked a rate" case).
  for (const [bucketKey, bucket] of byMonth) {
    const lineaUsdSeen = sawUsd.get(bucketKey) ?? new Set<string>();
    for (const linea of Object.keys(bucket.salesGross)) {
      if (!lineaUsdSeen.has(linea)) {
        bucket.salesGross[linea] = { ...bucket.salesGross[linea], usd: null };
      }
    }
    if (!sawUsdTotal.has(bucketKey)) {
      bucket.totalSalesGross = { ...bucket.totalSalesGross, usd: null };
    }
  }

  const rows = Array.from(byMonth.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
  const lineas = hasOtras ? [...lineasSeen, 'Otras'] : lineasSeen;

  const response: UnitsByLineaResponse = { rows, lineas, trendMode: trend.mode };
  return jsonWithCache(response);
}

async function handleGrupos(
  dateRange: string, level: ProductosGroupBy, filter: ItemFilter, tienda: TiendaFilter | null, categoria: string | null,
): Promise<NextResponse> {
  const pool = await getDwhPool();
  const raw = await fetchGroupShare(pool, {
    dateWhere: buildDateWhereClause(dateRange, 'fs'), level, filter, tienda, categoria,
  });
  const response: ProductosGroupShareResponse = { ...buildGroupShareMatrix(raw), level };
  return jsonWithCache(response);
}

// Master table: one grouped sales query and one grouped returns query per nivel, merged by item
// key here (no per-row correlated subqueries, no TOP caps). Customers resolve through their CURRENT
// Dim_Customer row so SCD versions of one store count once; LEFT JOINs keep sales of customers with
// no current row or no legal entity.
function catalogoKeys(nivel: ProductosGroupBy, p: string) {
  const line = `ISNULL(${p}.LineName, '${NO_LINEA}')`;
  const sub = `ISNULL(${p}.SubLineName, '${NO_SUBLINEA}')`;
  if (nivel === 'linea') return { group: line, key: line, label: line, code: 'NULL', linea: line, sublinea: "''" };
  if (nivel === 'sublinea') return { group: `${line}, ${sub}`, key: `${line} + '|' + ${sub}`, label: sub, code: 'NULL', linea: line, sublinea: sub };
  const code = `RTRIM(${p}.ProductCode)`;
  return {
    group: code, key: code, label: `MAX(ISNULL(${p}.ProductName, ${code}))`, code,
    linea: `MAX(${line})`, sublinea: `MAX(${sub})`,
  };
}

function catalogoSalesQuery(nivel: ProductosGroupBy, where: string): string {
  const k = catalogoKeys(nivel, 'p');
  return `
    SELECT
      ${k.key} AS [Key], ${k.label} AS Label, ${k.code} AS Code,
      ${k.linea} AS Linea, ${k.sublinea} AS Sublinea,
      SUM(fs.QuantitySold) AS Units,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
      COUNT(DISTINCT d.YearMonth) AS MonthCount,
      COUNT(DISTINCT le.LegalEntityKey) AS ClientCount,
      COUNT(DISTINCT c.CustomerCode) AS PosCount
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    LEFT JOIN dim.Dim_Customer cur ON cur.CustomerCode = c.CustomerCode AND cur.IsCurrent = 1
    LEFT JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = cur.LegalEntityKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${where}
    GROUP BY ${k.group}
  `;
}

function catalogoReturnsQuery(nivel: ProductosGroupBy, where: string): string {
  const k = catalogoKeys(nivel, 'pr');
  return `
    SELECT
      ${k.key} AS [Key],
      ${dualAmountExpr('fr', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
    FROM fact.Fact_Returns fr
    ${returnsUsdConversionJoin('fr', 'fx')}
    JOIN dim.Dim_Product pr ON pr.ProductKey = fr.ProductKey
    WHERE fr.IsVoided = 0 ${where}
    GROUP BY ${k.group}
  `;
}

async function handleCatalogo(
  dateRange: string, nivel: ProductosGroupBy, filter: ItemFilter, tienda: TiendaFilter | null,
  categoria: string | null, currency: Currency,
): Promise<NextResponse> {
  const pool = await getDwhPool();
  const tiendaSales = tienda !== null ? `AND fs.CustomerKey IN (${tiendaKeysSql(tienda)})` : '';
  const tiendaReturns = tienda !== null ? `AND fr.CustomerKey IN (${tiendaKeysSql(tienda)})` : '';
  const salesWhere = `${buildDateWhereClause(dateRange, 'fs')} ${tiendaSales} ${categoria !== null ? 'AND p.CategoryName = @categoria' : ''} ${itemFilterSql(filter)}`;
  const returnsWhere = `${buildReturnsDateWhereClause(dateRange, 'fr')} ${tiendaReturns} ${categoria !== null ? 'AND pr.CategoryName = @categoria' : ''} ${returnsItemFilterSql(filter)}`;

  const salesReq = pool.request();
  bindFilters(salesReq, tienda, categoria);
  bindItemFilter(salesReq, filter);
  const returnsReq = pool.request();
  bindFilters(returnsReq, tienda, categoria);
  bindItemFilter(returnsReq, filter);
  const [sales, returns] = await Promise.all([
    salesReq.query(catalogoSalesQuery(nivel, salesWhere)),
    returnsReq.query(catalogoReturnsQuery(nivel, returnsWhere)),
  ]);

  const returnsByKey = new Map<string, DualAmount>();
  for (const r of returns.recordset) returnsByKey.set(String(r.Key).trim(), dualFromRow(r.ReturnsBs, r.ReturnsUsd));

  const base = sales.recordset.map(r => {
    const key = String(r.Key).trim();
    const gross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
    const ret = returnsByKey.get(key) ?? { bs: 0, usd: 0 };
    const units = Number(r.Units ?? 0);
    const monthCount = Number(r.MonthCount ?? 0);
    return {
      key,
      label: String(r.Label ?? key).trim(),
      code: nivel === 'sku' ? key : null,
      linea: String(r.Linea ?? '').trim(),
      sublinea: String(r.Sublinea ?? '').trim(),
      salesGross: gross,
      returns: ret,
      salesNet: subtractDual(gross, ret),
      units,
      monthCount,
      avgUnitsPerMonth: monthCount > 0 ? units / monthCount : 0,
      avgPrice: units > 0
        ? { bs: gross.bs / units, usd: gross.usd === null ? null : gross.usd / units }
        : { bs: 0, usd: gross.usd === null ? null : 0 },
      returnRate: gross.bs > 0 ? ret.bs / gross.bs : null,
      clientCount: Number(r.ClientCount ?? 0),
      posCount: Number(r.PosCount ?? 0),
    };
  });

  const valueOf = (net: DualAmount): number | null => (currency === 'usd' ? net.usd : net.bs);
  const pareto = classifyPareto(base.map(b => ({ key: b.key, value: valueOf(b.salesNet) })));
  const total = base.reduce((sum, b) => sum + (valueOf(b.salesNet) ?? 0), 0);

  const rows: CatalogoRow[] = base
    .map(b => {
      const v = valueOf(b.salesNet);
      return { ...b, sharePct: v !== null && total > 0 ? v / total : null, pareto: pareto.get(b.key) ?? null };
    })
    .sort((a, b) => {
      const av = valueOf(a.salesNet); const bv = valueOf(b.salesNet);
      if (av === null && bv === null) return a.key.localeCompare(b.key);
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av || a.key.localeCompare(b.key);
    });

  const response: CatalogoResponse = { rows, nivel };
  return jsonWithCache(response);
}

async function handleFiltros(): Promise<NextResponse> {
  const pool = await getDwhPool();
  const [lineas, sublineas, grupos] = await Promise.all([
    pool.request().query(`
      SELECT DISTINCT ISNULL(p.LineName, '${NO_LINEA}') AS Name
      FROM dim.Dim_Product p WHERE p.IsCurrent = 1 ORDER BY Name`),
    pool.request().query(`
      SELECT DISTINCT ISNULL(p.LineName, '${NO_LINEA}') AS Linea, ISNULL(p.SubLineName, '${NO_SUBLINEA}') AS Sublinea
      FROM dim.Dim_Product p WHERE p.IsCurrent = 1 ORDER BY Linea, Sublinea`),
    pool.request().query(CLIENTES_GROUPS_QUERY),
  ]);
  const response: ProductosFiltrosResponse = {
    lineas: lineas.recordset.map(r => String(r.Name).trim()),
    sublineas: sublineas.recordset.map(r => ({ linea: String(r.Linea).trim(), sublinea: String(r.Sublinea).trim() })),
    grupos: grupos.recordset.map(r => ({ code: String(r.Code).trim(), name: String(r.Name).trim() })),
  };
  return jsonWithCache(response);
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const groupByParam = searchParams.get('groupBy');
  const lineaParam = searchParams.get('linea');
  const sublineaParam = searchParams.get('sublinea');
  const tienda = parseTienda(searchParams.get('tienda'));
  const categoria = parseCategoria(searchParams.get('categoria'));

  if (searchParams.get('tiendas') === '1') {
    try {
      const pool = await getDwhPool();
      const [entidades, tiendas] = await Promise.all([
        pool.request().query(entidadesQuery()),
        pool.request().query(tiendasQuery()),
      ]);
      return jsonWithCache({
        tiendas: [
          ...entidades.recordset.map(r => ({
            value: `e:${Number(r.LegalEntityKey)}`,
            label: `${String(r.LegalEntityName).trim()} · ${Number(r.StoreCount)} tiendas`,
            group: 'Casas matriz' as const,
          })),
          ...tiendas.recordset.map(r => ({
            value: `t:${String(r.CustomerCode).trim()}`, label: r.CustomerName, group: 'Tiendas' as const,
          })),
        ],
      });
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (searchParams.get('filtros') === '1') {
    try {
      return await handleFiltros();
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (searchParams.get('categorias') === '1') {
    try {
      const pool = await getDwhPool();
      const response: ProductosCategoriasResponse = { categorias: await fetchCategorias(pool) };
      return jsonWithCache(response);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  // Fall back to a shallower level if the params needed to scope a deeper
  // drill are missing (e.g. a stale/hand-built URL) rather than erroring.
  let groupBy: ProductosGroupBy = isProductosGroupBy(groupByParam) ? groupByParam : 'linea';
  if (groupBy === 'sublinea' && !lineaParam) groupBy = 'linea';
  if (groupBy === 'sku' && (!lineaParam || !sublineaParam)) groupBy = 'linea';

  const tiendaOnlyWhere = tienda !== null ? `AND fs.CustomerKey IN (${tiendaKeysSql(tienda)})` : '';
  const salesFilterWhere = `${tiendaOnlyWhere} ${categoria !== null ? 'AND p.CategoryName = @categoria' : ''}`;

  const section = searchParams.get('section');
  if (section === 'profundidad' || section === 'porLineaMes') {
    try {
      const dateWhere = buildDateWhereClause(dateRange, 'fs');
      // Profundidad's standalone Tasa dev. keeps the devolución-date basis
      // (labelled in the UI); the drill-down table uses the same devolución-date basis.
      const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
      return section === 'profundidad'
        ? await handleProfundidad(dateWhere, returnsDateWhere, salesFilterWhere, tiendaOnlyWhere, tienda, categoria)
        : await handlePorLineaMes(dateWhere, salesFilterWhere, tienda, categoria, parseTrendBucket(searchParams, dateRange));
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  const nivelParam = searchParams.get('nivel') ?? groupByParam;
  const nivel: ProductosGroupBy = isProductosGroupBy(nivelParam) ? nivelParam : 'linea';
  const itemFilter = parseItemFilter(searchParams);

  if (section === 'catalogo') {
    try {
      const currency: Currency = searchParams.get('currency') === 'usd' ? 'usd' : 'bs';
      return await handleCatalogo(dateRange, nivel, itemFilter, tienda, categoria, currency);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (section === 'grupos') {
    try {
      return await handleGrupos(dateRange, nivel, itemFilter, tienda, categoria);
    } catch {
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  try {
    const pool = await getDwhPool();

    const dateWhere = buildDateWhereClause(dateRange, 'fs');
    const drillReturnsDateWhere = buildReturnsDateWhereClause(dateRange, 'fr');
    const returnsTiendaWhere = `${tienda !== null ? `AND fr.CustomerKey IN (${tiendaKeysSql(tienda)})` : ''} ${categoria !== null ? 'AND pr.CategoryName = @categoria' : ''}`;

    let recordset: Record<string, unknown>[];
    const breadcrumb: ProductosResponse['breadcrumb'] = [{ label: 'Líneas', groupBy: 'linea' }];

    if (groupBy === 'sku') {
      const req = pool.request().input('linea', lineaParam).input('sublinea', sublineaParam);
      bindFilters(req, tienda, categoria);
      const result = await req.query(skuQuery(dateWhere, salesFilterWhere, drillReturnsDateWhere, returnsTiendaWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: lineaParam as string, groupBy: 'sublinea' });
      breadcrumb.push({ label: sublineaParam as string, groupBy: 'sku' });
    } else if (groupBy === 'sublinea') {
      const req = pool.request().input('linea', lineaParam);
      bindFilters(req, tienda, categoria);
      const result = await req.query(sublineaQuery(dateWhere, salesFilterWhere, drillReturnsDateWhere, returnsTiendaWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: lineaParam as string, groupBy: 'sublinea' });
    } else {
      const req = pool.request();
      bindFilters(req, tienda, categoria);
      const result = await req.query(lineaQuery(dateWhere, salesFilterWhere, drillReturnsDateWhere, returnsTiendaWhere));
      recordset = result.recordset;
    }

    const totalSalesGross = recordset.reduce((sum, r) => sum + Number(r.SalesGrossBs), 0);

    const rows: ProductosRow[] = recordset.map(r => {
      const salesGrossBs = Number(r.SalesGrossBs);
      const salesGrossUsd = r.SalesGrossUsd === null ? null : Number(r.SalesGrossUsd);
      const rotacion = Number(r.QuantitySold);
      const grossProfit = r.GrossProfitAmount === null || r.GrossProfitAmount === undefined
        ? null
        : Number(r.GrossProfitAmount);
      const margin = grossProfit !== null && salesGrossBs !== 0 ? grossProfit / salesGrossBs : null;
      const salesShare = totalSalesGross > 0 ? salesGrossBs / totalSalesGross : null;
      const label = String(r.GroupLabel);

      return {
        sku: groupBy === 'sku' ? label : '',
        linea: groupBy === 'linea' ? label : (lineaParam ?? ''),
        sublinea: groupBy === 'sku' ? (sublineaParam ?? '') : groupBy === 'sublinea' ? label : '',
        rotacion,
        salesShare,
        salesGross: { bs: salesGrossBs, usd: salesGrossUsd },
        returns: dualFromRow(r.ReturnsBs, r.ReturnsUsd),
        salesNet: subtractDual({ bs: salesGrossBs, usd: salesGrossUsd }, dualFromRow(r.ReturnsBs, r.ReturnsUsd)),
        margin,
      };
    });

    const response: ProductosResponse = { rows, groupBy: groupBy as GroupBy, breadcrumb };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
