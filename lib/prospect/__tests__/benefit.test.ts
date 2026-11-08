import { describe, expect, test } from 'bun:test';
import { parseMargin, shelfPrice, weeklyBenefit, type MixLine } from '../benefit';

const line = (code: string, share: number, costUsd: number | null): MixLine => ({
  productCode: code,
  productName: code,
  share,
  costUsd,
});

describe('shelfPrice', () => {
  test('cost / (1 - margin)', () => {
    expect(shelfPrice(3.92, 0.3)).toBeCloseTo(5.6, 10);
  });
});

describe('weeklyBenefit', () => {
  test('single product', () => {
    const r = weeklyBenefit(10, [line('A', 1, 3.92)], 0.3);
    expect(r.benefitUsd).toBeCloseTo(16.8, 10);
    expect(r.incomplete).toBe(false);
  });

  test('two products split by share', () => {
    const r = weeklyBenefit(10, [line('A', 0.6, 3.92), line('B', 0.4, 2)], 0.3);
    const expected = 10 * 0.6 * (3.92 / 0.7 - 3.92) + 10 * 0.4 * (2 / 0.7 - 2);
    expect(r.benefitUsd).toBeCloseTo(expected, 10);
    expect(r.incomplete).toBe(false);
  });

  test('null cost is skipped and flagged incomplete', () => {
    const r = weeklyBenefit(10, [line('A', 0.5, 3.92), line('B', 0.5, null)], 0.3);
    expect(r.benefitUsd).toBeCloseTo(10 * 0.5 * (3.92 / 0.7 - 3.92), 10);
    expect(r.incomplete).toBe(true);
  });

  test('margin 0 gives 0', () => {
    expect(weeklyBenefit(10, [line('A', 1, 3.92)], 0).benefitUsd).toBe(0);
  });
});

describe('parseMargin', () => {
  test('valid percent', () => {
    expect(parseMargin('30')).toBeCloseTo(0.3, 10);
    expect(parseMargin('30.5')).toBeCloseTo(0.305, 10);
    expect(parseMargin('0')).toBe(0);
  });

  test('invalid values', () => {
    expect(parseMargin('100')).toBeNull();
    expect(parseMargin('-1')).toBeNull();
    expect(parseMargin('abc')).toBeNull();
    expect(parseMargin('')).toBeNull();
    expect(parseMargin(null)).toBeNull();
    expect(parseMargin(undefined)).toBeNull();
  });
});
