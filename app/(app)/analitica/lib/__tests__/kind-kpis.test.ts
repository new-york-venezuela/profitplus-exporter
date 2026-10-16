import { describe, expect, test } from 'bun:test';
import {
  classifyStickiness, kindStats, newCustomersFunnel, patrimonioHolding, salesDeltaPct, type KindRow,
} from '../kind-kpis';

const TODAY = 20261015;
const ago = (days: number) => { // date key `days` days before TODAY
  const d = new Date(Date.UTC(2026, 9, 15) - days * 86_400_000);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
};

describe('classifyStickiness', () => {
  const base = { intervalDays: 7, registeredDate: '2025-01-01', todayKey: TODAY };
  test('a weekly customer with an invoice in each of the last 3 weeks is constante', () => {
    expect(classifyStickiness({ ...base, recentSaleDateKeys: [ago(2), ago(9), ago(16)] })).toBe('constante');
  });
  test('window edges: age 6 and 7 fall in different windows; age 20 is the last day of window 3, 21 is outside', () => {
    expect(classifyStickiness({ ...base, recentSaleDateKeys: [ago(6), ago(13), ago(20)] })).toBe('constante');
    expect(classifyStickiness({ ...base, recentSaleDateKeys: [ago(7), ago(14), ago(21)] })).toBe('irregular');
  });
  test('two invoices in the same window count once', () => {
    expect(classifyStickiness({ ...base, recentSaleDateKeys: [ago(1), ago(3), ago(5)] })).toBe('irregular');
  });
  test('1 or 2 windows met is irregular, none is perdido (no sale in three weeks)', () => {
    expect(classifyStickiness({ ...base, recentSaleDateKeys: [ago(2), ago(16)] })).toBe('irregular');
    expect(classifyStickiness({ ...base, recentSaleDateKeys: [ago(19)] })).toBe('irregular');
    expect(classifyStickiness({ ...base, recentSaleDateKeys: [] })).toBe('perdido');
    expect(classifyStickiness({ ...base, recentSaleDateKeys: [ago(22)] })).toBe('perdido');
  });
  test('interval scales the windows (15 and 30 days)', () => {
    expect(classifyStickiness({ ...base, intervalDays: 15, recentSaleDateKeys: [ago(10), ago(20), ago(40)] })).toBe('constante');
    expect(classifyStickiness({ ...base, intervalDays: 30, recentSaleDateKeys: [ago(10), ago(40), ago(80)] })).toBe('constante');
  });
  test('registered less than 3 intervals ago is en observación, whatever the sales', () => {
    expect(classifyStickiness({ ...base, registeredDate: '2026-10-01', recentSaleDateKeys: [ago(2)] })).toBe('observacion');
    expect(classifyStickiness({ ...base, registeredDate: '2026-09-24', recentSaleDateKeys: [] })).toBe('perdido');   // exactly 21 days ago
  });
  test('no frequency means it cannot be evaluated; no registration date is still evaluated', () => {
    expect(classifyStickiness({ ...base, intervalDays: null, recentSaleDateKeys: [ago(1)] })).toBe('sin_frecuencia');
    expect(classifyStickiness({ ...base, registeredDate: null, recentSaleDateKeys: [ago(1)] })).toBe('irregular');
  });
});

const row = (o: Partial<KindRow> = {}): KindRow => ({
  kind: 'patrimonio', activeInPeriod: true, boughtPrev: true,
  salesPeriod: { bs: 100, usd: 2 }, salesPrev: { bs: 50, usd: 1 },
  status: 'active', visit: { status: 'ok' }, stickiness: 'constante',
  lastSaleDateKey: ago(2), daysToFirstSale: null, ...o,
});

