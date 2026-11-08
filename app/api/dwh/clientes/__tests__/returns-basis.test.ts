import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';

const queries: string[] = [];

mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: 'u', role: 'admin' } }),
}));
mock.module('@/lib/db/dwh-mssql', () => ({
  getDwhPool: async () => ({
    request: () => {
      const req = {
        input: () => req,
        query: async (sql: string) => { queries.push(sql); return { recordset: [] }; },
      };
      return req;
    },
  }),
}));
mock.module('@/app/api/dwh/lib/consignment', () => ({
  DEFAULT_ROOT_SHARE_THRESHOLD: 0.15,
  getFlaggedRootCodes: async () => [],
}));

const { GET } = await import('../route');

// A WINDOW predicate on the original factura date (the USD rate join
// "fx.DateKey = fr.OriginalInvoiceDateKey" is deliberately not matched).
const FACTURA_WINDOW = /fr2?\.OriginalInvoiceDateKey\s*(>=|<=|<|>)/;

describe('GET /api/dwh/clientes ignores returnsBasis=factura', () => {
  beforeEach(() => { queries.length = 0; });

  for (const url of ['http://localhost/api/dwh/clientes?dateRange=month:2026-10&returnsBasis=factura']) {
    test(`windows returns on fr2.DateKey for ${url}`, async () => {
      await GET(new NextRequest(url));
      const returnsSql = queries.filter(q => q.includes('Fact_Returns'));
      expect(returnsSql.length).toBeGreaterThan(0);
      expect(returnsSql.some(q => q.includes('fr2.DateKey >=') || q.includes('fr2.DateKey <='))).toBe(true);
      for (const q of queries) expect(q).not.toMatch(FACTURA_WINDOW);
    });
  }
});
