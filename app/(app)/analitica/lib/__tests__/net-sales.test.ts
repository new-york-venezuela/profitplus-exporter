import { describe, expect, test } from 'bun:test';
import { dualFromRow, returnRate, subtractDual } from '../net-sales';
import { periodLabel } from '../period-label';

describe('subtractDual', () => {
  test('subtracts both sides', () => {
    expect(subtractDual({ bs: 100, usd: 10 }, { bs: 30, usd: 3 })).toEqual({ bs: 70, usd: 7 });
  });

  test('June 2026 dev DWH: brutas − devoluciones por fecha de factura', () => {
    const net = subtractDual({ bs: 35_011_910.05, usd: null }, { bs: 820_999.07, usd: null });
    expect(net.bs).toBeCloseTo(34_190_910.98, 2);
  });

  test('USD is null when the gross side has no USD', () => {
    expect(subtractDual({ bs: 100, usd: null }, { bs: 30, usd: 3 }).usd).toBeNull();
  });

  test('USD is null when returns exist but have no USD', () => {
    expect(subtractDual({ bs: 100, usd: 10 }, { bs: 30, usd: null }).usd).toBeNull();
  });

  test('no returns at all keeps the gross USD', () => {
    expect(subtractDual({ bs: 100, usd: 10 }, { bs: 0, usd: null })).toEqual({ bs: 100, usd: 10 });
  });
});

describe('returnRate', () => {
  test('returns / gross on BS', () => {
    expect(returnRate({ bs: 25, usd: 1 }, { bs: 100, usd: 4 })).toBe(0.25);
  });
  test('null when gross is not positive', () => {
    expect(returnRate({ bs: 5, usd: 1 }, { bs: 0, usd: 0 })).toBeNull();
  });
});

describe('dualFromRow', () => {
  test('maps NULL USD to null and NULL BS to 0', () => {
    expect(dualFromRow(null, null)).toEqual({ bs: 0, usd: null });
    expect(dualFromRow('12.5', 3)).toEqual({ bs: 12.5, usd: 3 });
  });
});

describe('periodLabel', () => {
  test('formats every dateRange kind', () => {
    expect(periodLabel('30d')).toBe('últimos 30 días');
    expect(periodLabel('12m')).toBe('últimos 12 meses');
    expect(periodLabel('month:2026-06')).toBe('jun 2026');
    expect(periodLabel('ytd:2026')).toBe('2026 a la fecha');
    expect(periodLabel('custom:2026-06-01:2026-06-30')).toBe('01/06/2026–30/06/2026');
  });
  test('falls back like buildDateWhereClause', () => {
    expect(periodLabel('garbage')).toBe('últimos 12 meses');
  });
});
