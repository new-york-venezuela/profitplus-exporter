import { describe, expect, test } from 'bun:test';
import { buildSeguimiento, netOf, type CustomerFact, type SeguimientoInput } from '../aggregate';

const fact = (code: string, over: Partial<CustomerFact> = {}): CustomerFact => ({
  customerCode: code, customerName: `Cliente ${code}`, isInactive: false,
  salesRepKey: 'V1', salesRepName: 'Vendedor 1', zoneCode: 'CCS007', routeNumber: 7,
  segmentCode: 'G1', segmentName: 'Grupo 1', registeredDate: '2025-01-01', isMigrationBatch: true,
  visitIntervalDays: 7, lastInvoiceDate: '2026-10-10', ...over,
});

const base = (over: Partial<SeguimientoInput> = {}): SeguimientoInput => ({
  kind: 'vendedor', month: '2026-10', asOf: '2026-10-14',
  customers: [fact('A'), fact('B', { routeNumber: 12, zoneCode: 'CCS012' }), fact('C')],
  lineSales: [
    { customerCode: 'A', line: 'Panaderia', units: 10, sales: { bs: 1000, usd: 100 } },
    { customerCode: 'B', line: 'Pizza', units: 5, sales: { bs: 500, usd: 50 } },
    { customerCode: 'C', line: 'Pizza', units: 20, sales: { bs: 2000, usd: 200 } },
  ],
  weekActivity: [{ customerCode: 'A', yearWeek: '2026-W41' }],
  consignmentRootCodes: ['C'],
  targets: new Map([['V1', { salesQuotaUsd: 300, weeklyVisitQuota: null, newCustomerQuota: null, unitsQuota: null }]]),
  lineReturns: [
    { customerCode: 'A', line: 'Panaderia', units: 1, returns: { bs: 100, usd: 10 } },
    { customerCode: 'C', line: 'Pizza', units: 4, returns: { bs: 400, usd: 40 } },
  ],
  weekAmounts: [
    { customerCode: 'A', yearWeek: '2026-W41', units: 10, sales: { bs: 1000, usd: 100 }, returnUnits: 1, returns: { bs: 100, usd: 10 } },
    { customerCode: 'C', yearWeek: '2026-W41', units: 20, sales: { bs: 2000, usd: 200 }, returnUnits: 4, returns: { bs: 400, usd: 40 } },
  ],
  ...over,
});

describe('netOf', () => {
  test('null usd only when sales usd is null', () => {
    expect(netOf({ bs: 10, usd: 5 }, { bs: 2, usd: null })).toEqual({ bs: 8, usd: 5 });
    expect(netOf({ bs: 10, usd: null }, { bs: 2, usd: 1 })).toEqual({ bs: 8, usd: null });
    expect(netOf({ bs: 10, usd: 5 }, { bs: 2, usd: 1 })).toEqual({ bs: 8, usd: 4 });
  });
});

describe('buildSeguimiento returns', () => {
  test('total excludes consignment-flagged customers from returns, net = sales - returns', () => {
    const { total } = buildSeguimiento(base());
    expect(total.returns).toEqual({ bs: 100, usd: 10 });
    expect(total.returnUnits).toBe(1);
    expect(total.sales).toEqual({ bs: 1500, usd: 150 });
    expect(total.net).toEqual({ bs: 1400, usd: 140 });
    expect(total.netUnits).toBe(14);
    expect(total.returnRate).toBeCloseTo(100 / 1500);
  });

  test('returnRate is null when sales are 0', () => {
    const { total } = buildSeguimiento(base({ lineSales: [], lineReturns: [], weekAmounts: [] }));
    expect(total.returnRate).toBeNull();
  });

  test('all-null returns usd keeps net usd equal to sales usd', () => {
    const r = buildSeguimiento(base({
      lineReturns: [{ customerCode: 'A', line: 'Panaderia', units: 1, returns: { bs: 100, usd: null } }],
    }));
    // Customers with no return lines contribute zero rows, so only the customer-level USD is null.
    expect(r.total.net.usd).toBe(r.total.sales.usd as number);
    const cust = r.roots[0].customers.find(c => c.customerCode === 'A')!;
    expect(cust.returns.usd).toBeNull();
    expect(cust.net.usd).toBe(100);
    expect(cust.returnUnits).toBe(1);
  });

  test('routeLabels are distinct and in natural order', () => {
    const { roots } = buildSeguimiento(base());
    expect(roots[0].routeLabels).toEqual(['Ruta 7', 'Ruta 12']);
  });

  test('week cells carry amounts, future weeks are zero with null pct', () => {
    const { total, weeks } = buildSeguimiento(base());
    const i41 = weeks.findIndex(w => w.yearWeek === '2026-W41');
    expect(total.weeks[i41].sales).toEqual({ bs: 1000, usd: 100 });
    expect(total.weeks[i41].units).toBe(10);
    expect(total.weeks[i41].returns).toEqual({ bs: 100, usd: 10 });
    expect(total.weeks[i41].returnUnits).toBe(1);
    expect(total.weeks[i41].net).toEqual({ bs: 900, usd: 90 });
    expect(total.weeks[i41].avgPrice).toEqual({ bs: 100, usd: 10 });
    const future = weeks.map((w, i) => ({ w, i })).filter(x => x.w.isFuture);
    expect(future.length).toBeGreaterThan(0);
    for (const { i } of future) {
      const c = total.weeks[i];
      expect(c.pct).toBeNull();
      expect(c.sales.bs).toBe(0);
      expect(c.units).toBe(0);
      expect(c.returns.bs).toBe(0);
      expect(c.avgPrice).toBeNull();
    }
  });

  test('brutas attainment/projection unchanged', () => {
    const { total } = buildSeguimiento(base());
    expect(total.attainment).toBeCloseTo(150 / 300);
    expect(total.units).toBe(15);
    expect(total.projected?.bs).toBeGreaterThan(1500);
  });
});
