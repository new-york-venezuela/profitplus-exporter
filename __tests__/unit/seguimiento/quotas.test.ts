import { describe, test, expect } from 'bun:test';
import { quotaBarGeometry, rollUpQuotas, type SellerTargets } from '../../../lib/seguimiento/quotas';

const t = (s: number | null, w: number | null, n: number | null, u: number | null = null): SellerTargets =>
  ({ salesQuotaUsd: s, weeklyVisitQuota: w, newCustomerQuota: n, unitsQuota: u });

describe('rollUpQuotas', () => {
  const targets = new Map<string, SellerTargets>([['1', t(100, 2, 1)], ['2', t(50, null, null)], ['3', t(null, null, null)]]);

  test('a single seller is returned as is', () => {
    expect(rollUpQuotas(['1'], targets)).toMatchObject({ salesQuotaUsd: 100, weeklyVisitQuota: 2, newCustomerQuota: 1, sellersTotal: 1 });
  });
  test('sums the sellers and flags partial fields', () => {
    const r = rollUpQuotas(['1', '2'], targets);
    expect(r.salesQuotaUsd).toBe(150);
    expect(r.partial.sales).toBe(false);
    expect(r.weeklyVisitQuota).toBe(2);
    expect(r.partial.weeklyVisits).toBe(true);
  });
  test('duplicate seller keys count once', () => {
    expect(rollUpQuotas(['1', '1', '1'], targets).salesQuotaUsd).toBe(100);
  });
  test('sellers without any row, or with all-null rows, give null (not 0)', () => {
    const r = rollUpQuotas(['3', '99'], targets);
    expect(r.salesQuotaUsd).toBeNull();
    expect(r.weeklyVisitQuota).toBeNull();
    expect(r.newCustomerQuota).toBeNull();
    expect(r.partial).toEqual({ sales: false, weeklyVisits: false, newCustomers: false, units: false });
  });
  test('an explicit 0 quota is a real value', () => {
    expect(rollUpQuotas(['z'], new Map([['z', t(0, null, null)]])).salesQuotaUsd).toBe(0);
  });
  test('no sellers at all', () => {
    expect(rollUpQuotas([], targets)).toMatchObject({ salesQuotaUsd: null, sellersTotal: 0 });
  });
});

describe('quotaBarGeometry', () => {
  test('actual below quota: marker at the quota end of the scale when projection is lower than quota', () => {
    expect(quotaBarGeometry(70, 100, 90)).toEqual({ fillPct: 70, targetPct: 100, projectionPct: 90 });
  });
  test('projection above quota rescales so everything fits', () => {
    const g = quotaBarGeometry(70, 100, 154)!;
    expect(g.projectionPct).toBe(100);
    expect(g.targetPct).toBeCloseTo((100 / 154) * 100, 6);
    expect(g.fillPct).toBeCloseTo((70 / 154) * 100, 6);
  });
  test('no quota, zero quota or negative quota draws nothing', () => {
    expect(quotaBarGeometry(70, null, 80)).toBeNull();
    expect(quotaBarGeometry(70, 0, 80)).toBeNull();
    expect(quotaBarGeometry(70, -5, 80)).toBeNull();
  });
  test('null actual draws an empty fill, null projection draws no marker', () => {
    expect(quotaBarGeometry(null, 100, null)).toEqual({ fillPct: 0, targetPct: 100, projectionPct: null });
  });
});
