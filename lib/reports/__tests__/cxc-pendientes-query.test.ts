import { describe, expect, test } from 'bun:test';
import sql from 'mssql';
import { fetchCxcPendientes } from '../queries/cxc-pendientes-query';

function fakePool(headers: unknown[], lines: unknown[]) {
  const inputs: { name: string; type: unknown; value: unknown }[] = [];
  const queries: string[] = [];
  const pool = {
    request() {
      const req = {
        input(name: string, type: unknown, value: unknown) { inputs.push({ name, type, value }); return req; },
        async query(q: string) {
          queries.push(q);
          return { recordset: q.includes('saFacturaVentaReng') ? lines : headers };
        },
      };
      return req;
    },
  };
  return { pool: pool as unknown as sql.ConnectionPool, inputs, queries };
}

describe('fetchCxcPendientes', () => {
  test('SQL shape and stitching by document', async () => {
    const { pool, inputs, queries } = fakePool(
      [{ nro_doc: 'A ', total_neto: 1 }, { nro_doc: 'B', total_neto: 2 }],
      [{ doc_num: 'A', tipo_imp: '1', base: 100, iva: 16 }],
    );
    const rows = await fetchCxcPendientes(pool, {});
    const h = queries.find(q => !q.includes('saFacturaVentaReng'))!;
    const l = queries.find(q => q.includes('saFacturaVentaReng'))!;
    expect(h).toContain("co_tipo_doc = 'FACT'");
    expect(h).toContain('saldo <> 0');
    expect(h).toContain('ISNULL(d.anulado, 0) = 0');
    expect(h).toContain("COALESCE(NULLIF(RTRIM(d.co_ven), ''), RTRIM(c.co_ven))");
    expect(h).toContain('fec_venc');
    expect(h).toContain('total_neto');
    expect(l).toContain('doc_num');
    expect(l).toContain('nro_doc');
    expect(inputs).toHaveLength(0);
    expect(rows[0].lines).toEqual([{ tipoImp: '1', base: 100, iva: 16 }]);
    expect(rows[1].lines).toEqual([]);
  });
  test('null aggregates stay null, lineBase handles null monto_imp', async () => {
    const { pool, queries } = fakePool([{ nro_doc: 'A' }], [{ doc_num: 'A', tipo_imp: 'E', base: null, iva: null }]);
    const rows = await fetchCxcPendientes(pool, {});
    expect(rows[0].lines).toEqual([{ tipoImp: 'E', base: null, iva: null }]);
    expect(queries.find(q => q.includes('saFacturaVentaReng'))!).toContain('r.reng_neto - ISNULL(r.monto_imp, 0)');
  });
  test('binds dates with half-open end', async () => {
    const { pool, inputs, queries } = fakePool([], []);
    await fetchCxcPendientes(pool, { startDate: '2026-01-01', endDate: '2026-01-31' });
    for (const q of queries) {
      expect(q).toContain('d.fec_emis >= @startDate');
      expect(q).toContain('d.fec_emis < DATEADD(day, 1, @endDate)');
    }
    expect(inputs.every(i => i.type === sql.Date)).toBe(true);
    expect(inputs.map(i => i.name)).toContain('startDate');
  });
});
