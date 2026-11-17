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

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/analitica-historica/clientes?${qs}`));
const rec = (over: Record<string, unknown> = {}) => ({
  CustomerLegacyKey: 1, CustomerCode: 'C001  ', CustomerName: 'Cliente A',
  FirstKey: 20200315, LastKey: 20250310, Invoices: 4,
  SalesGrossBs: 1000, SalesGrossUsd: 100, ReturnsBs: 100, ReturnsUsd: 10, Units: 40, InRange: 1,
  ...over,
});

beforeEach(() => { queries.length = 0; respond = () => [rec()]; denial = null; });

describe('GET /api/dwh/analitica-historica/clientes', () => {
  test('passes the access gate denial through without querying', async () => {
    denial = NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const res = await get('dateRange=month:2025-03');
    expect(res.status).toBe(401);
    expect(queries).toHaveLength(0);
  });

  test('maps a customer row with trimmed code, net, rate, share and status', async () => {
    const body = await (await get('dateRange=month:2025-03')).json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      customerKey: 1, code: 'C001', name: 'Cliente A', firstInvoiceKey: 20200315, lastInvoiceKey: 20250310,
      invoices: 4, salesGross: { bs: 1000, usd: 100 }, returns: { bs: 100, usd: 10 }, salesNet: { bs: 900, usd: 90 },
      units: 40, status: 'activo', pareto: 'A',
    });
    expect(body.rows[0].returnRate).toBeCloseTo(0.1);
    expect(body.rows[0].sharePct).toBeCloseTo(1);
  });

  test('a customer with only returns in range is listed with a negative net, negative share and class C', async () => {
    respond = () => [
      rec(),
      rec({ CustomerLegacyKey: 2, CustomerCode: 'C002', CustomerName: 'Solo dev', Invoices: 0, SalesGrossBs: 0, SalesGrossUsd: 0, ReturnsBs: 50, ReturnsUsd: 5, Units: 0, InRange: 0 }),
    ];
    const body = await (await get('dateRange=month:2025-03')).json();
    const only = body.rows.find((r: { customerKey: number }) => r.customerKey === 2);
    expect(only.salesNet).toEqual({ bs: -50, usd: -5 });
    expect(only.sharePct).toBeLessThan(0);
    expect(only.pareto).toBe('C');
    expect(only.status).toBe('sin_compras');
    expect(only.returnRate).toBeNull();
  });

  test('a customer who bought only outside the range is "sin_compras" with zero amounts', async () => {
    respond = () => [rec({ Invoices: 0, SalesGrossBs: 0, SalesGrossUsd: 0, ReturnsBs: 0, ReturnsUsd: 0, Units: 0, InRange: 0 })];
    const body = await (await get('dateRange=month:2025-03')).json();
    expect(body.rows[0].status).toBe('sin_compras');
    expect(body.rows[0].salesNet).toEqual({ bs: 0, usd: 0 });
    expect(body.rows[0].sharePct).toBeNull();
  });

  test('missing exchange rates keep USD null', async () => {
    respond = () => [rec({ SalesGrossUsd: null, ReturnsUsd: null })];
    const body = await (await get('dateRange=month:2020-01')).json();
    expect(body.rows[0].salesGross.usd).toBeNull();
    expect(body.rows[0].salesNet.usd).toBeNull();
  });

  test('q is bound as an escaped LIKE parameter, never concatenated', async () => {
    await get("dateRange=month:2025-03&q=50%25_off'; DROP TABLE x;--");
    const q = queries[0];
    expect(q.sql).toContain('LIKE @q');
    expect(q.sql).toContain("ESCAPE '\\'");
    expect(q.sql).not.toContain('DROP TABLE');
    expect(q.inputs.q).toBe("%50\\%\\_off'; DROP TABLE x;--%");
  });

  test('no q: no LIKE and no input', async () => {
    await get('dateRange=month:2025-03');
    expect(queries[0].sql).not.toContain('LIKE @q');
    expect(queries[0].inputs).toEqual({});
  });

  test('uses legacy tables and rates, excludes voided rows, honours the returns basis', async () => {
    await get('dateRange=month:2025-03&returnsBasis=factura');
    const sql = queries[0].sql;
    expect(sql).toContain('fact.Fact_Sales_Legacy');
    expect(sql).toContain('fact.Fact_ExchangeRate_Legacy');
    expect(sql).toContain('fsl.IsVoided = 0');
    expect(sql).toContain('frl.OriginalInvoiceDateKey >= 20250301');
    expect(sql).not.toContain('GETDATE');
  });

  test('an empty range returns no rows and issues no query', async () => {
    const body = await (await get('dateRange=month:2019-01')).json();
    expect(body).toEqual({ empty: true, rows: [] });
    expect(queries).toHaveLength(0);
  });

  test('a database error is a 500 with the standard shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('dateRange=month:2025-03');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
