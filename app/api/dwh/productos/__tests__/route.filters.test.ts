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

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/productos?${qs}`));
beforeEach(() => { queries.length = 0; respond = () => []; });

describe('GET /api/dwh/productos category filter', () => {
  test('the drill filters sales AND the returns subquery by the bound category', async () => {
    const res = await get('dateRange=month:2026-10&groupBy=linea&categoria=Fresco');
    expect(res.status).toBe(200);
    expect(queries[0].sql).toContain('p.CategoryName = @categoria');
    expect(queries[0].sql).toContain('pr.CategoryName = @categoria');
    expect(queries[0].inputs.categoria).toBe('Fresco');
  });
  test('a hostile category string is only ever a parameter value', async () => {
    const hostile = "Fresco' OR 1=1 --";
    await get(`dateRange=month:2026-10&groupBy=linea&categoria=${encodeURIComponent(hostile)}`);
    expect(queries[0].sql).not.toContain('OR 1=1');
    expect(queries[0].inputs.categoria).toBe(hostile);
  });
  test('an over-long or empty category is ignored', async () => {
    await get(`groupBy=linea&categoria=${'x'.repeat(61)}`);
    expect(queries[0].sql).not.toContain('@categoria');
    queries.length = 0;
    await get('groupBy=linea&categoria=');
    expect(queries[0].sql).not.toContain('@categoria');
  });
  test('sublinea drill keeps linea and category bound together', async () => {
    await get('groupBy=sublinea&linea=Panaderia&categoria=Congelado');
    expect(queries[0].inputs).toMatchObject({ linea: 'Panaderia', categoria: 'Congelado' });
  });
  test('stacked chart and presence table honor the category; the presence denominator does not', async () => {
    respond = text => (text.includes('TotalClients') ? [{ TotalClients: 10, TotalStores: 12 }] : []);
    await get('section=profundidad&categoria=Fresco&dateRange=month:2026-10');
    const rowsQuery = queries.find(q => q.sql.includes('ClientCount'))!;
    const totalsQuery = queries.find(q => q.sql.includes('TotalClients'))!;
    expect(rowsQuery.sql).toContain('p.CategoryName = @categoria');
    expect(totalsQuery.sql).not.toContain('CategoryName');
    queries.length = 0;
    await get('section=porLineaMes&categoria=Fresco&dateRange=month:2026-10');
    expect(queries.every(q => q.sql.includes('p.CategoryName = @categoria'))).toBe(true);
  });
});

describe('GET /api/dwh/productos section=profundidad tier', () => {
  test('rows carry the tier derived from client penetration', async () => {
    respond = text => (text.includes('TotalClients')
      ? [{ TotalClients: 10, TotalStores: 12 }]
      : [
        { Sku: 'Pan Baguette', ClientCount: 8, StoreCount: 9, MonthCount: 1, SalesGrossBs: 1000, SalesGrossUsd: 20, QuantitySold: 100, ReturnsNetBs: 10 },
        { Sku: 'Pizza', ClientCount: 4, StoreCount: 5, MonthCount: 1, SalesGrossBs: 500, SalesGrossUsd: 10, QuantitySold: 50, ReturnsNetBs: 0 },
        { Sku: 'Rara', ClientCount: 1, StoreCount: 1, MonthCount: 1, SalesGrossBs: 50, SalesGrossUsd: null, QuantitySold: 5, ReturnsNetBs: 0 },
      ]);
    const body = await (await get('section=profundidad&dateRange=month:2026-10')).json();
    expect(body.rows.map((r: { sku: string; tier: string }) => [r.sku, r.tier])).toEqual([
      ['Pan Baguette', 'primera'], ['Pizza', 'segunda'], ['Rara', 'addon'],
    ]);
  });
});

describe('GET /api/dwh/productos section=grupos', () => {
  test('returns the share matrix for the drill level and binds category and tienda', async () => {
    respond = () => [
      { Label: 'Panaderia', GroupCode: 'S1', GroupName: 'Abasto', SalesBs: 3500, SalesUsd: 70 },
      { Label: 'Panaderia', GroupCode: null, GroupName: null, SalesBs: 300, SalesUsd: null },
    ];
    const res = await get('section=grupos&groupBy=linea&dateRange=month:2026-10&categoria=Congelado&tienda=7');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.level).toBe('linea');
    expect(body.columns.map((c: { name: string }) => c.name)).toEqual(['Abasto', 'Sin grupo']);
    expect(body.rows[0].cells.S1.share).toBeCloseTo(3500 / 3800, 8);
    expect(queries[0].sql).toContain('cur.IsCurrent = 1');
    expect(queries[0].inputs).toMatchObject({ categoria: 'Congelado', tiendaKey: 7 });
  });
  test('sublinea without linea falls back to the linea level (no @linea in the SQL)', async () => {
    const body = await (await get('section=grupos&groupBy=sublinea&dateRange=month:2026-10')).json();
    expect(body.level).toBe('linea');
    expect(queries[0].sql).not.toContain('@linea');
  });
  test('sku level binds linea and sublinea', async () => {
    await get('section=grupos&groupBy=sku&linea=Panaderia&sublinea=Artesanal&dateRange=month:2026-10');
    expect(queries[0].inputs).toMatchObject({ linea: 'Panaderia', sublinea: 'Artesanal' });
  });
  test('an empty result is an empty matrix, not an error', async () => {
    const body = await (await get('section=grupos&groupBy=linea')).json();
    expect(body).toMatchObject({ columns: [], rows: [], level: 'linea' });
  });
});

describe('GET /api/dwh/productos?categorias=1', () => {
  test('lists the distinct current categories', async () => {
    respond = () => [{ Name: 'Congelado' }, { Name: 'Fresco' }];
    const body = await (await get('categorias=1')).json();
    expect(body).toEqual({ categorias: ['Congelado', 'Fresco'] });
  });
  test('a database error is a 500 with the standard shape', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('categorias=1');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
  });
});
