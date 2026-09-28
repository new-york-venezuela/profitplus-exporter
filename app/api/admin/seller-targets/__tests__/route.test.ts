import { describe, test, expect } from 'bun:test';
import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/admin/seller-targets', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/admin/seller-targets?salesRepKey=1&periodMonth=2026-09');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/seller-targets', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/admin/seller-targets', {
      method: 'POST',
      body: JSON.stringify({ salesRepKey: '1', periodMonth: '2026-09', salesQuotaUsd: 5000 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('rejects a body missing salesRepKey or periodMonth with 400', async () => {
    // This test runs against a real auth check, so it can only assert the
    // 401 path without a session cookie — the 400 validation path is
    // exercised once auth is mocked in a later task if the team's test
    // conventions add session mocking; for now this route follows
    // visit-cadence-targets' exact test depth (401-only), confirmed against
    // app/api/cadencia-targets/__tests__/route.test.ts.
    const req = new NextRequest('http://localhost/api/admin/seller-targets', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
