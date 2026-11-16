import { NextRequest, NextResponse } from 'next/server';
import { captureException } from '@/lib/analytics/posthog';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { parseTrendBucket, type TrendBucket } from '@/app/api/dwh/lib/trend-bucket';
import { buildDateWhereClause, buildReturnsDateWhereClause, jsonWithCache, usdConversionJoin, returnsUsdConversionJoin, dualAmountExpr } from '@/app/api/dwh/lib/query-builder';
import { dualFromRow, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import type { DualAmount } from '@/app/(app)/analitica/types';
import { buildGroupShareMatrix } from '@/lib/productos/group-share';
import { CLIENTES_GROUPS_QUERY } from '@/lib/clientes/scope';
import { bindItemFilter, itemFilterSql, parseItemFilter, returnsItemFilterSql, type ItemFilter } from '@/lib/productos/item-filter';
import { classifyPareto } from '@/lib/productos/pareto';
import { fetchCategorias, fetchGroupShare, parseCategoria } from '@/lib/productos/queries';
import { bindTienda, parseTienda, tiendaKeysSql, type TiendaFilter } from '@/lib/productos/tienda-filter';
import type {
  UnitsByLineaResponse, UnitsByLineaMonthRow,
  ProductosGroupShareResponse, ProductosCategoriasResponse,
  CatalogoRow, CatalogoResponse, ProductosFiltrosResponse, Currency,
} from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// migrations/dwh/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.
//
// Sections: catalogo (master table), grupos (group-share matrix), porLineaMes
// (units trend), plus the tiendas=1 / categorias=1 / filtros=1 option lists.

type Nivel = 'linea' | 'sublinea' | 'sku';

const NO_LINEA = 'Sin línea';
const NO_SUBLINEA = 'Sin sublínea';

function isNivel(value: string | null): value is Nivel {
  return value === 'linea' || value === 'sublinea' || value === 'sku';
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

// Units sold per trend bucket (day/week/month), stacked by the item at the active nivel (línea,
// sublínea or SKU). The top 10 series by total volume in range get their own series, the rest are
// bucketed into "Otras" so the stacked bar chart stays legible however many items exist. The bar's
// item filters apply to both queries.
const TREND_TOP = 10;

function trendKeys(nivel: Nivel) {
  const line = `ISNULL(p.LineName, '${NO_LINEA}')`;
  const sub = `ISNULL(p.SubLineName, '${NO_SUBLINEA}')`;
  if (nivel === 'linea') return { group: line, key: line, label: line, code: 'NULL', linea: line, sublinea: 'NULL' };
  if (nivel === 'sublinea') {
    const key = `${line} + ' › ' + ${sub}`;
    return { group: `${line}, ${sub}`, key, label: key, code: 'NULL', linea: line, sublinea: sub };
  }
  const code = 'RTRIM(p.ProductCode)';
  return {
    group: code, key: code, label: `MAX(ISNULL(p.ProductName, ${code}))`, code,
    linea: `MAX(${line})`, sublinea: `MAX(${sub})`,
  };
}

function topSeriesQuery(nivel: Nivel, dateWhere: string, filterWhere: string): string {
  const k = trendKeys(nivel);
  return `
    SELECT TOP ${TREND_TOP}
      ${k.key} AS SeriesKey, ${k.label} AS Label, ${k.code} AS Code,
      ${k.linea} AS Linea, ${k.sublinea} AS Sublinea,
      SUM(fs.QuantitySold) AS QuantitySold
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${filterWhere}
    GROUP BY ${k.group}
    ORDER BY QuantitySold DESC, ${k.key}
  `;
}

function unitsByLineaMonthQuery(nivel: Nivel, dateWhere: string, filterWhere: string, bucket: TrendBucket): string {
  const k = trendKeys(nivel);
  return `
    SELECT
      ${bucket.keyExpr('d')} AS Bucket,
      ${k.key} AS SeriesKey,
      SUM(fs.QuantitySold) AS QuantitySold,
      ${dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')}
    FROM fact.Fact_Sales fs
    ${usdConversionJoin('fs')}
    JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey
    JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
    WHERE fs.IsVoided = 0 ${dateWhere} ${filterWhere}
    GROUP BY ${bucket.keyExpr('d')}, ${k.group}
    ORDER BY ${bucket.keyExpr('d')}
  `;
}

function bindFilters(req: { input(name: string, value: unknown): unknown }, tienda: TiendaFilter | null, categoria: string | null): void {
  bindTienda(req, tienda);
  if (categoria !== null) req.input('categoria', categoria);
}

async function handlePorLineaMes(
  nivel: Nivel, dateWhere: string, salesFilterWhere: string, filter: ItemFilter,
  tienda: TiendaFilter | null, categoria: string | null, trend: TrendBucket,
): Promise<NextResponse> {
  const pool = await getDwhPool();

  const topReq = pool.request();
  bindFilters(topReq, tienda, categoria);
  bindItemFilter(topReq, filter);
  const topResult = await topReq.query(topSeriesQuery(nivel, dateWhere, salesFilterWhere));
  // Series label by key; two SKUs can share a name, so a repeated label gets its code appended.
  const labelByKey = new Map<string, string>();
  const seriesMeta: Record<string, { linea?: string; sublinea?: string; code?: string }> = {};
  const usedLabels = new Set<string>();
  for (const r of topResult.recordset) {
    const key = String(r.SeriesKey).trim();
    let label = String(r.Label ?? key).trim();
    if (usedLabels.has(label)) label = `${label} (${key})`;
    usedLabels.add(label);
    labelByKey.set(key, label);
    if (nivel === 'sublinea') seriesMeta[label] = { linea: String(r.Linea).trim(), sublinea: String(r.Sublinea).trim() };
    else if (nivel === 'sku') seriesMeta[label] = { linea: String(r.Linea).trim(), sublinea: String(r.Sublinea).trim(), code: key };
  }

  const monthReq = pool.request();
  bindFilters(monthReq, tienda, categoria);
  bindItemFilter(monthReq, filter);
  const monthResult = await monthReq.query(unitsByLineaMonthQuery(nivel, dateWhere, salesFilterWhere, trend));

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
    const linea = labelByKey.get(String(r.SeriesKey).trim()) ?? 'Otras';
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
  // Legend / colour order follows the top-series order (units descending), not bucket-row order.
  const seen = new Set(lineasSeen);
  const ordered = Array.from(labelByKey.values()).filter(l => seen.has(l));
  const lineas = hasOtras ? [...ordered, 'Otras'] : ordered;

  const response: UnitsByLineaResponse = { rows, lineas, trendMode: trend.mode, nivel, seriesMeta };
  return jsonWithCache(response);
}

async function handleGrupos(
  dateRange: string, level: Nivel, filter: ItemFilter, tienda: TiendaFilter | null, categoria: string | null,
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
function catalogoKeys(nivel: Nivel, p: string) {
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

function catalogoSalesQuery(nivel: Nivel, where: string): string {
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

function catalogoReturnsQuery(nivel: Nivel, where: string): string {
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
  dateRange: string, nivel: Nivel, filter: ItemFilter, tienda: TiendaFilter | null,
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
    } catch (err) {
      console.error('GET /api/dwh/productos (tiendas) failed', err);
      captureException(err, auth.session.sub);
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (searchParams.get('filtros') === '1') {
    try {
      return await handleFiltros();
    } catch (err) {
      console.error('GET /api/dwh/productos (filtros) failed', err);
      captureException(err, auth.session.sub);
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (searchParams.get('categorias') === '1') {
    try {
      const pool = await getDwhPool();
      const response: ProductosCategoriasResponse = { categorias: await fetchCategorias(pool) };
      return jsonWithCache(response);
    } catch (err) {
      console.error('GET /api/dwh/productos (categorias) failed', err);
      captureException(err, auth.session.sub);
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  const section = searchParams.get('section');
  // `groupBy` is still accepted as an alias of `nivel`.
  const nivelParam = searchParams.get('nivel') ?? searchParams.get('groupBy');
  const nivel: Nivel = isNivel(nivelParam) ? nivelParam : 'linea';
  const itemFilter = parseItemFilter(searchParams);

  if (section === 'porLineaMes') {
    try {
      const dateWhere = buildDateWhereClause(dateRange, 'fs');
      const salesFilterWhere = `${tienda !== null ? `AND fs.CustomerKey IN (${tiendaKeysSql(tienda)})` : ''} ${categoria !== null ? 'AND p.CategoryName = @categoria' : ''} ${itemFilterSql(itemFilter)}`;
      return await handlePorLineaMes(nivel, dateWhere, salesFilterWhere, itemFilter, tienda, categoria, parseTrendBucket(searchParams, dateRange));
    } catch (err) {
      console.error('GET /api/dwh/productos (porLineaMes) failed', err);
      captureException(err, auth.session.sub);
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (section === 'catalogo') {
    try {
      const currency: Currency = searchParams.get('currency') === 'usd' ? 'usd' : 'bs';
      return await handleCatalogo(dateRange, nivel, itemFilter, tienda, categoria, currency);
    } catch (err) {
      console.error('GET /api/dwh/productos (catalogo) failed', err);
      captureException(err, auth.session.sub);
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  if (section === 'grupos') {
    try {
      return await handleGrupos(dateRange, nivel, itemFilter, tienda, categoria);
    } catch (err) {
      console.error('GET /api/dwh/productos (grupos) failed', err);
      captureException(err, auth.session.sub);
      return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Sección no válida' }, { status: 400 });
}
