import { describe, test, expect } from 'bun:test';
import { computeGapVsBaseline } from '../seller-coverage';

describe('computeGapVsBaseline', () => {
  test('positive gap when seller outperforms baseline', () => {
    expect(computeGapVsBaseline(0.8, 0.6)).toBeCloseTo(0.2);
  });

  test('negative gap when seller underperforms baseline', () => {
    expect(computeGapVsBaseline(0.4, 0.6)).toBeCloseTo(-0.2);
  });

  test('null when either input is null', () => {
    expect(computeGapVsBaseline(null, 0.6)).toBeNull();
    expect(computeGapVsBaseline(0.4, null)).toBeNull();
    expect(computeGapVsBaseline(null, null)).toBeNull();
  });

  test('zero gap when equal to baseline', () => {
    expect(computeGapVsBaseline(0.5, 0.5)).toBe(0);
  });
});
