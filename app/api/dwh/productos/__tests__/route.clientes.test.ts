import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

interface Captured { sql: string; inputs: Record<string, unknown> }
const queries: Captured[] = [];
let respond: (text: string) => unknown[] = () => [];
const captured: unknown[] = [];
function makeRequest() {
  const inputs: Record<string, unknown> = {};
  const req = {
    input(name: string, a: unknown, b?: unknown) { inputs[name] = b === undefined ? a : b; return req; },
    async query(text: string) { queries.push({ sql: text, inputs }); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/analytics/posthog', () => ({
  captureException: (err: unknown) => { captured.push(err); },
  captureEvent: () => {},
}));
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/productos?${qs}`));
beforeEach(() => { queries.length = 0; captured.length = 0; respond = () => []; });

const salesQ = () => queries.find(q => q.sql.includes('AS PosItem'))!;
const returnsQ = () => queries.find(q => q.sql.includes('fact.Fact_Returns'))!;
const totalQ = () => queries.find(q => q.sql.includes('AS PosTotal'))!;
const historyQ = () => queries.find(q => q.sql.includes('AS Orders'))!;

const SALES = [
  { ClientId: '7', Name: 'Casa Matriz', GroupCode: 'G1', GroupName: 'Cadenas', PosItem: 2, GrossBs: 800, GrossUsd: 16, Units: 80 },
  { ClientId: 'C:J001', Name: 'Tienda J', GroupCode: null, GroupName: null, PosItem: 1, GrossBs: 200, GrossUsd: null, Units: 20 },
];
const RETURNS = [{ ClientId: '7', ReturnsBs: 80, ReturnsUsd: 2 }];
const TOTALS = [{ ClientId: '7', PosTotal: 5 }, { ClientId: 'C:J001', PosTotal: 1 }];
const HISTORY = [{ ClientId: '7', Orders: 4, FirstKey: 20260101, LastKey: 20260301 }];
const respondAll = (text: string) => {
  if (text.includes('AS PosItem')) return SALES;
  if (text.includes('fact.Fact_Returns')) return RETURNS;
  if (text.includes('AS PosTotal')) return TOTALS;
  if (text.includes('AS Orders')) return HISTORY;
  return [];
};

describe('GET /api/dwh/productos section=clientes', () => {
  test('400 for unknown nivel and for missing key', async () => {
    expect((await get('section=clientes&nivel=zzz&key=Pizza')).status).toBe(400);
    expect((await get('section=clientes&nivel=linea')).status).toBe(400);
    expect((await get('section=clientes&nivel=linea&key=%20')).status).toBe(400);
    expect(queries).toHaveLength(0);
  });
  test('runs four queries; item key bound as @itemKey and compared with the catalogo key expression', async () => {
    await get('section=clientes&nivel=sublinea&key=Panaderia%7CPan&dateRange=month:2026-10');
    expect(queries).toHaveLength(4);
    const expr = "ISNULL(p.LineName, 'Sin línea') + '|' + ISNULL(p.SubLineName, 'Sin sublínea')";
    expect(salesQ().sql).toContain(`${expr} = @itemKey`);
    expect(historyQ().sql).toContain(`${expr} = @itemKey`);
    expect(returnsQ().sql).toContain("ISNULL(pr.LineName, 'Sin línea') + '|' + ISNULL(pr.SubLineName, 'Sin sublínea') = @itemKey");
    expect(salesQ().inputs.itemKey).toBe('Panaderia|Pan');
    expect(returnsQ().inputs.itemKey).toBe('Panaderia|Pan');
    expect(historyQ().inputs.itemKey).toBe('Panaderia|Pan');
    expect(totalQ().sql).not.toContain('@itemKey');
    await get('section=clientes&nivel=sku&key=P-1');
    expect(queries.at(-1)!.sql).toBeDefined();
    expect(queries.filter(q => q.sql.includes('RTRIM(p.ProductCode) = @itemKey'))).toHaveLength(2);
  });
  test('filters bound on sales, returns and history; total honours tienda only', async () => {
    await get('section=clientes&nivel=linea&key=Pizza&dateRange=month:2026-10&lineas=Pizza&q=pan&grupo=G1&tienda=e:7&categoria=Fresco');
    for (const q of [salesQ(), returnsQ(), historyQ()]) {
      expect(q.sql).toContain('@linea0');
      expect(q.sql).toContain('@q');
      expect(q.sql).toContain('@grupo');
      expect(q.sql).toContain('@entidadKey');
      expect(q.sql).toContain('@categoria');
      expect(q.inputs).toMatchObject({ linea0: 'Pizza', q: '%pan%', grupo: 'G1', entidadKey: 7, categoria: 'Fresco' });
    }
    expect(totalQ().sql).toContain('@entidadKey');
    expect(totalQ().sql).not.toContain('@linea0');
    expect(totalQ().sql).not.toContain('@categoria');
    expect(totalQ().inputs.entidadKey).toBe(7);
    queries.length = 0;
    await get('section=clientes&nivel=linea&key=Pizza&tienda=t:J001');
    expect(salesQ().inputs.tiendaCode).toBe('J001');
    expect(historyQ().inputs.tiendaCode).toBe('J001');
  });
  test('history window is 12 months from today and ignores dateRange; sales/returns use it', async () => {
    const today = new Date();
    const key = (d: Date) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 12, today.getUTCDate()));
    await get('section=clientes&nivel=linea&key=Pizza&dateRange=month:2020-01');
    expect(historyQ().sql).toContain(`fs.DateKey >= ${key(start)}`);
    expect(historyQ().sql).toContain(`fs.DateKey <= ${key(today)}`);
    expect(historyQ().sql).not.toContain('2020');
    expect(salesQ().sql).toContain('20200101');
    expect(returnsQ().sql).toContain('20200101');
    expect(totalQ().sql).toContain('20200101');
  });
  test('client id falls back to the customer code and resolves via the current row', async () => {
    await get('section=clientes&nivel=linea&key=Pizza');
    const sql = salesQ().sql;
    expect(sql).toContain("'C:' + RTRIM(c.CustomerCode)");
    expect(sql).toContain('cur.IsCurrent = 1');
    expect(sql).toContain('COUNT(DISTINCT RTRIM(c.CustomerCode)) AS PosItem');
    expect(sql).toContain('RootCustomerCode');
    expect(sql).toContain('Dim_Segment');
  });
  test('response shape, merge by client id, null USD kept null', async () => {
    respond = respondAll;
    const res = await get('section=clientes&nivel=linea&key=Pizza&dateRange=month:2026-10&currency=bs');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ nivel: 'linea', key: 'Pizza', itemNet: { bs: 920, usd: 14 } });
    expect(body.itemReturnRate).toBeCloseTo(80 / 1000, 10);
    expect(body.top3SharePct).toBe(1);
    expect(body.rows.map((r: { id: string }) => r.id)).toEqual(['7', 'C:J001']);
    const a = body.rows[0];
    expect(a).toMatchObject({
      name: 'Casa Matriz', group: { code: 'G1', name: 'Cadenas' }, posItem: 2, posTotal: 5,
      net: { bs: 720, usd: 14 }, units: 80, orders: 4, lastOrderDate: '2026-03-01', highReturn: true,
    });
    const b = body.rows[1];
    expect(b).toMatchObject({ group: null, posTotal: 1, net: { bs: 200, usd: null }, orders: 0, overdue: null, lastOrderDate: null });
    expect(b.avgPrice.usd).toBeNull();
  });
  test('currency=usd sorts null USD last', async () => {
    respond = respondAll;
    const body = await (await get('section=clientes&nivel=linea&key=Pizza&currency=usd')).json();
    expect(body.rows[1].net.usd).toBeNull();
    expect(body.rows[1].sharePct).toBeNull();
  });
  test('query failure -> 500 and captureException', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('section=clientes&nivel=linea&key=Pizza');
    expect(res.status).toBe(500);
    expect(captured).toHaveLength(1);
  });
});
