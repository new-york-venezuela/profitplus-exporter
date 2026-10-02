import { describe, test, expect } from 'bun:test';
import { hasNoRevenue } from '@/lib/geo/period-empty';

describe('hasNoRevenue', () => {
  test('no customers is not an empty-period case', () => {
    expect(hasNoRevenue([])).toBe(false);
  });
  test('every customer at zero or null USD with no Bs is empty', () => {
    expect(hasNoRevenue([{ revenueUsd: 0, revenueBs: 0 }, { revenueUsd: null, revenueBs: 0 }])).toBe(true);
  });
  test('any USD revenue makes it non-empty', () => {
    expect(hasNoRevenue([{ revenueUsd: 0, revenueBs: 0 }, { revenueUsd: 10, revenueBs: 400 }])).toBe(false);
  });
  test('Bs sales without a rate (USD null) is not empty', () => {
    expect(hasNoRevenue([{ revenueUsd: null, revenueBs: 500 }])).toBe(false);
  });
});
