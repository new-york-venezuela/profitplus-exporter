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

const topQ = () => queries.find(q => q.sql.includes('TOP 10'))!;
const monthQ = () => queries.find(q => !q.sql.includes('TOP 10'))!;

describe('GET /api/dwh/productos section=porLineaMes follows nivel and the bar filters', () => {
  test('default nivel is linea, top 10 series', async () => {
    await get('section=porLineaMes&dateRange=month:2026-10');
    expect(topQ().sql).toContain('TOP 10');
    expect(topQ().sql).not.toContain('TOP 7');
    expect(topQ().sql).toContain("ISNULL(p.LineName, 'Sin línea')");
  });

  test('nivel=sku groups by product code on both queries', async () => {
    await get('section=porLineaMes&nivel=sku&dateRange=month:2026-10');
    expect(topQ().sql).toContain('RTRIM(p.ProductCode)');
    expect(topQ().sql).toContain('MAX(ISNULL(p.ProductName');
    expect(monthQ().sql).toContain('GROUP BY');
    expect(monthQ().sql).toContain('RTRIM(p.ProductCode)');
  });

  test('item filters are bound on the top-series AND the bucket query', async () => {
    await get('section=porLineaMes&nivel=sku&lineas=Panaderia&q=pan&grupo=S1&dateRange=month:2026-10');
    expect(queries).toHaveLength(2);
    for (const q of queries) {
      expect(q.sql).toContain('@linea0');
      expect(q.sql).toContain('@q');
      expect(q.sql).toContain('@grupo');
      expect(q.inputs).toMatchObject({ linea0: 'Panaderia', grupo: 'S1', q: '%pan%' });
    }
  });

  test('nivel=sublinea labels are "Línea › Sublínea" and seriesMeta carries both parts', async () => {
    respond = text => text.includes('TOP 10')
      ? [{ SeriesKey: 'Panaderia › Artesanal', Linea: 'Panaderia', Sublinea: 'Artesanal', Code: null, Label: 'Panaderia › Artesanal' }]
      : [
        { Bucket: '2026-10', SeriesKey: 'Panaderia › Artesanal', QuantitySold: 5, SalesGrossBs: 10, SalesGrossUsd: 2 },
        { Bucket: '2026-10', SeriesKey: 'Panaderia › Otra', QuantitySold: 3, SalesGrossBs: 6, SalesGrossUsd: null },
      ];
    const body = await (await get('section=porLineaMes&nivel=sublinea&dateRange=month:2026-10')).json();
    expect(body.nivel).toBe('sublinea');
    expect(body.lineas).toEqual(['Panaderia › Artesanal', 'Otras']);
    expect(body.seriesMeta['Panaderia › Artesanal']).toEqual({ linea: 'Panaderia', sublinea: 'Artesanal' });
    expect(body.rows[0].units).toEqual({ 'Panaderia › Artesanal': 5, Otras: 3 });
    expect(body.rows[0].salesGross.Otras.usd).toBeNull();
  });

  test('nivel=sku label is the product name and the code is in seriesMeta', async () => {
    respond = text => text.includes('TOP 10')
      ? [{ SeriesKey: 'P1', Linea: 'Panaderia', Sublinea: 'Artesanal', Code: 'P1', Label: 'Pan Campesino' }]
      : [{ Bucket: '2026-10', SeriesKey: 'P1', QuantitySold: 5, SalesGrossBs: 10, SalesGrossUsd: 2 }];
    const body = await (await get('section=porLineaMes&nivel=sku&dateRange=month:2026-10')).json();
    expect(body.lineas).toEqual(['Pan Campesino']);
    expect(body.seriesMeta['Pan Campesino'].code).toBe('P1');
  });
});
