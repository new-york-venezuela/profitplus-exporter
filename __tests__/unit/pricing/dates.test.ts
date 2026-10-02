import { describe, test, expect } from 'bun:test';
import { todayIso, isValidIsoDate, addDaysIso, daysBetweenIso } from '@/lib/pricing/dates';

describe('pricing dates', () => {
  test('todayIso uses local calendar date', () => {
    expect(todayIso(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01');
  });
  test('isValidIsoDate rejects bad shapes and impossible dates', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-2-9')).toBe(false);
    expect(isValidIsoDate(20261001)).toBe(false);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
  });
  test('addDaysIso crosses month and year boundaries', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });
  test('daysBetweenIso is signed', () => {
    expect(daysBetweenIso('2026-10-01', '2026-10-13')).toBe(12);
    expect(daysBetweenIso('2026-10-13', '2026-10-01')).toBe(-12);
  });
});
