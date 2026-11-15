import { describe, expect, test } from 'bun:test';
import sql from 'mssql';
import { fetchRetenciones } from '../queries/retenciones-query';

function fakePool() {
  const inputs: { name: string; type: unknown; value: unknown }[] = [];
  const queries: string[] = [];
  const req = {
    input(name: string, type: unknown, value: unknown) { inputs.push({ name, type, value }); return req; },
    async query(q: string) { queries.push(q); return { recordset: [{ nro_doc: 'x' }] }; },
  };
  return { pool: { request: () => req } as unknown as sql.ConnectionPool, inputs, queries };
}

describe('fetchRetenciones', () => {
  test('SQL shape, no filters', async () => {
    const { pool, inputs, queries } = fakePool();
    const rows = await fetchRetenciones(pool, {});
    expect(rows).toEqual([{ nro_doc: 'x' }]);
    const q = queries[0];
    expect(q).toContain('saldo <> 0');
    expect(q).toContain('ISNULL(d.anulado, 0) = 0');
    expect(q).toContain('c.contrib = 1');
    expect(q).toContain("d.co_tipo_doc IN ('FACT', 'N/CR', 'N/DB')");
    expect(q).toContain("COALESCE(NULLIF(RTRIM(d.co_ven), ''), RTRIM(c.co_ven))");
    expect(q).toContain('d.co_cli');
    expect(q).toContain('saVendedor');
    expect(q).toContain('saSegmento');
    expect(q).not.toContain('BETWEEN');
    expect(inputs).toHaveLength(0);
  });
  test('binds dates when given', async () => {
    const { pool, inputs, queries } = fakePool();
    await fetchRetenciones(pool, { startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(queries[0]).toContain('d.fec_emis >= @startDate');
    expect(queries[0]).toContain('d.fec_emis < DATEADD(day, 1, @endDate)');
    expect(inputs.map(i => i.name)).toEqual(['startDate', 'endDate']);
    expect(inputs.every(i => i.type === sql.Date)).toBe(true);
  });
});
