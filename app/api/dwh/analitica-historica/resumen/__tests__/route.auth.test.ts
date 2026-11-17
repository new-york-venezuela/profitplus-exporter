import { describe, expect, mock, test } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';

let queried = false;
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => { queried = true; return { request: () => ({ input() { return this; }, async query() { return { recordset: [] }; } }) }; } }));
let denial: NextResponse | null = null;
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => (denial ? { ok: false, response: denial } : { ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

describe('GET /api/dwh/analitica-historica/resumen access gate', () => {
  test('passes the 401 / 403 of requireDwhAccess through and never queries', async () => {
    for (const status of [401, 403]) {
      denial = NextResponse.json({ error: 'x' }, { status });
      queried = false;
      const res = await GET(new NextRequest('http://localhost/api/dwh/analitica-historica/resumen'));
      expect(res.status).toBe(status);
      expect(queried).toBe(false);
    }
  });
});
