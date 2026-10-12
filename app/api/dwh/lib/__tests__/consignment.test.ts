import { describe, test, expect } from 'bun:test';
import { isConsignmentPattern, DEFAULT_ROOT_SHARE_THRESHOLD } from '../consignment';

describe('isConsignmentPattern', () => {
  test('flags a chain with 90% root-billed sales (Excelsior Gama-like)', () => {
    expect(isConsignmentPattern(17_847_304.71, 19_767_993.52, DEFAULT_ROOT_SHARE_THRESHOLD)).toBe(true);
  });

  test('does not flag a chain billed correctly per-tienda (1% root share)', () => {
    expect(isConsignmentPattern(142_407.05, 13_566_849.56, DEFAULT_ROOT_SHARE_THRESHOLD)).toBe(false);
  });

  test('does not flag a chain with zero total sales (avoid divide-by-zero false positive)', () => {
    expect(isConsignmentPattern(0, 0, DEFAULT_ROOT_SHARE_THRESHOLD)).toBe(false);
  });

  test('respects a custom threshold', () => {
    expect(isConsignmentPattern(30, 100, 0.5)).toBe(false);
    expect(isConsignmentPattern(60, 100, 0.5)).toBe(true);
  });

  test('boundary: exactly at threshold counts as flagged (>=, not >)', () => {
    expect(isConsignmentPattern(15, 100, 0.15)).toBe(true);
  });
});
