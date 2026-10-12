import { describe, test, expect } from 'bun:test';
import { addDays, daysBetween, parseIso } from '../../../lib/seguimiento/iso-date';
import {
  countWorkingDays, isWorkingDay, monthBounds, monthPace, projectToMonth, resolveReferenceMonth,
} from '../../../lib/seguimiento/month-pace';

describe('iso-date', () => {
  test('addDays and daysBetween cross month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-01', '2026-10-14')).toBe(13);
    expect(daysBetween('2026-10-14', '2026-10-01')).toBe(-13);
  });
  test('parseIso rejects malformed and impossible dates', () => {
    expect(() => parseIso('2026-13-01')).toThrow();
    expect(() => parseIso('2026-02-30')).toThrow();
    expect(() => parseIso('28/03/2026')).toThrow(/YYYY-MM-DD/);
  });
});

describe('working days (weekends only)', () => {
  test('isWorkingDay', () => {
    expect(isWorkingDay('2026-10-02')).toBe(true);  // Friday
    expect(isWorkingDay('2026-10-03')).toBe(false); // Saturday
    expect(isWorkingDay('2026-10-04')).toBe(false); // Sunday
  });
  test('countWorkingDays is inclusive and 0 for an inverted range', () => {
    expect(countWorkingDays('2026-10-01', '2026-10-14')).toBe(10);
    expect(countWorkingDays('2026-10-03', '2026-10-04')).toBe(0);
    expect(countWorkingDays('2026-10-14', '2026-10-01')).toBe(0);
  });
  test('monthBounds handles 28/29/30/31-day months', () => {
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthBounds('2026-10').end).toBe('2026-10-31');
    expect(() => monthBounds('2026-13')).toThrow();
  });
});

describe('monthPace', () => {
  test('October 2026 has 22 working days; 10 elapsed on the 14th', () => {
    const p = monthPace('2026-10', '2026-10-14');
    expect(p).toMatchObject({ workingDaysInMonth: 22, workingDaysElapsed: 10, workingDaysRemaining: 12 });
    expect(p.fractionElapsed).toBeCloseTo(10 / 22, 10);
  });
  test('February 2026 has 20 working days', () => {
    expect(monthPace('2026-02', '2026-02-28').workingDaysInMonth).toBe(20);
  });
  test('asOf on a weekend does not add working days', () => {
    expect(monthPace('2026-10', '2026-10-10').workingDaysElapsed).toBe(7);
  });
  test('asOf before the month is 0 elapsed, after the month is the full month', () => {
    expect(monthPace('2026-10', '2026-09-30').workingDaysElapsed).toBe(0);
    expect(monthPace('2026-10', '2026-11-15').workingDaysElapsed).toBe(22);
    expect(monthPace('2026-10', '2026-11-15').fractionElapsed).toBe(1);
  });
});

describe('projectToMonth', () => {
  const pace = { workingDaysInMonth: 22, workingDaysElapsed: 10 };
  test('actual / (elapsed / inMonth)', () => {
    expect(projectToMonth(1000, pace)).toBe(2200);
    expect(projectToMonth(0, pace)).toBe(0);
  });
  test('null actual or nothing elapsed is null, never Infinity or NaN', () => {
    expect(projectToMonth(null, pace)).toBeNull();
    expect(projectToMonth(1000, { workingDaysInMonth: 22, workingDaysElapsed: 0 })).toBeNull();
  });
  test('closed month projects to the actual', () => {
    expect(projectToMonth(1234, { workingDaysInMonth: 22, workingDaysElapsed: 22 })).toBe(1234);
  });
});

describe('resolveReferenceMonth', () => {
  const today = '2026-10-11';
  test('month:YYYY-MM past month is closed', () => {
    expect(resolveReferenceMonth('month:2026-09', today)).toEqual({
      month: '2026-09', monthStart: '2026-09-01', monthEnd: '2026-09-30', asOf: '2026-09-30',
    });
  });
  test('month:YYYY-MM current month is as of today', () => {
    expect(resolveReferenceMonth('month:2026-10', today).asOf).toBe('2026-10-11');
  });
  test('trailing windows and unknown values use the current month', () => {
    for (const r of ['30d', '12m', 'weird']) {
      expect(resolveReferenceMonth(r, today)).toMatchObject({ month: '2026-10', asOf: '2026-10-11' });
    }
  });
  test('custom range uses the month and day of its end', () => {
    expect(resolveReferenceMonth('custom:2026-08-03:2026-09-15', today)).toMatchObject({ month: '2026-09', asOf: '2026-09-15' });
  });
  test('ytd: current year is this month, past year is December of that year', () => {
    expect(resolveReferenceMonth('ytd:2026', today).month).toBe('2026-10');
    expect(resolveReferenceMonth('ytd:2025', today)).toMatchObject({ month: '2025-12', asOf: '2025-12-31' });
  });
  test('an impossible month falls back to the current month instead of throwing', () => {
    expect(resolveReferenceMonth('month:2026-13', today).month).toBe('2026-10');
  });
  test('a future month is not elapsed at all', () => {
    const ref = resolveReferenceMonth('month:2027-01', today);
    expect(ref.asOf).toBe(today);
    expect(monthPace(ref.month, ref.asOf).workingDaysElapsed).toBe(0);
  });
});
