import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';

type Access = { ok: true; session: { sub: string; role: 'admin' } } | { ok: false; response: NextResponse };
const access = mock(async (): Promise<Access> => ({ ok: true, session: { sub: '7', role: 'admin' } }));
const generate = mock(async (_p: unknown, _c: string): Promise<unknown> => ({
  pdf: Buffer.from('%PDF-1.4 x'), fileName: 'C1-Alfa.pdf', statement: { incomplete: false }, customerName: 'Alfa',
}));
const capture = mock((_a: string, _b: string, _c?: unknown) => {});
mock.module('@/lib/statements/access', () => ({ requireStatementsAccess: access }));
mock.module('@/lib/db/mssql', () => ({ getPool: async () => ({}) }));
mock.module('@/lib/statements/generate', () => ({ generateStatementPdf: generate }));
mock.module('@/lib/analytics/posthog', () => ({ captureEvent: capture, captureException: mock(() => {}) }));

const { GET } = await import('../route');
const call = (co = 'C1') => GET(new NextRequest(`http://localhost/api/statements/${co}`), { params: Promise.resolve({ co_cli: co }) });

beforeEach(() => {
  access.mockImplementation(async () => ({ ok: true, session: { sub: '7', role: 'admin' } }));
});

describe('GET /api/statements/[co_cli]', () => {
  test('401', async () => {
    access.mockImplementation(async () => ({ ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }));
    expect((await call()).status).toBe(401);
  });
  test('403', async () => {
    access.mockImplementation(async () => ({ ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) }));
    expect((await call()).status).toBe(403);
  });
  test('404 for unknown customer', async () => {
    generate.mockImplementationOnce(async () => null);
    const res = await call('NOPE');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Cliente no encontrado' });
  });
  test('literal % in the code is looked up as-is (no 500)', async () => {
    generate.mockImplementationOnce(async () => null);
    const res = await call('50%');
    expect(res.status).toBe(404);
    expect(generate.mock.calls.at(-1)![1]).toBe('50%');
  });
  test('400 for over-long code', async () => {
    expect((await call('x'.repeat(31))).status).toBe(400);
  });
  test('200 with pdf headers', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="C1-Alfa.pdf"');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
    expect(capture).toHaveBeenCalled();
  });
});
