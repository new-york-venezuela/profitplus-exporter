import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

interface Captured { sql: string; inputs: Record<string, unknown> }
const queries: Captured[] = [];
let respond: (text: string) => unknown[] = () => [];
function makeRequest() {
  const inputs: Record<string, unknown> = {};
  const req = {
    input(name: string, a: unknown, b?: unknown) { inputs[name] = b === undefined ? a : b; return req; },
    async query(text: string) { queries.push({ sql: text, inputs }); return { recordset: respond(text) }; },
  };
  return req;
}
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => ({ request: makeRequest }) }));
mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: '1', role: 'admin', name: 'T' } }),
}));
const { GET } = await import('../route');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/dwh/clientes?section=trend&${qs}`));
beforeEach(() => { queries.length = 0; respond = () => []; });

const row = (BucketKey: string, ActiveCustomers: number, ActiveCustomersPrevBucket: number | null, ChurnedCustomers: number | null) =>
  ({ BucketKey, ActiveCustomers, ActiveCustomersPrevBucket, ChurnedCustomers });

describe('GET /api/dwh/clientes section=trend', () => {
  test('week granularity groups by ISO week key, keeps scope binds and drops the widened lead-in bucket', async () => {
    respond = () => [row('2026-W40', 9, null, null), row('2026-W41', 8, 10, 2), row('2026-W42', 12, 8, 0)];
    const res = await get('dateRange=custom:2026-10-05:2026-10-25&granularity=week&grupo=S1');
    expect(res.status).toBe(200);
    expect(queries[0].sql).toContain("'-W'");
    expect(queries[0].sql).toContain('@scopeGrupo');
    expect(queries[0].inputs).toMatchObject({ scopeGrupo: 'S1' });
    const body = await res.json();
    expect(body.granularity).toBe('week');
    expect(body.rows).toEqual([
      { bucketKey: '2026-W41', label: 'S41', activeCustomers: 8, churnRate: 0.2 },
      { bucketKey: '2026-W42', label: 'S42', activeCustomers: 12, churnRate: 0 },
    ]);
  });

  test('month granularity on a single-bucket range returns one aggregate row with no churn', async () => {
    respond = () => [row('range', 42, null, null)];
    const res = await get('dateRange=custom:2026-10-05:2026-10-25&granularity=month');
    const body = await res.json();
    expect(queries[0].sql).not.toContain("'-W'");
    expect(body.rows).toEqual([{ bucketKey: 'range', label: 'Total del período', activeCustomers: 42, churnRate: null }]);
  });

  test('default granularity follows resolveGranularity (long range is monthly)', async () => {
    respond = () => [row('2025-10', 5, null, null), row('2026-10', 7, 6, 3)];
    const res = await get('dateRange=custom:2026-01-01:2026-10-31');
    const body = await res.json();
    expect(body.granularity).toBe('month');
    expect(queries[0].sql).toContain('d.YearMonth');
    expect(body.rows.map((r: { label: string }) => r.label)).toEqual(['Oct 26']);
    expect(body.rows[0].churnRate).toBe(0.5);
  });

  test('churn is null when the previous bucket had no active customers', async () => {
    respond = () => [row('2026-W41', 8, 0, 0)];
    const body = await (await get('dateRange=custom:2026-10-05:2026-10-25&granularity=week')).json();
    expect(body.rows[0].churnRate).toBeNull();
  });
});
