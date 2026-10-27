import { describe, expect, mock, test } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';

type Access = { ok: true; session: { sub: string; role: 'admin' } } | { ok: false; response: NextResponse };
const access = mock(async (): Promise<Access> => ({ ok: true, session: { sub: '7', role: 'admin' } }));
mock.module('@/lib/statements/access', () => ({ requireStatementsAccess: access }));
mock.module('@/lib/db/mssql', () => ({ getPool: async () => ({}) }));
mock.module('@/lib/statements/repo', () => ({ listCustomersForPicker: async () => [{ co_cli: 'C1', cli_des: 'Alfa' }] }));
mock.module('@/lib/analytics/posthog', () => ({ captureEvent: mock(() => {}), captureException: mock(() => {}) }));

const { GET } = await import('../route');
const call = () => GET(new NextRequest('http://localhost/api/statements/customers'));

describe('GET /api/statements/customers', () => {
  test('401 and 403 pass through', async () => {
    access.mockImplementationOnce(async () => ({ ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }));
    expect((await call()).status).toBe(401);
    access.mockImplementationOnce(async () => ({ ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) }));
    expect((await call()).status).toBe(403);
  });
  test('200 lists customers', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ customers: [{ co_cli: 'C1', cli_des: 'Alfa' }] });
  });
});
