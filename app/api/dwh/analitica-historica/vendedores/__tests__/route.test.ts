import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';
import { histKpiQueries } from '@/lib/analitica-historica/kpis';

interface Captured { sql: string; inputs: Record<string, unknown> }
const queries: Captured[] = [];
let respond: (text: string) => unknown[] = () => [];
let denial: NextResponse | null = null;
function makeRequest() {
  const inputs: Record<string, unknown> = {};
  const req = {
    input(name: string, a: unknown, b?: unknown) { inputs[name] = b === undefined ? a : b; return req; },
    async query(text: string) { queries.push({ sql: text, inputs: { ...inputs } }); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => (denial ? { ok: false, response: denial } : { ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/analitica-historica/vendedores?${qs}`));

const grp = (over: Record<string, unknown> = {}) => ({
  GroupValue: '3', GroupLabel: 'Ana', SalesGrossBs: 600, SalesGrossUsd: 60, ReturnsBs: 60, ReturnsUsd: 6, Units: 30, ReturnsUnits: 3, ...over,
});
let groups: Record<string, unknown>[] = [];
let sellerCustomers: Record<string, unknown>[] = [];
function standard(text: string): unknown[] {
  if (text.includes('CustomersWithSales')) return [{ CustomersWithSales: 9, CustomersWithReturns: 2, CustomersNet: 8 }];
  if (text.includes('UnitsReturned')) return [{ ReturnsBs: 100, ReturnsUsd: 10, UnitsReturned: 5 }];
  if (text.includes('FULL OUTER JOIN') && text.includes('GroupKey')) return groups;
  if (text.includes('AS Customers')) return sellerCustomers;
  if (text.includes('UnitsSold')) return [{ SalesGrossBs: 1000, SalesGrossUsd: 100, UnitsSold: 50 }];
  return [{ Bucket: '2025-03', SalesGrossBs: 1000, SalesGrossUsd: 100, ReturnsBs: 100, ReturnsUsd: 10 }];
}

beforeEach(() => {
  queries.length = 0;
  groups = [grp(), grp({ GroupValue: '0', GroupLabel: 'Sin vendedor', SalesGrossBs: 400, SalesGrossUsd: 40, ReturnsBs: 40, ReturnsUsd: 4, Units: 20, ReturnsUnits: 2 })];
  sellerCustomers = [{ GroupKey: '3', Customers: 6 }, { GroupKey: '0', Customers: 4 }];
  respond = standard;
  denial = null;
});

describe('GET /api/dwh/analitica-historica/vendedores', () => {
  test('passes the access gate denial through without querying', async () => {
    denial = NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    expect((await get('dateRange=month:2025-03')).status).toBe(403);
    expect(queries).toHaveLength(0);
  });

  test('lists sellers with net, rate, units and customers served', async () => {
    const body = await (await get('dateRange=month:2025-03')).json();
    expect(body.empty).toBe(false);
    expect(body.rows[0]).toMatchObject({
      salesRepKey: 3, label: 'Ana', salesGross: { bs: 600, usd: 60 }, returns: { bs: 60, usd: 6 },
      salesNet: { bs: 540, usd: 54 }, units: 30, customersServed: 6,
    });
    expect(body.rows[0].returnRate).toBeCloseTo(0.1);
  });

  test('a null seller is "Sin vendedor" with a null key so the totals still reconcile', async () => {
    const body = await (await get('dateRange=month:2025-03')).json();
    const none = body.rows.find((r: { label: string }) => r.label === 'Sin vendedor');
    expect(none.salesRepKey).toBeNull();
    expect(none.customersServed).toBe(4);
    const sum = body.rows.reduce((s: number, r: { salesGross: { bs: number } }) => s + r.salesGross.bs, 0);
    expect(sum).toBe(body.total.salesGross.bs);
  });

  test('the total comes from the same queries as Resumen', async () => {
    await get('dateRange=month:2025-03&returnsBasis=factura');
    const expected = histKpiQueries({ startKey: 20250301, endKey: 20250331 }, 'factura');
    const issued = queries.map(q => q.sql);
    expect(issued).toContain(expected.salesTotalsSql);
    expect(issued).toContain(expected.returnsTotalsSql);
    expect(issued).toContain(expected.customersSql);
  });

  test('the total carries customers served, units and rate', async () => {
    const body = await (await get('dateRange=month:2025-03')).json();
    expect(body.total).toMatchObject({ salesGross: { bs: 1000, usd: 100 }, returns: { bs: 100, usd: 10 }, salesNet: { bs: 900, usd: 90 }, units: 50, customersServed: 9 });
    expect(body.total.returnRate).toBeCloseTo(0.1);
  });

  test('missing exchange rates keep USD null', async () => {
    groups = [grp({ SalesGrossUsd: null, ReturnsUsd: null })];
    const body = await (await get('dateRange=month:2020-01')).json();
    expect(body.rows[0].salesGross.usd).toBeNull();
    expect(body.rows[0].salesNet.usd).toBeNull();
  });

  test('the trend covers everyone by default', async () => {
    const body = await (await get('dateRange=month:2025-03')).json();
    expect(body.trend).toHaveLength(1);
    expect(body.trend[0].salesNet).toEqual({ bs: 900, usd: 90 });
    const trendQ = queries.find(q => q.sql.includes('Bucket'))!;
    expect(trendQ.sql).not.toContain('@salesRepKey');
  });

  test('salesRepKey narrows the trend through a bound parameter (0 = sin vendedor)', async () => {
    await get('dateRange=month:2025-03&salesRepKey=3');
    const trendQ = queries.find(q => q.sql.includes('Bucket'))!;
    expect(trendQ.sql).toContain('@salesRepKey');
    expect(trendQ.inputs).toMatchObject({ salesRepKey: 3 });
    queries.length = 0;
    await get('dateRange=month:2025-03&salesRepKey=0');
    expect(queries.find(q => q.sql.includes('Bucket'))!.inputs).toMatchObject({ salesRepKey: 0 });
  });

  test('a non-numeric salesRepKey is a 400', async () => {
    const res = await get("dateRange=month:2025-03&salesRepKey=3;DROP");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Parámetro salesRepKey inválido' });
    expect(queries).toHaveLength(0);
  });

  test('queries use only legacy tables and rates and exclude voided rows', async () => {
    await get('dateRange=month:2025-03');
    const all = queries.map(q => q.sql).join('\n');
    expect(all).toContain('fact.Fact_Sales_Legacy');
    expect(all).toContain('fact.Fact_ExchangeRate_Legacy');
    expect(all).toContain('fsl.IsVoided = 0');
    expect(all).not.toContain('GETDATE');
  });

  test('an empty range is empty and issues no query', async () => {
    const body = await (await get('dateRange=month:2019-01')).json();
    expect(body).toMatchObject({ empty: true, rows: [], total: null, trend: [] });
    expect(queries).toHaveLength(0);
  });

  test('a database error is a 500 with the standard shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('dateRange=month:2025-03');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
