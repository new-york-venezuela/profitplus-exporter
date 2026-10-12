import { describe, test, expect } from 'bun:test';
import { NextRequest } from 'next/server';
import { GET } from '../route';

describe('GET /api/dwh/seguimiento (no session)', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const res = await GET(new NextRequest('http://localhost/api/dwh/seguimiento'));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('No autorizado');
  });
});
