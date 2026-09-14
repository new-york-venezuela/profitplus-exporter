import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/finanzas', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/finanzas?dateRange=12m');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
