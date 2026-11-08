import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';

type Row = Record<string, unknown>;
const queries: string[] = [];
let authResult: { ok: true; session: unknown } | { ok: false; response: Response } = { ok: true, session: { sub: 'u', role: 'admin' } };

function recordsetFor(sql: string): Row[] {
  queries.push(sql);
  if (sql.includes('CreditNotes')) {
    return [{ ReturnsBs: 1, ReturnsUsd: 1, CreditNotes: 1, UnitsReturned: 1, UnitsSold: 1, SalesBs: 1 }];
  }
  return [];
}

mock.module('@/lib/dwh/access', () => ({ requireDwhAccess: async () => authResult }));
mock.module('@/lib/db/dwh-mssql', () => ({
  getDwhPool: async () => ({
    request: () => {
      const req = {
        input: () => req,
        query: async (sql: string) => ({ recordset: recordsetFor(sql) }),
      };
      return req;
    },
  }),
}));

const { GET } = await import('../route');
const base = 'http://localhost/api/dwh/devoluciones?dateRange=month:2026-10';

beforeEach(() => {
  queries.length = 0;
  authResult = { ok: true, session: { sub: 'u', role: 'admin' } };
});

describe('GET /api/dwh/devoluciones', () => {
  test('rejects unauthenticated requests with 401', async () => {
    authResult = { ok: false, response: Response.json({ error: 'No autorizado' }, { status: 401 }) };
    const res = await GET(new NextRequest('http://localhost/api/dwh/devoluciones?groupBy=cliente&clienteDimension=cliente_entidad'));
    expect(res.status).toBe(401);
  });

  test('defaults to the devolución date for the returns window', async () => {
    const res = await GET(new NextRequest(`${base}&groupBy=salesrep`));
    expect((await res.json()).returnsBasis).toBe('devolucion');
    const q = queries.find(s => s.includes('Fact_Returns'))!;
    expect(q).toContain('fr.DateKey >=');
    expect(q).not.toContain('fr.OriginalInvoiceDateKey >=');
  });

  test('returnsBasis=factura windows returns by OriginalInvoiceDateKey; sales window unchanged', async () => {
    await GET(new NextRequest(`${base}&groupBy=salesrep`));
    const salesDefault = queries.find(s => s.includes('Fact_Returns'))!.match(/fs\.DateKey[^\n]*/)?.[0];
    queries.length = 0;
    const res = await GET(new NextRequest(`${base}&groupBy=salesrep&returnsBasis=factura`));
    expect((await res.json()).returnsBasis).toBe('factura');
    const q = queries.find(s => s.includes('Fact_Returns'))!;
    expect(q).toContain('fr.OriginalInvoiceDateKey >=');
    expect(q).not.toContain('fr.DateKey >=');
    expect(q.match(/fs\.DateKey[^\n]*/)?.[0]).toBe(salesDefault);
    expect(salesDefault).toBeDefined();
  });

  test('cliente matrix keeps the fs2 sales window in both bases', async () => {
    await GET(new NextRequest(`${base}&groupBy=cliente&clienteDimension=cliente_entidad`));
    const a = queries.find(s => s.includes('fs2.DateKey'))!;
    queries.length = 0;
    await GET(new NextRequest(`${base}&groupBy=cliente&clienteDimension=cliente_entidad&returnsBasis=factura`));
    const b = queries.find(s => s.includes('fs2.DateKey'))!;
    expect(a.match(/fs2\.DateKey[^\n]*/)?.[0]).toBe(b.match(/fs2\.DateKey[^\n]*/)?.[0]);
    expect(b).toContain('fr.OriginalInvoiceDateKey >=');
  });

  test('kpis: every returns query follows the basis, response carries it', async () => {
    const res = await GET(new NextRequest(`${base}&section=kpis&returnsBasis=factura`));
    expect((await res.json()).returnsBasis).toBe('factura');
    const rq = queries.filter(s => s.includes('Fact_Returns'));
    expect(rq.length).toBeGreaterThan(0);
    for (const q of rq) {
      expect(q).toContain('fr.OriginalInvoiceDateKey >=');
      expect(q).not.toContain('fr.DateKey >=');
    }
  });

  test('drill-down follows the basis', async () => {
    await GET(new NextRequest(`${base}&groupBy=cliente&clienteDimension=cliente_entidad&breakdownBy=producto&parentValue=X&returnsBasis=factura`));
    const q = queries.find(s => s.includes('@parentValue'))!;
    expect(q).toContain('fr.OriginalInvoiceDateKey >=');
  });
});
