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

const salesQ = () => queries.find(q => q.sql.includes('fact.Fact_Sales'))!;
const returnsQ = () => queries.find(q => q.sql.includes('fact.Fact_Returns'))!;

const SALES = [
  { Key: 'Panaderia', Label: 'Panaderia', Code: null, Linea: 'Panaderia', Sublinea: '', SalesGrossBs: 800, SalesGrossUsd: 16, Units: 80, MonthCount: 2, ClientCount: 3, PosCount: 5 },
  { Key: 'Pizza', Label: 'Pizza', Code: null, Linea: 'Pizza', Sublinea: '', SalesGrossBs: 200, SalesGrossUsd: null, Units: 0, MonthCount: 1, ClientCount: 1, PosCount: 1 },
];
const RETURNS = [{ Key: 'Panaderia', ReturnsBs: 80, ReturnsUsd: 2 }];
const respondBoth = (text: string) => (text.includes('fact.Fact_Returns') ? RETURNS : SALES);

describe('GET /api/dwh/productos section=catalogo', () => {
  test('maps rows: net, avg price, rate, monthly units, share, pareto', async () => {
    respond = respondBoth;
    const res = await get('section=catalogo&nivel=linea&dateRange=month:2026-10');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nivel).toBe('linea');
    const pan = body.rows.find((r: { key: string }) => r.key === 'Panaderia');
    expect(pan).toMatchObject({
      label: 'Panaderia', code: null, linea: 'Panaderia', units: 80, monthCount: 2, avgUnitsPerMonth: 40,
      clientCount: 3, posCount: 5,
      salesGross: { bs: 800, usd: 16 }, returns: { bs: 80, usd: 2 }, salesNet: { bs: 720, usd: 14 },
      avgPrice: { bs: 10, usd: 0.2 }, returnRate: 0.1, pareto: 'A',
    });
    expect(pan.sharePct).toBeCloseTo(720 / 920, 8);
    const pizza = body.rows.find((r: { key: string }) => r.key === 'Pizza');
    expect(pizza.returns).toEqual({ bs: 0, usd: 0 });
    expect(pizza.avgUnitsPerMonth).toBe(0);
    expect(pizza.avgPrice.bs).toBe(0);
    expect(pizza.pareto).toBe('A'); // cumulative share before it is 0.78 < 0.80
  });
  test('currency=usd classifies and shares on USD; null USD has no class or share', async () => {
    respond = respondBoth;
    const body = await (await get('section=catalogo&currency=usd&dateRange=month:2026-10')).json();
    const pizza = body.rows.find((r: { key: string }) => r.key === 'Pizza');
    expect(pizza.pareto).toBeNull();
    expect(pizza.sharePct).toBeNull();
    expect(body.rows.find((r: { key: string }) => r.key === 'Panaderia').sharePct).toBe(1);
  });
  test('returnRate is null when gross is 0', async () => {
    respond = text => (text.includes('fact.Fact_Returns') ? [] : [{ ...SALES[0], SalesGrossBs: 0, SalesGrossUsd: 0 }]);
    const body = await (await get('section=catalogo&dateRange=month:2026-10')).json();
    expect(body.rows[0].returnRate).toBeNull();
  });
  test('groups by the right expression per nivel, one sales and one returns query', async () => {
    await get('section=catalogo&nivel=sublinea&dateRange=month:2026-10');
    expect(queries).toHaveLength(2);
    expect(salesQ().sql).toContain('GROUP BY');
    expect(salesQ().sql).toContain('SubLineName');
    expect(returnsQ().sql).toContain('JOIN dim.Dim_Product pr ON pr.ProductKey = fr.ProductKey');
    queries.length = 0;
    await get('section=catalogo&nivel=sku&dateRange=month:2026-10');
    expect(salesQ().sql).toContain('RTRIM(p.ProductCode)');
    expect(returnsQ().sql).toContain('RTRIM(pr.ProductCode)');
  });
  test('sku rows carry the trimmed code; sublinea key joins linea and sublinea', async () => {
    respond = text => (text.includes('fact.Fact_Returns') ? [{ Key: 'A1', ReturnsBs: 1, ReturnsUsd: 1 }] : [
      { Key: 'A1', Label: 'Pan', Code: 'A1', Linea: 'L', Sublinea: 'S', SalesGrossBs: 10, SalesGrossUsd: 1, Units: 1, MonthCount: 1, ClientCount: 1, PosCount: 1 },
    ]);
    const body = await (await get('section=catalogo&nivel=sku')).json();
    expect(body.rows[0]).toMatchObject({ key: 'A1', code: 'A1', label: 'Pan', linea: 'L', sublinea: 'S' });
  });
  test('counts POS by customer code and clients through the current row with LEFT JOINs', async () => {
    await get('section=catalogo&dateRange=month:2026-10');
    const sql = salesQ().sql;
    expect(sql).toContain('COUNT(DISTINCT c.CustomerCode)');
    expect(sql).toContain('COUNT(DISTINCT le.LegalEntityKey)');
    expect(sql).toContain('cur.IsCurrent = 1');
    expect(sql).toContain('LEFT JOIN dim.Dim_LegalEntity le');
    expect(sql).toContain('COUNT(DISTINCT d.YearMonth)');
    expect(sql).not.toMatch(/\bTOP\b/);
    expect(returnsQ().sql).not.toMatch(/\bTOP\b/);
  });
  test('filters reach BOTH the sales and the returns SQL with binds', async () => {
    await get('section=catalogo&lineas=Panaderia,Pizza&sublineas=Artesanal&grupo=S1&q=pan&tienda=e:7&categoria=Fresco&dateRange=month:2026-10');
    const s = salesQ(); const r = returnsQ();
    for (const q of [s, r]) {
      expect(q.sql).toContain('@linea0');
      expect(q.sql).toContain('@linea1');
      expect(q.sql).toContain('@sublinea0');
      expect(q.sql).toContain('@grupo');
      expect(q.sql).toContain('@q');
      expect(q.sql).toContain('@entidadKey');
      expect(q.sql).toContain('@categoria');
      expect(q.inputs).toMatchObject({ linea0: 'Panaderia', linea1: 'Pizza', sublinea0: 'Artesanal', grupo: 'S1', q: '%pan%', entidadKey: 7, categoria: 'Fresco' });
    }
    expect(s.sql).toContain('p.CategoryName = @categoria');
    expect(r.sql).toContain('pr.CategoryName = @categoria');
    expect(r.sql).toContain('fr.CustomerKey IN');
  });
  test('returns use devolución date and the original factura rate', async () => {
    await get('section=catalogo&dateRange=month:2026-10');
    expect(returnsQ().sql).toContain('fr.DateKey');
    expect(returnsQ().sql).toContain('OriginalInvoiceDateKey');
  });
  test('a database error is a 500', async () => {
    respond = () => { throw new Error('boom'); };
    const res = await get('section=catalogo');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/dwh/productos?filtros=1', () => {
  test('returns lineas, sublineas and grupos', async () => {
    respond = text => {
      if (text.includes('Dim_Segment')) return [{ Code: 'S1', Name: 'Abasto' }];
      if (text.includes('SubLineName')) return [{ Linea: 'Panaderia', Sublinea: 'Artesanal' }];
      return [{ Name: 'Panaderia' }, { Name: 'Pizza' }];
    };
    const body = await (await get('filtros=1')).json();
    expect(body).toEqual({
      lineas: ['Panaderia', 'Pizza'],
      sublineas: [{ linea: 'Panaderia', sublinea: 'Artesanal' }],
      grupos: [{ code: 'S1', name: 'Abasto' }],
    });
  });
  test('a database error is a 500', async () => {
    respond = () => { throw new Error('boom'); };
    expect((await get('filtros=1')).status).toBe(500);
  });
});
