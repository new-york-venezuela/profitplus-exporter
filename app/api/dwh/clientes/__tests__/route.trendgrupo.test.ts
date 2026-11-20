import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

interface Captured { sql: string; inputs: Record<string, unknown> }
const queries: Captured[] = [];
let respond: (text: string) => unknown[] = () => [];
function makeRequest() {
  const inputs: Record<string, unknown> = {};
  const req = {
    input(name: string, a: unknown, b?: unknown) { inputs[name] = b === undefined ? a : b; return req; },
    async query(text: string) { queries.push({ sql: text, inputs }); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/clientes?section=trendGrupo&${qs}`));
beforeEach(() => { queries.length = 0; respond = () => []; });

const r = (BucketKey: string, GroupCode: string | null, SalesBs: number, SalesUsd: number | null, GroupName: string | null = GroupCode) =>
  ({ BucketKey, GroupCode, GroupName, SalesBs, SalesUsd });

describe('GET /api/dwh/clientes section=trendGrupo', () => {
  test('buckets by the shared granularity and ignores the grupo filter but binds ruta', async () => {
    const res = await get('dateRange=custom:2026-10-05:2026-10-25&granularity=week&grupo=S1&ruta=3');
    expect(res.status).toBe(200);
    expect(queries[0].sql).toContain("'-W'");
    expect(queries[0].sql).toContain('@scopeRuta');
    expect(queries[0].sql).not.toContain('@scopeGrupo');
    expect(queries[0].inputs).toMatchObject({ scopeRuta: 3 });
    expect(queries[0].inputs).not.toHaveProperty('scopeGrupo');
  });

  test('only sums sales inside the range (a straddling first bucket is not inflated by days before the start)', async () => {
    await get('dateRange=custom:2026-10-05:2026-10-25&granularity=week');
    expect(queries[0].sql).toContain('fs.DateKey >= 20261005');
    expect(queries[0].sql).not.toContain('fs.DateKey >= 20260901');
    await get('dateRange=custom:2026-03-15:2026-10-25&granularity=month');
    expect(queries[1].sql).toContain('fs.DateKey >= 20260315');
  });

  test('returns series ordered by sales and labelled buckets', async () => {
    respond = () => [r('2026-W41', 'S1', 100, 10, 'Abasto'), r('2026-W41', 'S2', 300, 30, 'Restaurante')];
    const body = await (await get('dateRange=custom:2026-10-05:2026-10-25&granularity=week')).json();
    expect(body.granularity).toBe('week');
    expect(body.series.map((s: { code: string }) => s.code)).toEqual(['S2', 'S1']);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({ bucketKey: '2026-W41', label: 'S41' });
    expect(body.rows[0].sales.S2).toEqual({ bs: 300, usd: 30 });
  });

  test('null USD stays null', async () => {
    respond = () => [r('2026-W41', 'S1', 100, null, 'Abasto')];
    const body = await (await get('dateRange=custom:2026-10-05:2026-10-25&granularity=week')).json();
    expect(body.rows[0].sales.S1.usd).toBeNull();
  });
});
