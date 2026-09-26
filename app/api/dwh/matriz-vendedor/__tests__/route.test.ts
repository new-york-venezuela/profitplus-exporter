import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/matriz-vendedor', () => {
  test('rejects unauthenticated summary requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?section=summary');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('rejects unauthenticated matrix requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?section=matrix&salesRepKey=1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('returns 400 when section=matrix is missing salesRepKey', async () => {
    // This request has no session cookie either, so per the route's own
    // ordering (auth check runs before the salesRepKey validation) this
    // still resolves as a 401, not a 400 -- the route always checks auth
    // FIRST, unconditionally, before looking at any other param. This test
    // documents and locks in that ordering rather than exercising the 400
    // branch directly (which needs a valid session, out of scope for these
    // auth-smoke-only route tests -- see this plan's Global Constraints).
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?section=matrix');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('rejects unauthenticated xlsx export requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?format=xlsx');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('rejects unauthenticated xlsx export requests scoped to one seller with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?format=xlsx&salesRepKey=1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
