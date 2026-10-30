import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';

type Row = Record<string, unknown>;
let snapshotKeys: Array<number | null> = [];
let openingBalance: Row = { OpeningBs: 500, OpeningUsd: 5 };
const queries: string[] = [];

function recordsetFor(sql: string, inputs: Record<string, unknown>): Row[] {
  queries.push(sql);
  if (sql.includes('MAX(SnapshotDateKey)')) {
    const isOpening = 'openingEndKey' in inputs;
    return [{ SnapshotDateKey: isOpening ? snapshotKeys[1] : snapshotKeys[0] }];
  }
  if (sql.includes('AS CustomersTotal')) {
    return [{ CustomersTotal: 120, CustomersNew: 7, CustomersNet: 80, CustomersWithReturns: 9, UnitsReturned: 33 }];
  }
  if (sql.includes('AS OpeningBs')) return [openingBalance];
  if (sql.includes('AS SalesGrossPeriodBs')) {
    return [{ SalesGrossPeriodBs: 1000, SalesGrossPeriodUsd: 100, ReturnsNetPeriodBs: 0, ReturnsNetPeriodUsd: 0, UnitsSold: 10, CollectedPeriodBs: 0, CollectedPeriodUsd: 0 }];
  }
  if (sql.includes('AS ActiveCustomers')) return [{ ActiveCustomers: 3, ActiveCustomersPrevPeriod: 4, ChurnedCustomers: 1 }];
  return [];
}

mock.module('@/lib/dwh/access', () => ({
  requireDwhAccess: async () => ({ ok: true, session: { sub: 'u', role: 'admin' } }),
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
  beforeEach(() => {
    queries.length = 0;
    snapshotKeys = [20261030, 20261001];
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
  });

  test('receivableOpening is null when no snapshot exists before the range', async () => {
    snapshotKeys = [20261030, null];
    const res = await GET(new NextRequest('http://localhost/api/dwh/resumen?dateRange=month:2026-10'));
    const { kpis } = await res.json();
    expect(kpis.receivableOpening).toBeNull();
  });

  test('excludes consignment roots from the customer counts', async () => {
    await GET(new NextRequest('http://localhost/api/dwh/resumen?dateRange=month:2026-10'));
    const q = queries.find(s => s.includes('AS CustomersTotal'))!;
    expect(q).toContain('NOT IN');
  });
});
