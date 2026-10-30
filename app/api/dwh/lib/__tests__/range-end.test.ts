import { describe, test, expect } from 'bun:test';
import { rangeEndDateKey, rangeStartDateKey, previousDayKey } from '../query-builder';

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

describe('rangeStartDateKey', () => {
  test('month and ytd start on the first day', () => {
    expect(rangeStartDateKey('month:2026-01', today)).toBe(20260101);
    expect(rangeStartDateKey('ytd:2025', today)).toBe(20250101);
  });
  test('custom starts on its start date', () => {
    expect(rangeStartDateKey('custom:2026-03-01:2026-03-31', today)).toBe(20260301);
  });
  test('30d is today-29, 12m and unknown are today-365', () => {
    expect(rangeStartDateKey('30d', today)).toBe(20260905);
    expect(rangeStartDateKey('12m', today)).toBe(20251004);
    expect(rangeStartDateKey('garbage', today)).toBe(20251004);
  });
});

describe('previousDayKey', () => {
  test('rolls back across month and year boundaries', () => {
    expect(previousDayKey(20260101)).toBe(20251231);
    expect(previousDayKey(20260301)).toBe(20260228);
    expect(previousDayKey(20240301)).toBe(20240229);
    expect(previousDayKey(20261015)).toBe(20261014);
  });
  test('opening key of month:2026-01 is 20251231; custom starting on the 1st rolls back a month', () => {
    expect(previousDayKey(rangeStartDateKey('month:2026-01', today))).toBe(20251231);
    expect(previousDayKey(rangeStartDateKey('custom:2026-05-01:2026-05-20', today))).toBe(20260430);
  });
});
