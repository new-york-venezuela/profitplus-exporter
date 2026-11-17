import { describe, test, expect } from 'bun:test';
import { fillRatesCarryForward } from '../../dwh-legacy-2025-import';

describe('fillRatesCarryForward', () => {
  test('a gap repeats the prior rate and flags the days as carried forward', () => {
    const out = fillRatesCarryForward(
      [{ dateKey: 20200101, rateBuy: 1, rateSell: 2 }, { dateKey: 20200105, rateBuy: 3, rateSell: 4 }],
      20200101, 20200105,
    );
    expect(out.map(r => r.dateKey)).toEqual([20200101, 20200102, 20200103, 20200104, 20200105]);
    expect(out.map(r => r.rateSell)).toEqual([2, 2, 2, 2, 4]);
    expect(out.map(r => r.isCarriedForward)).toEqual([false, true, true, true, false]);
  });

  test('days before the first real rate are omitted', () => {
    const out = fillRatesCarryForward([{ dateKey: 20200103, rateBuy: null, rateSell: 5 }], 20200101, 20200104);
    expect(out.map(r => r.dateKey)).toEqual([20200103, 20200104]);
    expect(out[1].isCarriedForward).toBe(true);
    expect(out[1].rateBuy).toBeNull();
  });

  test('rolls over month and year boundaries and leap days', () => {
    const out = fillRatesCarryForward([{ dateKey: 20191230, rateBuy: null, rateSell: 1 }], 20191230, 20200102);
    expect(out.map(r => r.dateKey)).toEqual([20191230, 20191231, 20200101, 20200102]);
    const leap = fillRatesCarryForward([{ dateKey: 20200228, rateBuy: null, rateSell: 1 }], 20200228, 20200301);
    expect(leap.map(r => r.dateKey)).toEqual([20200228, 20200229, 20200301]);
  });

  test('a real row outside the requested range is ignored for output but seeds the carry', () => {
    const out = fillRatesCarryForward([{ dateKey: 20191231, rateBuy: null, rateSell: 9 }], 20200101, 20200102);
    expect(out.map(r => [r.dateKey, r.rateSell, r.isCarriedForward])).toEqual([[20200101, 9, true], [20200102, 9, true]]);
  });

  test('no real rows yields no rows', () => {
    expect(fillRatesCarryForward([], 20200101, 20200105)).toEqual([]);
  });
});
