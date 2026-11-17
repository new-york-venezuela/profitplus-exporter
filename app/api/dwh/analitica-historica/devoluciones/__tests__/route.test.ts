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

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/analitica-historica/devoluciones?${qs}`));

const GROUP = { GroupValue: '7', GroupLabel: 'Cliente A', SalesGrossBs: 1000, SalesGrossUsd: 100, ReturnsBs: 100, ReturnsUsd: 10, Units: 40, ReturnsUnits: 5 };
function standard(text: string): unknown[] {
  if (text.includes('CustomersWithSales')) return [{ CustomersWithSales: 8, CustomersWithReturns: 2, CustomersNet: 7, EntitiesWithSales: 4, EntitiesWithReturns: 1, EntitiesNet: 3 }];
  if (text.includes('UnitsReturned')) return [{ ReturnsBs: 100, ReturnsUsd: 10, UnitsReturned: 5 }];
  if (text.includes('UnitsSold')) return [{ SalesGrossBs: 1000, SalesGrossUsd: 100, UnitsSold: 50 }];
  return [GROUP];
}

beforeEach(() => { queries.length = 0; respond = standard; denial = null; });

describe('GET /api/dwh/analitica-historica/devoluciones', () => {
  test('passes the access gate denial through without querying', async () => {
    denial = NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    const res = await get('groupBy=cliente');
    expect(res.status).toBe(403);
    expect(queries).toHaveLength(0);
  });

  test('an unknown groupBy is a 400', async () => {
    const res = await get('dateRange=month:2025-03&groupBy=vendedor');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Parámetro groupBy inválido' });
  });

  test('returns the kpis and rows with the return rate of the same group', async () => {
    const body = await (await get('dateRange=month:2025-03&groupBy=cliente')).json();
    expect(body.empty).toBe(false);
    expect(body.kpis.returns).toEqual({ bs: 100, usd: 10 });
    expect(body.kpis.unitsReturned).toBe(5);
    expect(body.kpis.customersWithReturns).toBe(2);
    expect(body.kpis.entitiesWithReturns).toBe(1);
    expect(body.kpis.returnRate).toBeCloseTo(0.1);
    expect(body.rows[0]).toMatchObject({
      label: 'Cliente A', value: '7', returns: { bs: 100, usd: 10 }, salesGross: { bs: 1000, usd: 100 }, unitsReturned: 5,
    });
    expect(body.rows[0].returnRate).toBeCloseTo(0.1);
  });

  test('only groups that have returns are listed, biggest returns first', async () => {
    await get('dateRange=month:2025-03&groupBy=cliente');
    const grouped = queries.find(q => q.sql.includes('GroupKey'))!.sql;
    expect(grouped).toContain('r.GroupKey IS NOT NULL');
    expect(grouped).toMatch(/ORDER BY ISNULL\(r\.ReturnsBs, 0\) DESC/);
  });

  test('a missing exchange rate keeps USD null, never 0', async () => {
    respond = text => {
      if (text.includes('CustomersWithSales')) return [{ CustomersWithSales: 1, CustomersWithReturns: 1, CustomersNet: 1 }];
      if (text.includes('UnitsReturned')) return [{ ReturnsBs: 100, ReturnsUsd: null, UnitsReturned: 5 }];
      if (text.includes('UnitsSold')) return [{ SalesGrossBs: 1000, SalesGrossUsd: null, UnitsSold: 50 }];
      return [{ ...GROUP, ReturnsUsd: null, SalesGrossUsd: null }];
    };
    const body = await (await get('dateRange=month:2020-01&groupBy=sku')).json();
    expect(body.kpis.returns.usd).toBeNull();
    expect(body.rows[0].returns.usd).toBeNull();
  });

  test('returnsBasis=factura windows returns by the original factura date and never filters on HasInvoiceLink', async () => {
    await get('dateRange=month:2025-03&groupBy=cliente&returnsBasis=factura');
    const all = queries.map(q => q.sql).join('\n');
    expect(all).toContain('frl.OriginalInvoiceDateKey >= 20250301');
    expect(all).not.toContain('HasInvoiceLink');
  });

  test('default basis windows returns by the devolución date', async () => {
    await get('dateRange=month:2025-03&groupBy=cliente');
    expect(queries.map(q => q.sql).join('\n')).toContain('frl.DateKey >= 20250301');
  });

  test('cliente rolls stores up to their casa matriz by default, per store with clienteDimension=tienda', async () => {
    await get('dateRange=month:2025-03&groupBy=cliente');
    expect(queries.find(q => q.sql.includes('GroupKey'))!.sql).toContain('Dim_LegalEntity_Legacy');
    queries.length = 0;
    await get('dateRange=month:2025-03&groupBy=cliente&clienteDimension=tienda');
    expect(queries.find(q => q.sql.includes('GroupKey'))!.sql).not.toContain('Dim_LegalEntity_Legacy');
  });

  test('sku groups every product (no línea filter)', async () => {
    await get('dateRange=month:2025-03&groupBy=sku');
    expect(queries.find(q => q.sql.includes('GroupKey'))!.sql).not.toContain('@parentValue');
  });

  test('an empty range is empty and issues no query', async () => {
    const body = await (await get('dateRange=month:2019-01&groupBy=cliente')).json();
    expect(body).toMatchObject({ empty: true, kpis: null, rows: [] });
    expect(queries).toHaveLength(0);
  });

  test('a database error is a 500 with the standard shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('dateRange=month:2025-03&groupBy=cliente');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
