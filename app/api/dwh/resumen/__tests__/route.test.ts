import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';

type Row = Record<string, unknown>;
let snapshotKeys: Array<number | null> = [];
let openingBalance: Row = { OpeningBs: 500, OpeningUsd: 5 };
const queries: string[] = [];
const boundInputs: Array<{ sql: string; inputs: Record<string, unknown> }> = [];
let authResult: { ok: true; session: unknown } | { ok: false; response: Response } = { ok: true, session: { sub: 'u', role: 'admin' } };

function recordsetFor(sql: string, inputs: Record<string, unknown>): Row[] {
  queries.push(sql);
  boundInputs.push({ sql, inputs: { ...inputs } });
  if (sql.includes('MAX(SnapshotDateKey)')) {
    const isOpening = 'openingEndKey' in inputs;
    return [{ SnapshotDateKey: isOpening ? snapshotKeys[1] : snapshotKeys[0] }];
  }
  if (sql.includes('AS CustomersTotal')) {
    return [{ CustomersTotal: 120, CustomersNew: 7, CustomersNet: 80, CustomersWithReturns: 9, CustomersWithSales: 95, ActiveCustomerCodes: 85 }];
  }
  if (sql.includes('AS OpeningBs')) return [openingBalance];
  if (sql.includes('AS SalesGrossPeriodBs')) {
    return [{ SalesGrossPeriodBs: 1000, SalesGrossPeriodUsd: 100, ReturnsNetPeriodBs: 0, ReturnsNetPeriodUsd: 0, UnitsSold: 10, UnitsReturned: 33, CollectedPeriodBs: 0, CollectedPeriodUsd: 0 }];
  }
  if (sql.includes('AS ActiveCustomers')) return [{ ActiveCustomers: 3, ActiveCustomersPrevPeriod: 4, ChurnedCustomers: 1 }];
  return [];
}

mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => authResult,
}));
mock.module('@/lib/db/dwh-mssql', () => ({
  getDwhPool: async () => ({
    request: () => {
      const inputs: Record<string, unknown> = {};
      const req = {
        input: (name: string, value: unknown) => { inputs[name] = value; return req; },
        query: async (sql: string) => ({ recordset: recordsetFor(sql, inputs) }),
      };
      return req;
    },
  }),
}));
mock.module('@/app/api/dwh/lib/consignment', () => ({
  DEFAULT_ROOT_SHARE_THRESHOLD: 0.15,
  getFlaggedRootCodes: async () => ['ROOT1'],
}));

const { GET } = await import('../route');

describe('GET /api/dwh/resumen', () => {
  test('rejects unauthenticated requests with 401', async () => {
    authResult = { ok: false, response: Response.json({ error: 'No autorizado' }, { status: 401 }) };
    const res = await GET(new NextRequest('http://localhost/api/dwh/resumen'));
    expect(res.status).toBe(401);
  });

  test('rejects users without dwh access with 403', async () => {
    authResult = { ok: false, response: Response.json({ error: 'Prohibido' }, { status: 403 }) };
    const res = await GET(new NextRequest('http://localhost/api/dwh/resumen'));
    expect(res.status).toBe(403);
  });

  beforeEach(() => {
    queries.length = 0;
    boundInputs.length = 0;
    authResult = { ok: true, session: { sub: 'u', role: 'admin' } };
    snapshotKeys = [20261030, 20260930];
    openingBalance = { OpeningBs: 500, OpeningUsd: 5 };
  });

  test('returns the customer, returns-units and billing KPIs', async () => {
    const res = await GET(new NextRequest('http://localhost/api/dwh/resumen?dateRange=month:2026-10'));
    expect(res.status).toBe(200);
    const { kpis } = await res.json();
    expect(kpis.customersTotal).toBe(120);
    expect(kpis.customersNew).toBe(7);
    expect(kpis.customersNet).toBe(80);
    expect(kpis.customersWithReturns).toBe(9);
    expect(kpis.unitsReturned).toBe(33);
    expect(kpis.billed).toEqual(kpis.salesGross);
    expect(kpis.billed).toEqual({ bs: 1000, usd: 100 });
    expect(kpis.receivableOpening).toEqual({ bs: 500, usd: 5 });
    // opening snapshot is looked up on/before the day before the range starts
    const lookup = boundInputs.find(b => 'openingEndKey' in b.inputs)!;
    expect(lookup.inputs.openingEndKey).toBe(20260930);
    const balance = boundInputs.find(b => b.sql.includes('AS OpeningBs'))!;
    expect(balance.inputs.openingSnapshotKey).toBe(20260930);
  });

  test('receivableOpening is null when no snapshot exists before the range', async () => {
    snapshotKeys = [20261030, null];
    const res = await GET(new NextRequest('http://localhost/api/dwh/resumen?dateRange=month:2026-10'));
    const body = await res.json();
    expect(body.kpis.receivableOpening).toBeNull();
    expect(body.openingSnapshotKey).toBeNull();
  });

  test('returns the opening snapshot key it valued receivableOpening at', async () => {
    snapshotKeys = [20261030, 20260925];
    const res = await GET(new NextRequest('http://localhost/api/dwh/resumen?dateRange=month:2026-10'));
    const body = await res.json();
    expect(body.openingSnapshotKey).toBe(20260925);
  });

  test('excludes consignment roots from the Clientes counts (master, activos, nuevos) only', async () => {
    await GET(new NextRequest('http://localhost/api/dwh/resumen?dateRange=month:2026-10'));
    const q = queries.find(s => s.includes('AS CustomersTotal'))!;
    const bound = boundInputs.find(b => b.sql === q)!;
    expect(bound.inputs.root0).toBe('ROOT1');
    // The exclusion sits in the `cur` CTE (Total / Activos / Nuevos), never in the sales/returns CTEs
    // that feed the Ventas cards, whose amounts include consignment.
    expect(q.match(/NOT IN/g)?.length).toBe(1);
    const cur = q.slice(q.indexOf('cur AS'));
    expect(cur).toContain('NOT IN');
    expect(q.slice(0, q.indexOf('cur AS'))).not.toContain('NOT IN');
    expect(q).toContain('AS ActiveCustomerCodes');
  });

  test('Ventas cards: units and clientes on the same basis as the amounts (consignment included)', async () => {
    const res = await GET(new NextRequest('http://localhost/api/dwh/resumen?dateRange=month:2026-10'));
    const { kpis } = await res.json();
    // Returned units come from the same totals query (same table, window and scope) as the returns amount.
    const totals = queries.find(s => s.includes('AS SalesGrossPeriodBs'))!;
    expect(totals).toContain('AS UnitsReturned');
    expect(totals).not.toContain('NOT IN');
    expect(kpis.unitsReturned).toBe(33);
    expect(kpis.customersWithSales).toBe(95);
    expect(kpis.activeCustomerCodes).toBe(85);
  });
});
