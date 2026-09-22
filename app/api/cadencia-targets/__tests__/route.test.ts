import { describe, test, expect } from 'bun:test';
import { GET, POST, DELETE } from '../route';
import { NextRequest } from 'next/server';

describe('/api/cadencia-targets', () => {
  test('GET rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/cadencia-targets');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('POST rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/cadencia-targets', {
      method: 'POST',
      body: JSON.stringify({ segmentCode: 'CADENA', targetGapDays: 7 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('DELETE rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/cadencia-targets?id=1', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });
});
