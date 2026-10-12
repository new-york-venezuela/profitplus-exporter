import { describe, test, expect } from 'bun:test';
import { buildSellerCoverageRows, computeGapVsBaseline, pickTieredLines } from '../../../lib/dwh/seller-coverage';

describe('computeGapVsBaseline', () => {
  test('difference, or null when either side is unknown', () => {
    expect(computeGapVsBaseline(0.5, 0.75)).toBeCloseTo(-0.25, 10);
    expect(computeGapVsBaseline(null, 0.5)).toBeNull();
    expect(computeGapVsBaseline(0.5, null)).toBeNull();
  });
});

describe('pickTieredLines', () => {
  const stats = [
    { line: 'Panaderia', entitiesBuying: 8, salesGrossBs: 100 },   // 0.8 primera
    { line: 'Pizza', entitiesBuying: 4, salesGrossBs: 50 },        // 0.4 segunda
    { line: 'Pasteleria', entitiesBuying: 1, salesGrossBs: 10 },   // 0.1 addon
    { line: 'Navidad', entitiesBuying: 0, salesGrossBs: 0 },       // sin ventas
  ];
  test('keeps primera and segunda lines; baseline is their mean penetration', () => {
    const r = pickTieredLines(stats, 10);
    expect(r.tieredLineNames).toEqual(['Panaderia', 'Pizza']);
    expect(r.baselinePenetration).toBeCloseTo(0.6, 10);
  });
  test('no active entities: nothing is tiered and the baseline is null', () => {
    expect(pickTieredLines(stats, 0)).toEqual({ tieredLineNames: [], baselinePenetration: null });
  });
});

describe('buildSellerCoverageRows', () => {
  const sellers = [
    { salesRepKey: '1', salesRepName: 'Ana', entitiesServed: 4, tieredLinesCovered: 6 },   // 6/(4*2)=0.75
    { salesRepKey: '2', salesRepName: 'Beto', entitiesServed: 4, tieredLinesCovered: 2 },  // 0.25
    { salesRepKey: '3', salesRepName: 'Cris', entitiesServed: 0, tieredLinesCovered: 0 },  // dropped
  ];
  test('own penetration, gap vs baseline, worst gap first, empty sellers dropped', () => {
    const rows = buildSellerCoverageRows(sellers, 2, 0.6);
    expect(rows.map(r => r.salesRepName)).toEqual(['Beto', 'Ana']);
    expect(rows[0].ownPenetration).toBeCloseTo(0.25, 10);
    expect(rows[0].gapVsBaseline).toBeCloseTo(-0.35, 10);
    expect(rows[1].gapVsBaseline).toBeCloseTo(0.15, 10);
    expect(rows[0].baselinePenetration).toBe(0.6);
  });
  test('zero tiered lines gives no rows instead of dividing by zero', () => {
    expect(buildSellerCoverageRows(sellers, 0, null)).toEqual([]);
  });
});
