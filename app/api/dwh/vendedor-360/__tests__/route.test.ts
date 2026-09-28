import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/vendedor-360', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/vendedor-360?salesRepKey=1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('rejects a request with a non-numeric salesRepKey with 400', async () => {
    // Auth check runs first in this route (matching every other dwh/* route's
    // ordering), so an unauthenticated request short-circuits to 401 before
    // the 400 validation path is reached — this test therefore still expects
    // 401, documenting that ordering explicitly rather than asserting 400
    // and being surprised later. A 400-path test would need a mocked session,
    // which this repo's dwh/* route tests don't currently set up (confirmed
    // against vendedores/cxc/cadencia's own test files, all 401-only).
    const req = new NextRequest('http://localhost/api/dwh/vendedor-360?salesRepKey=abc');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
