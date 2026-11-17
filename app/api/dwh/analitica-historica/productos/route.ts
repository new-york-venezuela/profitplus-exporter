import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { dualFromRow, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import { classifyPareto } from '@/lib/productos/pareto';
import { bindItemFilter, itemFilterSql, returnsItemFilterSql, type ItemFilter } from '@/lib/productos/item-filter';
import { parseHistParams } from '@/lib/analitica-historica/params';
import { histReturnsWhere, histSalesWhere } from '@/lib/analitica-historica/sql';
import { previousRange, type HistRange } from '@/lib/analitica-historica/window';
import { parseHistProductosFilters, type HistNivel } from '@/lib/analitica-historica/productos-filter';
import {
  HIST_FILTROS_CATEGORIAS_SQL, HIST_FILTROS_LINEAS_SQL, histCatalogoReturnsQuery, histCatalogoSalesQuery,
} from '@/lib/analitica-historica/productos-sql';
import type { CatalogoRow, DualAmount } from '@/app/(app)/analitica/types';
import type { HistCatalogoResponse, HistProductosFiltrosResponse } from '@/app/(app)/analitica-historica/types';

export const dynamic = 'force-dynamic';

type Pool = Awaited<ReturnType<typeof getDwhPool>>;
const ZERO: DualAmount = { bs: 0, usd: 0 };

interface Period { sales: Record<string, unknown>[]; returns: Record<string, unknown>[] }

async function fetchPeriod(
  pool: Pool, nivel: HistNivel, filter: ItemFilter, categoria: string | null,
  range: HistRange, basis: ReturnType<typeof parseHistParams>['basis'],
): Promise<Period> {
  const salesWhere = `${histSalesWhere(range, 'fsl')} ${categoria !== null ? 'AND p.CategoryName = @categoria' : ''} ${itemFilterSql(filter, { product: 'p' })}`;
  const returnsWhere = `${histReturnsWhere(range, basis, 'frl')} ${categoria !== null ? 'AND pr.CategoryName = @categoria' : ''} ${returnsItemFilterSql(filter)}`;
  const salesReq = pool.request();
  const returnsReq = pool.request();
  for (const req of [salesReq, returnsReq]) {
    bindItemFilter(req, filter);
    if (categoria !== null) req.input('categoria', categoria);
  }
  const [sales, returns] = await Promise.all([
    salesReq.query(histCatalogoSalesQuery(nivel, salesWhere)),
    returnsReq.query(histCatalogoReturnsQuery(nivel, returnsWhere)),
  ]);
  return { sales: sales.recordset, returns: returns.recordset };
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { dateRange, range, basis, searchParams } = parseHistParams(request);
  const section = searchParams.get('section');
  if (section !== 'catalogo' && section !== 'filtros') {
    return NextResponse.json({ error: 'Parámetro section inválido' }, { status: 400 });
  }

  try {
    if (section === 'filtros') {
      const pool = await getDwhPool();
      const [lineas, categorias] = await Promise.all([
        pool.request().query(HIST_FILTROS_LINEAS_SQL),
        pool.request().query(HIST_FILTROS_CATEGORIAS_SQL),
      ]);
      const pairs = (lineas.recordset as Record<string, unknown>[]).map(r => ({ linea: String(r.Linea), sublinea: String(r.Sublinea) }));
      return jsonWithCache<HistProductosFiltrosResponse>({
        lineas: [...new Set(pairs.map(p => p.linea))],
        sublineas: pairs,
        categorias: (categorias.recordset as Record<string, unknown>[]).map(r => String(r.Categoria)),
      });
    }

    const { nivel, currency, categoria, filter } = parseHistProductosFilters(searchParams);
    if (range.empty) return jsonWithCache<HistCatalogoResponse>({ rows: [], nivel });

    const pool = await getDwhPool();
    const prevRange = previousRange(dateRange);
    const [cur, prev] = await Promise.all([
      fetchPeriod(pool, nivel, filter, categoria, range, basis),
      prevRange !== null ? fetchPeriod(pool, nivel, filter, categoria, prevRange, basis) : Promise.resolve(null),
    ]);

    const returnsByKey = new Map<string, DualAmount>();
    const labels = new Map<string, Record<string, unknown>>();
    for (const r of cur.returns) {
      const key = String(r.Key).trim();
      returnsByKey.set(key, dualFromRow(r.ReturnsBs, r.ReturnsUsd));
      labels.set(key, r);
    }
    const salesByKey = new Map<string, Record<string, unknown>>();
    for (const r of cur.sales) {
      const key = String(r.Key).trim();
      salesByKey.set(key, r);
      labels.set(key, r);
    }

    const prevNetByKey = new Map<string, DualAmount>();
    if (prev) {
      const prevReturns = new Map<string, DualAmount>();
      for (const r of prev.returns) prevReturns.set(String(r.Key).trim(), dualFromRow(r.ReturnsBs, r.ReturnsUsd));
      for (const r of prev.sales) {
        const key = String(r.Key).trim();
        prevNetByKey.set(key, subtractDual(dualFromRow(r.SalesGrossBs, r.SalesGrossUsd), prevReturns.get(key) ?? ZERO));
      }
    }

    // Union of keys: a product that only has returns in the range is listed too.
    const base = [...labels.keys()].map(key => {
      const s = salesByKey.get(key);
      const meta = labels.get(key)!;
      const gross = s ? dualFromRow(s.SalesGrossBs, s.SalesGrossUsd) : { ...ZERO };
      const ret = returnsByKey.get(key) ?? { ...ZERO };
      const units = Number(s?.Units ?? 0);
      const monthCount = Number(s?.MonthCount ?? 0);
      const customers = Number(s?.ClientCount ?? 0);
      return {
        key,
        label: String(meta.Label ?? key).trim(),
        code: nivel === 'sku' ? key : null,
        linea: String(meta.Linea ?? '').trim(),
        sublinea: String(meta.Sublinea ?? '').trim(),
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
        clientCount: customers,
        posCount: customers,
      };
    });

    const valueOf = (net: DualAmount): number | null => (currency === 'usd' ? net.usd : net.bs);
    const pareto = classifyPareto(base.map(b => ({ key: b.key, value: valueOf(b.salesNet) })));
    const total = base.reduce((sum, b) => sum + (valueOf(b.salesNet) ?? 0), 0);

    const rows: CatalogoRow[] = base
      .map(b => {
        const v = valueOf(b.salesNet);
        const prevNet = prevNetByKey.get(b.key) ?? null;
        const prevV = prevNet === null ? null : valueOf(prevNet);
        const trendPct = v !== null && prevV !== null && prevV > 0 ? (v - prevV) / prevV : null;
        return { ...b, sharePct: v !== null && total > 0 ? v / total : null, pareto: pareto.get(b.key) ?? null, prevNet, trendPct };
      })
      .sort((a, b) => {
        const av = valueOf(a.salesNet); const bv = valueOf(b.salesNet);
        if (av === null && bv === null) return a.key.localeCompare(b.key);
        if (av === null) return 1;
        if (bv === null) return -1;
        return bv - av || a.key.localeCompare(b.key);
      });

    return jsonWithCache<HistCatalogoResponse>({ rows, nivel });
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