describe('kindStats', () => {
  const rows = [
    row(), row({ activeInPeriod: false, salesPeriod: { bs: 0, usd: 0 }, status: 'lapsed', visit: { status: 'overdue' }, stickiness: 'perdido' }),
    row({ activeInPeriod: null, stickiness: 'observacion' }),
    row({ kind: 'nuevo', stickiness: 'irregular' }), row({ kind: null }),
  ];
  test('counts only the requested kind; "null" activity is excluded from the % denominator', () => {
    const s = kindStats(rows, 'patrimonio');
    expect(s.customers).toBe(3);
    expect(s.active).toBe(1);
    expect(s.activePct).toBe(0.5);                          // 1 of the 2 customers that existed in the period
    expect(s.overdue).toBe(1);
    expect(s.lapsed).toBe(1);
    expect(s.stickiness).toEqual({ constante: 1, irregular: 0, perdido: 1, observacion: 1, sin_frecuencia: 0 });
    expect(s.constantePct).toBe(0.5);                       // 1 of the 2 evaluated (observación / sin frecuencia excluded)
    expect(s.sales).toEqual({ bs: 200, usd: 4 });
    expect(s.salesPerActive).toEqual({ bs: 200, usd: 4 });
  });
  test('"todos" (kind = null filter) keeps rows without kind', () => {
    expect(kindStats(rows, 'todos').customers).toBe(5);
  });
  test('empty groups have no percentages, never NaN', () => {
    const s = kindStats([], 'nuevo');
    expect(s).toMatchObject({ customers: 0, activePct: null, constantePct: null, salesPerActive: null });
  });
});

describe('salesDeltaPct', () => {
  test('uses the selected currency; null without a previous figure or a zero base', () => {
    expect(salesDeltaPct({ bs: 150, usd: 3 }, { bs: 100, usd: 2 }, 'usd')).toBeCloseTo(0.5, 10);
    expect(salesDeltaPct({ bs: 90, usd: 3 }, { bs: 100, usd: 2 }, 'bs')).toBeCloseTo(-0.1, 10);
    expect(salesDeltaPct({ bs: 1, usd: 1 }, null, 'usd')).toBeNull();
    expect(salesDeltaPct({ bs: 1, usd: 1 }, { bs: 0, usd: 0 }, 'usd')).toBeNull();
    expect(salesDeltaPct({ bs: 1, usd: 1 }, { bs: 5, usd: null }, 'usd')).toBeNull();
  });
});

describe('patrimonioHolding', () => {
  test('retention, cooled customers and sales delta; hidden comparison without a previous window', () => {
    const rows = [
      row(), row({ boughtPrev: true, activeInPeriod: false, salesPeriod: { bs: 0, usd: 0 }, stickiness: 'perdido' }),
      row({ boughtPrev: false }), row({ kind: 'nuevo' }),
    ];
    const h = patrimonioHolding(rows, true, 'usd');
    expect(h).toMatchObject({ customers: 3, active: 2, boughtPrev: 2, cooled: 1, retainedPct: 0.5 });
    expect(h.salesDeltaPct).toBeCloseTo((4 - 3) / 3, 10);    // 4 USD now vs 3 USD in the previous period
    expect(patrimonioHolding(rows, false, 'usd')).toMatchObject({ cooled: null, retainedPct: null, salesDeltaPct: null });
  });
});

describe('newCustomersFunnel', () => {
  test('registered -> bought -> constante, with the rest split and the median days to first purchase', () => {
    const rows = [
      row({ kind: 'nuevo', stickiness: 'constante', daysToFirstSale: 2 }),
      row({ kind: 'nuevo', stickiness: 'irregular', daysToFirstSale: 10 }),
      row({ kind: 'nuevo', stickiness: 'perdido', daysToFirstSale: 4 }),
      row({ kind: 'nuevo', stickiness: 'observacion', daysToFirstSale: 0 }),
      row({ kind: 'nuevo', stickiness: 'sin_frecuencia', daysToFirstSale: 6 }),
      row({ kind: 'nuevo', lastSaleDateKey: null, stickiness: 'perdido', daysToFirstSale: null }),
      row({ kind: 'patrimonio' }),
    ];
    expect(newCustomersFunnel(rows)).toEqual({
      registered: 6, bought: 5, neverBought: 1, constante: 1, irregular: 1, perdido: 1, observacion: 1, sin_frecuencia: 1,
      medianDaysToFirstSale: 4,
    });
  });
  test('no new customers: zero funnel and no median', () => {
    expect(newCustomersFunnel([row()])).toMatchObject({ registered: 0, medianDaysToFirstSale: null });
  });
});
