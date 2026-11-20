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

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/clientes?section=trayectoria&${qs}`));
beforeEach(() => { queries.length = 0; respond = () => []; });

const store = (over: Record<string, unknown>) => ({
  Code: 'G1', Name: 'Gama Centro', LegalEntityKey: 1, LegalEntityName: 'Gama',
  SalesBs: 100, SalesUsd: 10, PrevBs: 80, PrevUsd: 8, Units: 10, PrevUnits: 8, Orders: 2, LastDateKey: 20261020, FirstDateKey: 20250101, ...over,
});

describe('GET /api/dwh/clientes section=trayectoria', () => {
  test('binds grupo and ruta through the shared scope', async () => {
    await get('dateRange=month:2026-10&grupo=S1&ruta=3');
    expect(queries[0].sql).toContain('@scopeGrupo');
    expect(queries[0].inputs).toMatchObject({ scopeGrupo: 'S1', scopeRuta: 3 });
  });

  test('rolls store rows up under their entity', async () => {
    respond = () => [store({}), store({ Code: 'G2', Name: 'Gama Este', SalesBs: 50, SalesUsd: 5, FirstDateKey: 20261012 })];
    const body = await (await get('dateRange=month:2026-10')).json();
    expect(body.available).toBe(true);
    const gama = body.rows.find((r: { key: string }) => r.key === 'e:1');
    expect(gama.storeCount).toBe(2);
    expect(gama.sales).toEqual({ bs: 150, usd: 15 });
    expect(gama.newStoresCount).toBe(1);
  });

  test('null USD stays null (never zero)', async () => {
    respond = () => [store({ SalesUsd: null, PrevUsd: null })];
    const body = await (await get('dateRange=month:2026-10')).json();
    expect(body.rows.find((r: { key: string }) => r.key === 'e:1').sales.usd).toBeNull();
  });

  test('a range without a previous window reports available false and null previous figures', async () => {
    respond = () => [store({})];
    const body = await (await get('dateRange=ytd:2024')).json();
    expect(body.available).toBe(false);
    expect(body.rows.find((r: { key: string }) => r.key === 'e:1').salesPrev).toBeNull();
  });

  test('origen scopes the stores', async () => {
    await get('dateRange=month:2026-10&origen=patrimonio');
    expect(queries[0].sql).toContain('cur_s.IsMigrationBatch = 1 OR cur_s.RegisteredDate < @scopeOrigenFrom');
    expect(queries[0].inputs).toMatchObject({ scopeOrigenFrom: '2026-01-01' });
  });
});
