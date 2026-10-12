import sql from 'mssql';
import { INCREMENTAL_LOAD } from '@/lib/dwh/incremental-load-sql';
import { sellerKey } from './codes';
import { routeZoneCode } from './route-zones';
import type { MappingRow } from './types';

// Runs the exact INCREMENTAL_LOAD batch (every dimension, then every fact). A partial chain is
// unsafe: the fact loads skip lines whose product/warehouse/currency dimension is not loaded yet
// and still advance their watermark, which would permanently drop those lines.
// The recipe-cost snapshot step of `bun run dwh:incremental-load` is NOT run here (it needs the
// SQLite and ERP pools); run that command afterwards.
// Facts reload by themselves because the ERP writes bumped `validador` on the changed documents.
export async function runDwhRestateLoads(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().batch(INCREMENTAL_LOAD);
}

export interface SellerMismatch {
  table: 'Fact_Sales' | 'Fact_Returns';
  coCli: string; expected: string; actual: string | null; n: number;
}

export async function findSellerMismatches(
  pool: sql.ConnectionPool, rows: MappingRow[], sinceDateKey: number,
): Promise<SellerMismatch[]> {
  const expected = new Map(rows.filter(r => r.coVen.trim()).map(r => [r.coCli.trim().toUpperCase(), r.coVen.trim()]));
  const out: SellerMismatch[] = [];
  for (const table of ['Fact_Sales', 'Fact_Returns'] as const) {
    const res = await pool.request().input('since', sql.Int, sinceDateKey).query(`
      SELECT RTRIM(c.CustomerCode) AS coCli, RTRIM(rep.SalesRepCode) AS rep, COUNT(*) AS n
      FROM fact.${table} f
      JOIN dim.Dim_Customer c ON c.CustomerKey = f.CustomerKey
      LEFT JOIN dim.Dim_SalesRep rep ON rep.SalesRepKey = f.SalesRepKey
      WHERE f.DateKey >= @since AND f.IsVoided = 0
      GROUP BY RTRIM(c.CustomerCode), RTRIM(rep.SalesRepCode)`);
    for (const x of res.recordset as { coCli: string; rep: string | null; n: number }[]) {
      const want = expected.get(x.coCli.trim().toUpperCase());
      if (want && (x.rep == null || sellerKey(x.rep) !== sellerKey(want))) {
        out.push({ table, coCli: x.coCli, expected: want, actual: x.rep, n: x.n });
      }
    }
  }
  return out;
}

export interface DimRouteRow { coCli: string; zone: string | null; frequency: string | null; rep: string | null }
export interface RouteMismatch {
  coCli: string;
  field: 'ZoneCode' | 'VisitFrequency' | 'DefaultSalesRepCode';
  expected: string;
  actual: string | null;
}

export function compareRouteDim(rows: MappingRow[], dim: DimRouteRow[]): RouteMismatch[] {
  const byCode = new Map(dim.map(d => [d.coCli.trim().toUpperCase(), d]));
  const out: RouteMismatch[] = [];
  for (const r of rows) {
    const d = byCode.get(r.coCli.trim().toUpperCase());
    if (!d) continue;
    if (r.ruta != null) {
      const want = routeZoneCode(r.ruta);
      if ((d.zone ?? '').trim() !== want) out.push({ coCli: r.coCli, field: 'ZoneCode', expected: want, actual: d.zone?.trim() ?? null });
      if ((d.frequency?.trim().toUpperCase() ?? null) !== r.frecuencia) out.push({ coCli: r.coCli, field: 'VisitFrequency', expected: r.frecuencia, actual: d.frequency });
    }
    if (r.coVen.trim() && (d.rep == null || sellerKey(d.rep) !== sellerKey(r.coVen))) {
      out.push({ coCli: r.coCli, field: 'DefaultSalesRepCode', expected: r.coVen.trim(), actual: d.rep?.trim() ?? null });
    }
  }
  return out;
}

export async function findRouteMismatches(pool: sql.ConnectionPool, rows: MappingRow[]): Promise<RouteMismatch[]> {
  const res = await pool.request().query(`
    SELECT RTRIM(CustomerCode) AS coCli, RTRIM(ZoneCode) AS zone, VisitFrequency AS frequency,
           RTRIM(DefaultSalesRepCode) AS rep
    FROM dim.Dim_Customer WHERE IsCurrent = 1`);
  return compareRouteDim(rows, res.recordset as DimRouteRow[]);
}
