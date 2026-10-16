import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';
import { makeMemoryDb } from '@/__tests__/helpers/memory-db';
import { sellerTargets } from '@/lib/db/schema';
import { buildDateWhereClause } from '@/app/api/dwh/lib/query-builder';
import { FIXTURE_CONSIGNMENT_ROOTS, FIXTURE_CUSTOMERS, FIXTURE_INVOICE_LINES, FIXTURE_LINE_SALES, FIXTURE_WEEK_ACTIVITY } from '@/__tests__/unit/seguimiento/fixture';

const pool = { tag: 'pool' };
const memoryDb = makeMemoryDb();
const access = mock(async (): Promise<{ ok: true; session: { sub: string; role: 'admin' } } | { ok: false; response: NextResponse }> =>
  ({ ok: true, session: { sub: '7', role: 'admin' } }));
const capture = mock((_id: string, _event: string, _props?: unknown) => {});
const captureEx = mock(() => {});
const fetchCustomers = mock(async () => FIXTURE_CUSTOMERS);
const fetchLineSales = mock(async () => FIXTURE_LINE_SALES);
const fetchWeekActivity = mock(async () => FIXTURE_WEEK_ACTIVITY);
const fetchCustomerInvoiceLines = mock(async () => FIXTURE_INVOICE_LINES);
const fetchExcludedInvoices = mock(async (_p: unknown, _m: string, codes: string[]) =>
  codes.length ? [{ customerCode: 'C4', customerName: 'Cadena Raiz', invoiceNumber: 'F9', invoiceDate: '2026-10-05', amountNet: { bs: 9000, usd: 180 } }] : []);
const flagged = mock(async (_w: string, _t: number) => FIXTURE_CONSIGNMENT_ROOTS);

mock.module('@/lib/dwh/access', () => ({ requireDwhAccess: access }));
mock.module('@/lib/db/dwh-mssql', () => ({ getDwhPool: async () => pool }));
mock.module('@/lib/db/sqlite', () => ({ getDb: () => memoryDb }));
mock.module('@/lib/analytics/posthog', () => ({ captureEvent: capture, captureException: captureEx }));
mock.module('@/lib/seguimiento/queries', () => ({ fetchCustomers, fetchLineSales, fetchWeekActivity, fetchCustomerInvoiceLines, fetchExcludedInvoices }));
mock.module('@/app/api/dwh/lib/consignment', () => ({ getFlaggedRootCodes: flagged, DEFAULT_ROOT_SHARE_THRESHOLD: 0.15 }));

const { GET } = await import('../route');
const call = (qs = '') => GET(new NextRequest(`http://localhost/api/dwh/seguimiento${qs}`));

beforeAll(() => setSystemTime(new Date('2026-10-14T15:00:00Z')));
afterAll(() => setSystemTime());
beforeEach(() => {
  for (const m of [capture, captureEx, fetchCustomers, fetchLineSales, fetchWeekActivity, fetchCustomerInvoiceLines, fetchExcludedInvoices, flagged]) m.mockClear();
  access.mockImplementation(async () => ({ ok: true, session: { sub: '7', role: 'admin' } }));
  memoryDb.delete(sellerTargets).run();
  memoryDb.insert(sellerTargets).values([
    { salesRepKey: '1', periodMonth: '2026-10', salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 1, unitsQuota: 100 },
    { salesRepKey: '2', periodMonth: '2026-10', salesQuotaUsd: 50, weeklyVisitQuota: null, newCustomerQuota: null, unitsQuota: null },
    { salesRepKey: '1', periodMonth: '2026-09', salesQuotaUsd: 7, weeklyVisitQuota: null, newCustomerQuota: null, unitsQuota: null },
  ]).run();
});

describe('GET /api/dwh/seguimiento: access', () => {
  test('passes the 401/403 from requireDwhAccess through and runs no query', async () => {
    access.mockImplementation(async () => ({ ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) }));
    const res = await call();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Prohibido' });
    expect(fetchCustomers).not.toHaveBeenCalled();
  });
});

