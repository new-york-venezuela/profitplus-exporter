import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/devoluciones', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/devoluciones?groupBy=cliente&clienteDimension=cliente_entidad');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
