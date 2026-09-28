import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/vendedor-360', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/vendedor-360?salesRepKey=1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
