import { describe, test, expect } from 'bun:test';
import { IMPORT_START_DATE, IMPORT_END_DATE } from '../../dwh-legacy-2025-import';

describe('legacy import date window', () => {
  test('starts January 1, 2020', () => {
    expect(IMPORT_START_DATE).toBe('2020-01-01');
  });

  test('ends February 28, 2026 (2026 is not a leap year)', () => {
    expect(IMPORT_END_DATE).toBe('2026-02-28');
    expect(2026 % 4).not.toBe(0);
  });
});
