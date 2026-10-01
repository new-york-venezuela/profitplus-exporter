import { describe, test, expect } from 'bun:test';
import { previousMonthRange, periodOptions, isValidDateRange } from '@/lib/geo/date-range';

describe('previousMonthRange', () => {
  test('mid-year', () => expect(previousMonthRange(new Date(2026, 8, 30))).toBe('month:2026-08'));
  test('January wraps to December of the previous year', () => expect(previousMonthRange(new Date(2026, 0, 15))).toBe('month:2025-12'));
});

describe('periodOptions', () => {
  const opts = periodOptions(new Date(2026, 8, 30));
  test('starts with the current month, then walks back 12 months, then YTD', () => {
    expect(opts[0]).toEqual({ value: 'month:2026-09', label: 'Septiembre 2026' });
    expect(opts[1]).toEqual({ value: 'month:2026-08', label: 'Agosto 2026' });
    expect(opts.at(-2)!.value).toBe('month:2025-09');
    expect(opts.at(-1)).toEqual({ value: 'ytd:2026', label: 'Año 2026 (acumulado)' });
  });
  test('every option is a valid range', () => {
    for (const o of opts) expect(isValidDateRange(o.value)).toBe(true);
  });
});

describe('isValidDateRange', () => {
  test('accepts the dashboard formats', () => {
    for (const v of ['month:2026-08', 'ytd:2026', 'custom:2026-01-01:2026-01-31']) expect(isValidDateRange(v)).toBe(true);
  });
  test('rejects garbage, injection attempts and bad months', () => {
    for (const v of ['', '12m', 'month:2026-13', 'month:2026-00', "month:2026-08'; DROP TABLE x;--", 'ytd:20', 'custom:2026-01-01', 'month:2026-8'])
      expect(isValidDateRange(v)).toBe(false);
  });
});
