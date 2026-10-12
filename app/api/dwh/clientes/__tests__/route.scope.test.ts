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

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/clientes?${qs}`));
beforeEach(() => { queries.length = 0; respond = () => []; });

describe('GET /api/dwh/clientes scope', () => {
  test('default list: group and route become bound parameters on the sales query', async () => {
    const res = await get('dateRange=month:2026-10&clienteDimension=cliente_tienda&grupo=S1&ruta=3');
    expect(res.status).toBe(200);
    const q = queries[0];
    expect(q.sql).toContain('cur_s.IsCurrent = 1');
    expect(q.sql).toContain('@scopeGrupo');
    expect(q.sql).toContain('@scopeRuta');
    expect(q.inputs).toMatchObject({ scopeGrupo: 'S1', scopeRuta: 3 });
  });
  test('no scope params: the SQL is unchanged', async () => {
    await get('dateRange=month:2026-10');
    expect(queries[0].sql).not.toContain('cur_s');
    expect(queries[0].inputs).toEqual({});
  });
  test('malformed scope values are ignored (no SQL, no inputs)', async () => {
    await get("dateRange=month:2026-10&grupo=S1' OR '1'='1&ruta=abc");
    expect(queries[0].sql).not.toContain('cur_s');
    expect(queries[0].inputs).toEqual({});
  });
  test('trend keeps minYearMonth and adds the scope to the monthly customer set', async () => {
    await get('dateRange=month:2026-10&section=trend&grupo=S2');
    expect(queries[0].sql).toContain('@scopeGrupo');
    expect(queries[0].inputs).toMatchObject({ minYearMonth: '2026-10', scopeGrupo: 'S2' });
  });
  test('churned scopes the prior-period customers', async () => {
    await get('dateRange=month:2026-10&section=churned&ruta=4');
    expect(queries[0].sql).toContain('@scopeRuta');
    expect(queries[0].inputs).toMatchObject({ scopeRuta: 4 });
  });
  test('section=filters returns the group and route options', async () => {
    respond = text => (text.includes('Dim_Segment')
      ? [{ Code: 'S1', Name: 'Abasto' }, { Code: 'S2', Name: 'Restaurante' }]
      : [{ RouteNumber: 3, ZoneName: 'Ruta 3' }, { RouteNumber: 4, ZoneName: 'Ruta 4' }]);
    const res = await get('section=filters');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      groups: [{ value: 'S1', label: 'Abasto' }, { value: 'S2', label: 'Restaurante' }],
      routes: [{ value: '3', label: 'Ruta 3' }, { value: '4', label: 'Ruta 4' }],
    });
  });
  test('a database error is a 500 with the standard shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('section=filters');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
