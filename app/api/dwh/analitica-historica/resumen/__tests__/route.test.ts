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

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/analitica-historica/resumen?${qs}`));

const SALES = { SalesGrossBs: 1000, SalesGrossUsd: 100, UnitsSold: 50 };
const RETURNS = { ReturnsBs: 100, ReturnsUsd: 10, UnitsReturned: 5 };
const CUSTOMERS = { CustomersWithSales: 8, CustomersWithReturns: 2, CustomersNet: 7 };

function standard(text: string): unknown[] {
  if (text.includes('CustomersWithSales')) return [CUSTOMERS];
  if (text.includes('UnitsReturned')) return [RETURNS];
  if (text.includes('UnitsSold')) return [SALES];
  return [{ Bucket: '2025-03', SalesGrossBs: 1000, SalesGrossUsd: 100, ReturnsBs: 100, ReturnsUsd: 10 }];
}

beforeEach(() => { queries.length = 0; respond = standard; });

describe('GET /api/dwh/analitica-historica/resumen', () => {
  test('returns the kpis and the trend for a month', async () => {
    const res = await get('dateRange=month:2025-03');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.empty).toBe(false);
    expect(body.kpis.salesGross).toEqual({ bs: 1000, usd: 100 });
    expect(body.kpis.returns).toEqual({ bs: 100, usd: 10 });
    expect(body.kpis.salesNet).toEqual({ bs: 900, usd: 90 });
    expect(body.kpis.returnRate).toBeCloseTo(0.1);
    expect(body.kpis.unitsSold).toBe(50);
    expect(body.kpis.unitsReturned).toBe(5);
    expect(body.kpis.customersWithSales).toBe(8);
    expect(body.kpis.customersNet).toBe(7);
    expect(body.trend).toHaveLength(1);
    expect(body.trend[0].bucket).toBe('2025-03');
    expect(body.trend[0].salesNet).toEqual({ bs: 900, usd: 90 });
  });

  test('a period with no exchange rates keeps USD null, never 0', async () => {
    respond = text => {
      if (text.includes('CustomersWithSales')) return [CUSTOMERS];
      if (text.includes('UnitsReturned')) return [{ ReturnsBs: 100, ReturnsUsd: null, UnitsReturned: 5 }];
      if (text.includes('UnitsSold')) return [{ SalesGrossBs: 1000, SalesGrossUsd: null, UnitsSold: 50 }];
      return [{ Bucket: '2020-01', SalesGrossBs: 1000, SalesGrossUsd: null, ReturnsBs: 0, ReturnsUsd: 0 }];
    };
    const body = await (await get('dateRange=month:2020-01')).json();
    expect(body.kpis.salesGross.usd).toBeNull();
    expect(body.kpis.salesNet.usd).toBeNull();
    expect(body.trend[0].salesGross.usd).toBeNull();
  });

  test('a range outside the legacy window is empty and issues no queries', async () => {
    const res = await get('dateRange=month:2019-01');
    expect(res.status).toBe(200);
    expect((await res.json()).empty).toBe(true);
    expect(queries).toHaveLength(0);
  });

  test('queries use the legacy tables, legacy rates and exclude voided rows', async () => {
    await get('dateRange=month:2025-03');
    const all = queries.map(q => q.sql).join('\n');
    expect(all).toContain('fact.Fact_Sales_Legacy');
    expect(all).toContain('fact.Fact_Returns_Legacy');
    expect(all).toContain('fact.Fact_ExchangeRate_Legacy');
    expect(all).not.toMatch(/fact\.Fact_Sales\b(?!_Legacy)/);
    expect(all).toContain('fsl.IsVoided = 0');
    expect(all).toContain('frl.IsVoided = 0');
    expect(all).not.toContain('GETDATE');
  });

  test('returnsBasis=factura windows returns by the original factura date', async () => {
    await get('dateRange=month:2025-03&returnsBasis=factura');
    const retQueries = queries.filter(q => q.sql.includes('Fact_Returns_Legacy')).map(q => q.sql).join('\n');
    expect(retQueries).toContain('frl.OriginalInvoiceDateKey >= 20250301');
    const defaultBasis = (await (async () => { queries.length = 0; await get('dateRange=month:2025-03'); return queries.filter(q => q.sql.includes('Fact_Returns_Legacy')).map(q => q.sql).join('\n'); })());
    expect(defaultBasis).toContain('frl.DateKey >= 20250301');
  });

  test('a database error is a 500 with the standard shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('dateRange=month:2025-03');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
