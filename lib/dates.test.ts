import { describe, test, expect } from 'bun:test';
import { getPreviousMonthRange, parseDate } from './dates';

describe('getPreviousMonthRange', () => {
  test('mid-month July → June', () => {
    expect(getPreviousMonthRange(new Date('2026-07-10')))
      .toEqual({ startDate: '2026-06-01', endDate: '2026-06-30' });
  });

  test('January wraps to previous year December', () => {
    expect(getPreviousMonthRange(new Date('2026-01-15')))
      .toEqual({ startDate: '2025-12-01', endDate: '2025-12-31' });
  });

  test('March after February in a leap year', () => {
    expect(getPreviousMonthRange(new Date('2024-03-05')))
      .toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
  });

  test('August → July (31-day month)', () => {
    expect(getPreviousMonthRange(new Date('2026-08-01')))
      .toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' });
  });
});

describe('parseDate', () => {
  test('returns null for null input', () => expect(parseDate(null)).toBeNull());
  test('returns null for US format', () => expect(parseDate('07/10/2026')).toBeNull());
  test('returns null for single-digit month', () => expect(parseDate('2026-7-1')).toBeNull());
  test('returns the string for valid YYYY-MM-DD', () => expect(parseDate('2026-06-01')).toBe('2026-06-01'));
});
