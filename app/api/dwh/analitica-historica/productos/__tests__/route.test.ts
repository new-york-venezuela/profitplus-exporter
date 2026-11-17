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
    async query(text: string) { queries.push({ sql: text, inputs: { ...inputs } }); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => (denial ? { ok: false, response: denial } : { ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/analitica-historica/productos?${qs}`));
const sale = (over: Record<string, unknown> = {}) => ({
  Key: 'PAN', Label: 'Panadería', Code: null, Linea: 'Panadería', Sublinea: '',
  Units: 100, SalesGrossBs: 1000, SalesGrossUsd: 100, MonthCount: 2, ClientCount: 5, PosCount: 5, ...over,
});
const ret = (over: Record<string, unknown> = {}) => ({
  Key: 'PAN', Label: 'Panadería', Code: null, Linea: 'Panadería', Sublinea: '', ReturnsBs: 100, ReturnsUsd: 10, ...over,
});
let salesRows: Record<string, unknown>[] = [];
let returnRows: Record<string, unknown>[] = [];
function standard(text: string): unknown[] {
  if (text.includes('DISTINCT') && !text.includes('GROUP BY')) return [{ Linea: 'Panadería', Sublinea: 'Pan' }, { Linea: 'Sin línea', Sublinea: 'Sin sublínea' }];
  if (text.includes('Fact_Returns_Legacy')) return returnRows;
  return salesRows;
}

beforeEach(() => { queries.length = 0; salesRows = [sale()]; returnRows = [ret()]; respond = standard; denial = null; });

describe('GET /api/dwh/analitica-historica/productos', () => {
  test('passes the access gate denial through without querying', async () => {
    denial = NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    expect((await get('section=catalogo')).status).toBe(401);
    expect(queries).toHaveLength(0);
  });

  test('a missing or unknown section is a 400', async () => {
    for (const qs of ['dateRange=month:2025-03', 'section=bogus&dateRange=month:2025-03']) {
      const res = await get(qs);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Parámetro section inválido' });
    }
  });

  test('catalogo maps a row with net, rate, average price, share and class', async () => {
    const body = await (await get('section=catalogo&dateRange=custom:2020-01-01:2020-03-31')).json();
    expect(body.nivel).toBe('linea');
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      key: 'PAN', label: 'Panadería', linea: 'Panadería', units: 100,
      salesGross: { bs: 1000, usd: 100 }, returns: { bs: 100, usd: 10 }, salesNet: { bs: 900, usd: 90 },
      monthCount: 2, avgUnitsPerMonth: 50, avgPrice: { bs: 10, usd: 1 }, clientCount: 5, posCount: 5, pareto: 'A',
    });
    expect(body.rows[0].returnRate).toBeCloseTo(0.1);
    expect(body.rows[0].sharePct).toBeCloseTo(1);
  });

  test('a product with only returns in range is listed with a negative net and class C', async () => {
    salesRows = [sale()];
    returnRows = [ret(), ret({ Key: 'X1', Label: 'Solo dev', ReturnsBs: 30, ReturnsUsd: 3 })];
    const body = await (await get('section=catalogo&dateRange=month:2025-03&nivel=sku')).json();
    const only = body.rows.find((r: { key: string }) => r.key === 'X1');
    expect(only.salesNet).toEqual({ bs: -30, usd: -3 });
    expect(only.pareto).toBe('C');
    expect(only.units).toBe(0);
    expect(only.returnRate).toBeNull();
    expect(only.sharePct).toBeLessThan(0);
  });

  test('trendPct is null when the previous period would start before the window', async () => {
    const body = await (await get('section=catalogo&dateRange=custom:2020-01-01:2020-03-31')).json();
    expect(body.rows[0].prevNet).toBeNull();
    expect(body.rows[0].trendPct).toBeNull();
    expect(queries.filter(q => q.sql.includes('Fact_Sales_Legacy'))).toHaveLength(1);
  });

  test('trendPct compares net against the previous equal period when one exists', async () => {
    let call = 0;
    respond = text => {
      if (text.includes('Fact_Returns_Legacy')) return returnRows;
      call += 1;
      return call === 1 ? [sale()] : [sale({ SalesGrossBs: 500, SalesGrossUsd: 50 })];
    };
    returnRows = [];
    const body = await (await get('section=catalogo&dateRange=month:2025-03')).json();
    expect(body.rows[0].prevNet).toEqual({ bs: 500, usd: 50 });
    expect(body.rows[0].trendPct).toBeCloseTo(1); // 1000 vs 500 => +100%
  });

  test('a missing exchange rate keeps USD null', async () => {
    salesRows = [sale({ SalesGrossUsd: null })];
    returnRows = [ret({ ReturnsUsd: null })];
    const body = await (await get('section=catalogo&dateRange=month:2020-02&currency=usd')).json();
    expect(body.rows[0].salesGross.usd).toBeNull();
    expect(body.rows[0].salesNet.usd).toBeNull();
    expect(body.rows[0].pareto).toBeNull();
  });

  test('línea, sublínea and q filters are bound parameters; the customer-group filter is never applied', async () => {
    await get("section=catalogo&dateRange=month:2025-03&lineas=Panadería&sublineas=Pan&q=50%25_x'--&grupo=S1");
    const sales = queries.find(q => q.sql.includes('Fact_Sales_Legacy'))!;
    expect(sales.sql).toContain('@linea0');
    expect(sales.sql).toContain('@sublinea0');
    expect(sales.sql).toContain('LIKE @q');
    expect(sales.sql).not.toContain('@grupo');
    expect(sales.inputs).toMatchObject({ linea0: 'Panadería', sublinea0: 'Pan', q: "%50\\%\\_x'--%" });
    expect(sales.sql).not.toContain("x'--");
  });

  test('categoria is a bound parameter on both sides', async () => {
    await get('section=catalogo&dateRange=month:2025-03&categoria=Fresco');
    for (const q of queries) {
      expect(q.sql).toContain('@categoria');
      expect(q.inputs).toMatchObject({ categoria: 'Fresco' });
    }
  });

  test('a null línea groups as "Sin línea" and the queries use only legacy tables, rates and non-voided rows', async () => {
    await get('section=catalogo&dateRange=month:2025-03&returnsBasis=factura');
    const all = queries.map(q => q.sql).join('\n');
    expect(all).toContain("ISNULL(p.LineName, 'Sin línea')");
    expect(all).toContain('fact.Fact_ExchangeRate_Legacy');
    expect(all).toContain('fsl.IsVoided = 0');
    expect(all).toContain('frl.IsVoided = 0');
    expect(all).toContain('frl.OriginalInvoiceDateKey >= 20250301');
    expect(all).not.toContain('GETDATE');
  });

  test('filtros lists líneas, sublíneas and categorías', async () => {
    respond = text => (text.includes('CategoryName') && !text.includes('LineName') ? [{ Categoria: 'Fresco' }] : [{ Linea: 'Panadería', Sublinea: 'Pan' }]);
    const body = await (await get('section=filtros')).json();
    expect(body.lineas).toEqual(['Panadería']);
    expect(body.sublineas).toEqual([{ linea: 'Panadería', sublinea: 'Pan' }]);
    expect(body.categorias).toEqual(['Fresco']);
  });

  test('an empty range returns no rows and issues no query', async () => {
    const body = await (await get('section=catalogo&dateRange=month:2019-01')).json();
    expect(body.rows).toEqual([]);
    expect(queries).toHaveLength(0);
  });

  test('a database error is a 500 with the standard shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('section=catalogo&dateRange=month:2025-03');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
