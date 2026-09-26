import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/matriz-vendedor', () => {
  test('rejects unauthenticated summary requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/matriz-vendedor?section=summary');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
