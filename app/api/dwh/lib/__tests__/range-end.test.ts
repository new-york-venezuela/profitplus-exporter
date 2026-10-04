import { describe, test, expect } from 'bun:test';
import { rangeEndDateKey } from '../query-builder';

const today = new Date(Date.UTC(2026, 9, 4)); // 2026-10-04

describe('rangeEndDateKey', () => {
  test('custom range ends on its end date', () => {
    expect(rangeEndDateKey('custom:2026-01-01:2026-02-15', today)).toBe(20260215);
  });
  test('month range ends on last day of that month (leap year)', () => {
    expect(rangeEndDateKey('month:2024-02', today)).toBe(20240229);
    expect(rangeEndDateKey('month:2026-09', today)).toBe(20260930);
  });
  test('current-year ytd ends today; past ytd ends Dec 31', () => {
    expect(rangeEndDateKey('ytd:2026', today)).toBe(20261004);
    expect(rangeEndDateKey('ytd:2025', today)).toBe(20251231);
  });
  test('30d, 12m and unknown values end today', () => {
    expect(rangeEndDateKey('30d', today)).toBe(20261004);
    expect(rangeEndDateKey('12m', today)).toBe(20261004);
    expect(rangeEndDateKey('garbage', today)).toBe(20261004);
  });
});
