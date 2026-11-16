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
  const salesQ = () => queries.find(q => q.sql.includes('fact.Fact_Sales'))!;
  test('catalogo filters sales AND returns by the bound category', async () => {
    const res = await get('section=catalogo&nivel=linea&dateRange=month:2026-10&categoria=Fresco');
    expect(res.status).toBe(200);
    expect(salesQ().sql).toContain('p.CategoryName = @categoria');
    expect(queries.find(q => q.sql.includes('fact.Fact_Returns'))!.sql).toContain('pr.CategoryName = @categoria');
    expect(salesQ().inputs.categoria).toBe('Fresco');
  });
  test('a hostile category string is only ever a parameter value', async () => {
    const hostile = "Fresco' OR 1=1 --";
    await get(`section=catalogo&dateRange=month:2026-10&categoria=${encodeURIComponent(hostile)}`);
    for (const q of queries) expect(q.sql).not.toContain('OR 1=1');
    expect(salesQ().inputs.categoria).toBe(hostile);
  });
  test('an over-long or empty category is ignored', async () => {
    await get(`section=catalogo&categoria=${'x'.repeat(61)}`);
    expect(salesQ().sql).not.toContain('@categoria');
    queries.length = 0;
    await get('section=catalogo&categoria=');
    expect(salesQ().sql).not.toContain('@categoria');
  });
  test('the stacked chart honors the category', async () => {
    await get('section=porLineaMes&categoria=Fresco&dateRange=month:2026-10');
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every(q => q.sql.includes('p.CategoryName = @categoria'))).toBe(true);
  });
});

describe('GET /api/dwh/productos without a known section', () => {
  test('the removed default drill and section=profundidad are a 400, with no query run', async () => {
    for (const qs of ['dateRange=month:2026-10', 'groupBy=sku&linea=Panaderia&sublinea=Artesanal', 'section=profundidad']) {
      const res = await get(qs);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Sección no válida' });
    }
    expect(queries).toHaveLength(0);
  });
});

describe('GET /api/dwh/productos section=grupos', () => {
  test('returns the share matrix for the drill level and binds category and tienda', async () => {
    respond = () => [
      { Label: 'Panaderia', GroupCode: 'S1', GroupName: 'Abasto', SalesBs: 3500, SalesUsd: 70, Units: 35 },
      { Label: 'Panaderia', GroupCode: null, GroupName: null, SalesBs: 300, SalesUsd: null, Units: 15 },
    ];
    const res = await get('section=grupos&groupBy=linea&dateRange=month:2026-10&categoria=Congelado&tienda=J123');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.level).toBe('linea');
    expect(body.columns.map((c: { name: string }) => c.name)).toEqual(['Abasto', 'Sin grupo']);
    expect(body.rows[0].cells.S1.share).toBeCloseTo(3500 / 3800, 8);
    expect(body.rows[0].cells.S1.unitShare).toBeCloseTo(35 / 50, 8);
    expect(body.rows[0].totalUnits).toBe(50);
    expect(queries[0].sql).toContain('SUM(fs.QuantitySold) AS Units');
    expect(queries[0].sql).toContain('cur.IsCurrent = 1');
    expect(queries[0].inputs).toMatchObject({ categoria: 'Congelado', tiendaCode: 'J123' });
  });
  test('nivel is an alias of groupBy and item filters are bound, not interpolated', async () => {
    const body = await (await get('section=grupos&nivel=sublinea&lineas=Panaderia&grupo=S1&dateRange=month:2026-10')).json();
    expect(body.level).toBe('sublinea');
    expect(queries[0].sql).toContain('@linea0');
    expect(queries[0].inputs).toMatchObject({ linea0: 'Panaderia', grupo: 'S1' });
  });
  test('sku level binds the line and subline filters', async () => {
    await get('section=grupos&groupBy=sku&lineas=Panaderia&sublineas=Artesanal&dateRange=month:2026-10');
    expect(queries[0].inputs).toMatchObject({ linea0: 'Panaderia', sublinea0: 'Artesanal' });
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

describe('GET /api/dwh/productos?tiendas=1', () => {
  test('lists each customer once by CustomerCode, named by its current row', async () => {
    respond = text => (text.includes('CustomerCode') && !text.includes('LegalEntityName') ? [{ CustomerCode: 'J123  ', CustomerName: 'Tienda Uno' }] : []);
    const body = await (await get('tiendas=1')).json();
    expect(body.tiendas).toEqual([{ value: 't:J123', label: 'Tienda Uno', group: 'Tiendas' }]);
    const q = queries.find(x => !x.sql.includes('LegalEntityName'))!;
    expect(q.sql).toContain('IsCurrent = 1');
    expect(q.sql).not.toMatch(/GROUP BY c\.CustomerKey/);
  });
  test('lists casas matriz first, with store count label and prefixed values', async () => {
    respond = text => (text.includes('LegalEntityName')
      ? [{ LegalEntityKey: 7, LegalEntityName: 'Matriz Uno', StoreCount: 4 }]
      : [{ CustomerCode: 'J123  ', CustomerName: 'Tienda Uno' }]);
    const body = await (await get('tiendas=1')).json();
    expect(body.tiendas).toEqual([
      { value: 'e:7', label: 'Matriz Uno · 4 tiendas', group: 'Casas matriz' },
      { value: 't:J123', label: 'Tienda Uno', group: 'Tiendas' },
    ]);
    const eq = queries.find(x => x.sql.includes('LegalEntityName'))!;
    expect(eq.sql).toContain('StoreCount > 1');
  });
  test('tienda=t:J123 binds the store code like the bare form', async () => {
    await get('section=porLineaMes&tienda=t:J123&dateRange=month:2026-10');
    expect(queries[0].inputs).toMatchObject({ tiendaCode: 'J123' });
  });
  test('tienda=e:7 filters by legal entity on porLineaMes and grupos', async () => {
    await get('section=porLineaMes&tienda=e:7&dateRange=month:2026-10');
    expect(queries[0].sql).toContain('LegalEntityKey = @entidadKey');
    expect(queries[0].inputs).toMatchObject({ entidadKey: 7 });
    queries.length = 0;
    await get('section=grupos&groupBy=linea&tienda=e:7&dateRange=month:2026-10');
    expect(queries[0].sql).toContain('LegalEntityKey = @entidadKey');
    expect(queries[0].inputs).toMatchObject({ entidadKey: 7 });
  });
  test('tienda=e:7 reaches the catalogo returns SQL as the entity key, never the store code', async () => {
    await get('section=catalogo&dateRange=month:2026-10&tienda=e:7');
    const returnsQ = queries.filter(q => q.sql.includes('fr.CustomerKey IN'));
    expect(returnsQ.length).toBeGreaterThan(0);
    for (const q of returnsQ) {
      expect(q.sql).toContain('@entidadKey');
      expect(q.inputs).toMatchObject({ entidadKey: 7 });
      expect(q.sql).not.toContain('@tiendaCode');
    }
  });
  test('tienda=e:abc is ignored', async () => {
    await get('section=porLineaMes&tienda=e:abc&dateRange=month:2026-10');
    expect(queries[0].inputs.entidadKey).toBeUndefined();
    expect(queries[0].inputs.tiendaCode).toBeUndefined();
    expect(queries[0].sql).not.toContain('@entidadKey');
  });
  test('the tienda filter matches every SCD version of the customer code', async () => {
    await get('section=porLineaMes&tienda=J123&dateRange=month:2026-10');
    expect(queries[0].sql).toContain('tk.CustomerCode = @tiendaCode');
    expect(queries[0].inputs).toMatchObject({ tiendaCode: 'J123' });
  });
});
