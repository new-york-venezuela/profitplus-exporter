import { describe, test, expect } from 'bun:test';
import { NextRequest } from 'next/server';
import { GET } from '../route';

describe('GET /api/dwh/clientes/cobertura', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const res = await GET(new NextRequest('http://localhost/api/dwh/clientes/cobertura'));
    expect(res.status).toBe(401);
  });
});
