import { describe, test, expect } from 'bun:test';
import { mapVentasRecord } from '../ventas-rows';

describe('mapVentasRecord', () => {
  test('maps money, net, rate, discount and units', () => {
    const r = mapVentasRecord({
      SalesGrossBs: 1000, SalesGrossUsd: 10, ReturnsBs: 100, ReturnsUsd: 1,
      GrossAmount: 1250, DiscountAmount: 250, UnitsSold: 40,
    });
    expect(r.salesGross).toEqual({ bs: 1000, usd: 10 });
    expect(r.returns).toEqual({ bs: 100, usd: 1 });
    expect(r.salesNet).toEqual({ bs: 900, usd: 9 });
    expect(r.returnRate).toBeCloseTo(0.1);
    expect(r.avgDiscount).toBeCloseTo(0.2);
    expect(r.units).toBe(40);
  });
  test('missing units and zero sales give 0 and nulls, never NaN', () => {
    const r = mapVentasRecord({ SalesGrossBs: 0, SalesGrossUsd: null, ReturnsBs: 0, ReturnsUsd: 0, GrossAmount: 0, DiscountAmount: 0 });
    expect(r.units).toBe(0);
    expect(r.returnRate).toBeNull();
    expect(r.avgDiscount).toBeNull();
  });
});
