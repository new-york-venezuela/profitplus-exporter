import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// This route requires a valid session cookie to pass the auth gate; without
// one it returns 401 before touching the DB. This test only verifies the
// route file exports GET and rejects unauthenticated requests — full
// data-shape verification happens via the E2E suite (Task 10), which runs
// against a real logged-in session and a real DWH.
describe('GET /api/dwh/ventas', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/ventas?groupBy=cliente_entidad');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
