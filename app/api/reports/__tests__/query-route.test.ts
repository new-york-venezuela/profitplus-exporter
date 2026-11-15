import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

let session: { sub: string; role: string; name: string } | null = { sub: 'u1', role: 'user', name: 'U' };
let rowsToReturn: Record<string, unknown>[] = [];
let shouldThrow = false;
const exceptions: unknown[][] = [];

mock.module('@/lib/auth/get-session', () => ({ getSession: async () => session }));
mock.module('@/lib/db/mssql', () => ({ getPool: async () => ({}) }));
mock.module('@/lib/reports/query-reports', () => ({
  QUERY_REPORTS: {},
  runQueryReport: async () => { if (shouldThrow) throw new Error('boom'); return rowsToReturn; },
}));
mock.module('@/lib/analytics/posthog', () => ({
  captureEvent: () => {},
  captureException: (...args: unknown[]) => { exceptions.push(args); },
}));
mock.module('@/lib/reports/registry', () => ({
  REPORTS: {
    fakeq: {
      id: 'fakeq',
      label: 'Fake',
      queryType: 'query',
      snapshot: true,
      columns: [
        { key: 'a', label: 'Columna A', defaultVisible: true, defaultOrder: 0 },
        { key: 'b', label: 'Columna B', defaultVisible: true, defaultOrder: 1 },
      ],
    },
  },
}));

const preview = await import('../[report]/preview/route');
const exporter = await import('../[report]/export/route');

const req = (path: string) => new NextRequest(`http://localhost/api/reports/${path}`);
const ctx = (report: string) => ({ params: Promise.resolve({ report }) });

beforeEach(() => {
  session = { sub: 'u1', role: 'user', name: 'U' };
  rowsToReturn = [];
  shouldThrow = false;
  exceptions.length = 0;
});

describe('query reports routes', () => {
  test('401 without session', async () => {
    session = null;
    expect((await preview.GET(req('fakeq/preview'), ctx('fakeq'))).status).toBe(401);
    expect((await exporter.GET(req('fakeq/export'), ctx('fakeq'))).status).toBe(401);
  });
  test('404 unknown id', async () => {
    expect((await preview.GET(req('zzz/preview'), ctx('zzz'))).status).toBe(404);
    expect((await exporter.GET(req('zzz/export'), ctx('zzz'))).status).toBe(404);
  });
  test('preview caps rows at 100 with total', async () => {
    rowsToReturn = Array.from({ length: 250 }, (_, i) => ({ a: i, b: 'x' }));
    const res = await preview.GET(req('fakeq/preview'), ctx('fakeq'));
    const body = await res.json();
    expect(body.total).toBe(250);
    expect(body.rows.length).toBe(100);
  });
  test('csv export has BOM and config labels', async () => {
    rowsToReturn = [{ a: 1, b: 'x' }];
    const res = await exporter.GET(req('fakeq/export?format=csv'), ctx('fakeq'));
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    const text = await res.text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Columna A');
    expect(text).toContain('Columna B');
    expect(res.headers.get('Content-Disposition')).toMatch(/fakeq_\d{4}-\d{2}-\d{2}\.csv/);
  });
  test('snapshot filename uses the local calendar date', async () => {
    const d = new Date();
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const res = await exporter.GET(req('fakeq/export?format=csv'), ctx('fakeq'));
    expect(res.headers.get('Content-Disposition')).toContain(`fakeq_${local}.csv`);
  });
  test('preview failure is captured with session and report', async () => {
    shouldThrow = true;
    const res = await preview.GET(req('fakeq/preview'), ctx('fakeq'));
    expect(res.status).toBe(500);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0][1]).toBe('u1');
    expect(exceptions[0][2]).toEqual({ report: 'fakeq' });
  });
  test('bad format -> 400', async () => {
    const res = await exporter.GET(req('fakeq/export?format=bad'), ctx('fakeq'));
    expect(res.status).toBe(400);
  });
});