describe('GET /api/dwh/seguimiento: main response', () => {
  test('vendedor roots with quotas from seller_targets for the reference month', async () => {
    const res = await call('?kind=vendedor&dateRange=30d');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=900');
    const body = await res.json();
    expect(body).toMatchObject({ kind: 'vendedor', month: '2026-10', asOf: '2026-10-14' });
    expect(body.pace).toMatchObject({ workingDaysInMonth: 22, workingDaysElapsed: 10 });
    expect(body.roots.map((r: { label: string }) => r.label)).toEqual(['Ana', 'Beto']);
    expect(body.roots[0]).toMatchObject({ salesRepKey: '1', salesQuotaUsd: 100, targets: { salesQuotaUsd: 100 } });
    expect(body.total.salesQuotaUsd).toBe(150);            // the September row (7) is not used
    expect(body.total.excludedSales).toEqual({ bs: 9000, usd: 180 });
  });

  test('in the evening (22:10 on Thursday the 15th, already Friday in UTC) the as-of day and the pace are still the 15th', async () => {
    setSystemTime(new Date(2026, 9, 15, 22, 10));            // host-local constructor: the host calendar day is Oct 15 in any TZ
    try {
      const body = await (await call('?kind=vendedor&dateRange=30d')).json();
      expect(body.asOf).toBe('2026-10-15');
      expect(body.pace).toMatchObject({ workingDaysElapsed: 11, workingDaysInMonth: 22 });
    } finally {
      setSystemTime(new Date('2026-10-14T15:00:00Z'));
    }
  });

  test('queries get the reference month, as-of day and the full ISO-week window', async () => {
    await call('?dateRange=30d');
    expect(fetchCustomers).toHaveBeenCalledWith(pool, '2026-10-14');
    expect(fetchLineSales).toHaveBeenCalledWith(pool, '2026-10');
    expect(fetchWeekActivity).toHaveBeenCalledWith(pool, '2026-09-28', '2026-11-01');
    expect(flagged.mock.calls[0][0]).toContain('DateKey');
    expect(flagged.mock.calls[0][1]).toBe(0.15);
  });

  test('a past month is closed and uses that month\'s quotas', async () => {
    await call('?dateRange=month:2026-09');
    expect(fetchLineSales).toHaveBeenCalledWith(pool, '2026-09');
    expect(fetchCustomers).toHaveBeenCalledWith(pool, '2026-09-30');
  });

  test('the activity window spans whole ISO weeks, not the month bounds (Sept 2026: Mon 08-31 .. Sun 10-04)', async () => {
    await call('?dateRange=month:2026-09');
    expect(fetchWeekActivity).toHaveBeenCalledWith(pool, '2026-08-31', '2026-10-04');
  });

  test('consignment flags use the vendedores rule: reference-month Fact_Sales window and the default threshold', async () => {
    await call('?dateRange=custom:2026-08-01:2026-09-15');
    expect(flagged).toHaveBeenCalledTimes(1);
    expect(flagged).toHaveBeenCalledWith(buildDateWhereClause('month:2026-09', 'fs'), 0.15);
  });

  test('the flagged root codes are what buildSeguimiento excludes', async () => {
    flagged.mockImplementationOnce(async () => []);
    const none = await (await call()).json();
    expect(none.total.excludedSales).toEqual({ bs: 0, usd: 0 });
    flagged.mockImplementationOnce(async () => [' C4 ']);        // root codes are trimmed
    const some = await (await call()).json();
    expect(some.total.excludedSales).toEqual({ bs: 9000, usd: 180 });
  });

  test('ruta and grupo kinds; unknown kinds fall back to vendedor', async () => {
    expect((await (await call('?kind=ruta')).json()).roots.map((r: { label: string }) => r.label)).toEqual(['Ruta 3', 'Ruta 4']);
    expect((await (await call('?kind=grupo')).json()).roots.map((r: { label: string }) => r.label)).toEqual(['Abasto', 'Restaurante']);
    expect((await (await call('?kind=zzz')).json()).kind).toBe('vendedor');
  });

  test('rejects a malformed dateRange or an unknown section with 400 { error } and runs no query', async () => {
    for (const qs of ['?dateRange=' + encodeURIComponent("month:2026-10' OR 1=1"), '?dateRange=bogus', '?section=nope']) {
      const res = await call(qs);
      expect(res.status).toBe(400);
      expect(typeof (await res.json()).error).toBe('string');
    }
    expect(flagged).not.toHaveBeenCalled();
    expect(fetchCustomers).not.toHaveBeenCalled();
  });

  test('accepts every dateRange the analitica shell emits', async () => {
    for (const r of ['12m', '30d', 'month:2026-10', 'ytd:2026', 'custom:2026-10-01:2026-10-10']) {
      expect((await call(`?dateRange=${r}`)).status).toBe(200);
    }
  });

  test('sends a PostHog event with the session id', async () => {
    await call('?kind=ruta');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0]).toBe('7');
    expect(capture.mock.calls[0][1]).toBe('seguimiento_viewed');
    expect(capture.mock.calls[0][2]).toMatchObject({ kind: 'ruta', month: '2026-10', roots: 2 });
  });

  test('a database failure is a 500 { error } and is reported, not cached', async () => {
    fetchLineSales.mockImplementationOnce(async () => { throw new Error('boom'); });
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al consultar el Data Warehouse' });
    expect(res.headers.get('Cache-Control')).toBeNull();
    expect(captureEx).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('GET /api/dwh/seguimiento: sections', () => {
  test('lines: validates the customer code, then returns the lines', async () => {
    expect((await call('?section=lines')).status).toBe(400);
    expect((await call('?section=lines&customerCode=' + encodeURIComponent("C1'; DROP TABLE x"))).status).toBe(400);
    expect(fetchCustomerInvoiceLines).not.toHaveBeenCalled();
    const res = await call('?section=lines&customerCode=C1&dateRange=30d');
    expect(res.status).toBe(200);
    expect((await res.json()).lines).toHaveLength(2);
    expect(fetchCustomerInvoiceLines).toHaveBeenCalledWith(pool, 'C1', '2026-10');
  });

  test('excluded: only flagged consignment codes that belong to the requested root', async () => {
    expect((await call('?section=excluded&kind=vendedor')).status).toBe(400);
    const res = await call('?section=excluded&kind=vendedor&rootValue=2');
    expect(res.status).toBe(200);
    expect(fetchExcludedInvoices).toHaveBeenCalledWith(pool, '2026-10', ['C4']);
    expect((await res.json()).invoices).toHaveLength(1);
    fetchExcludedInvoices.mockClear();
    await call('?section=excluded&kind=vendedor&rootValue=1');      // Ana has no flagged code
    expect(fetchExcludedInvoices).toHaveBeenCalledWith(pool, '2026-10', []);
  });
});
