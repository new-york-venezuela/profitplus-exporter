import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';

interface Captured { sql: string; inputs: Record<string, unknown> }
const queries: Captured[] = [];
let respond: (text: string) => unknown[] = () => [];
let denial: NextResponse | null = null;
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
  requireDwhAccess: async () => (denial ? { ok: false, response: denial } : { ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/analitica-historica/ventas?${qs}`));
const row = (over: Record<string, unknown> = {}) => ({
  GroupValue: '7', GroupLabel: 'Cliente A',
  SalesGrossBs: 1000, SalesGrossUsd: 100, ReturnsBs: 100, ReturnsUsd: 10, Units: 40,
  ...over,
});

beforeEach(() => { queries.length = 0; respond = () => [row()]; denial = null; });

describe('GET /api/dwh/analitica-historica/ventas', () => {
  test('passes the access gate denial through without querying', async () => {
    denial = NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const res = await get('groupBy=cliente');
    expect(res.status).toBe(401);
    expect(queries).toHaveLength(0);
  });

  test('an unknown groupBy is a 400 with the standard error shape', async () => {
    const res = await get('dateRange=month:2025-03&groupBy=bogus');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Parámetro groupBy inválido' });
    expect(queries).toHaveLength(0);
  });

  test('cliente rows carry gross, returns, net, rate and units', async () => {
    const body = await (await get('dateRange=month:2025-03&groupBy=cliente')).json();
    expect(body.groupBy).toBe('cliente');
    expect(body.rows[0]).toMatchObject({
      label: 'Cliente A', value: '7',
      salesGross: { bs: 1000, usd: 100 }, returns: { bs: 100, usd: 10 }, salesNet: { bs: 900, usd: 90 }, units: 40,
    });
    expect(body.rows[0].returnRate).toBeCloseTo(0.1);
  });

  test('a customer with only returns shows a negative net', async () => {
    respond = () => [row({ SalesGrossBs: 0, SalesGrossUsd: 0, ReturnsBs: 50, ReturnsUsd: 5, Units: 0 })];
    const body = await (await get('dateRange=month:2025-03&groupBy=cliente')).json();
    expect(body.rows[0].salesNet).toEqual({ bs: -50, usd: -5 });
    expect(body.rows[0].returnRate).toBeNull();
  });

  test('missing exchange rates keep USD null', async () => {
    respond = () => [row({ SalesGrossUsd: null, ReturnsUsd: null })];
    const body = await (await get('dateRange=month:2020-01&groupBy=cliente')).json();
    expect(body.rows[0].salesGross.usd).toBeNull();
    expect(body.rows[0].salesNet.usd).toBeNull();
  });

  test('linea groups a null line into SIN_LINEA', async () => {
    await get('dateRange=month:2025-03&groupBy=linea');
    expect(queries[0].sql).toContain("ISNULL(p.LineCode, 'SIN_LINEA')");
  });

  test('vendedor groups a null seller as "Sin vendedor"', async () => {
    await get('dateRange=month:2025-03&groupBy=vendedor');
    expect(queries[0].sql).toContain("'Sin vendedor'");
  });

  test('producto drills into one línea through a bound parameter', async () => {
    await get('dateRange=month:2025-03&groupBy=producto&parentValue=SIN_LINEA');
    expect(queries[0].inputs).toMatchObject({ parentValue: 'SIN_LINEA' });
    expect(queries[0].sql).toContain('@parentValue');
    expect(queries[0].sql).not.toContain('SIN_LINEA\'  OR');
  });

  test('producto without parentValue is a 400', async () => {
    const res = await get('dateRange=month:2025-03&groupBy=producto');
    expect(res.status).toBe(400);
  });

  test('mes buckets follow the granularity and are labelled', async () => {
    respond = () => [{ GroupValue: '2025-03', GroupLabel: '2025-03', SalesGrossBs: 10, SalesGrossUsd: 1, ReturnsBs: 0, ReturnsUsd: 0, Units: 1 }];
    const body = await (await get('dateRange=custom:2025-01-01:2025-12-31&groupBy=mes&granularity=month')).json();
    expect(body.rows[0].value).toBe('2025-03');
    expect(body.rows[0].label).not.toBe('2025-03');
  });

  test('queries use only legacy tables and rates, exclude voided rows and honour the returns basis', async () => {
    await get('dateRange=month:2025-03&groupBy=cliente&returnsBasis=factura');
    const sql = queries[0].sql;
    expect(sql).toContain('fact.Fact_ExchangeRate_Legacy');
    expect(sql).toContain('fsl.IsVoided = 0');
    expect(sql).toContain('frl.IsVoided = 0');
    expect(sql).toContain('frl.OriginalInvoiceDateKey >= 20250301');
    expect(sql).not.toContain('GETDATE');
  });

  test('an empty range returns no rows and issues no query', async () => {
    const body = await (await get('dateRange=month:2019-01&groupBy=cliente')).json();
    expect(body.rows).toEqual([]);
    expect(queries).toHaveLength(0);
  });

  test('a database error is a 500 with the standard shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('dateRange=month:2025-03&groupBy=cliente');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
