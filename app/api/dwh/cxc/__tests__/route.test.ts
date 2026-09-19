import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/cxc', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/cxc');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('rejects unauthenticated requests with 401 for section=debtConcentration', async () => {
    const req = new NextRequest('http://localhost/api/dwh/cxc?section=debtConcentration');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
