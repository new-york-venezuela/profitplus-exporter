import { describe, expect, test } from 'bun:test';
import { localDateKey, localIsoDate } from '../../lib/local-date';
import { monthPace } from '../../lib/seguimiento/month-pace';

describe('localIsoDate', () => {
  test('uses the host calendar date, not the UTC one (evening in Caracas is already tomorrow in UTC)', () => {
    const evening = new Date(2026, 9, 15, 22, 9);          // Oct 15, 22:09 host time
    expect(localIsoDate(evening)).toBe('2026-10-15');
    expect(localDateKey(evening)).toBe(20261015);
    expect(localIsoDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
  test('Thu 15 Oct 2026 is working day 11 of 22; the UTC date (Fri 16th) would have said 12', () => {
    expect(monthPace('2026-10', localIsoDate(new Date(2026, 9, 15, 22, 9)))).toMatchObject({ workingDaysElapsed: 11, workingDaysInMonth: 22 });
    expect(monthPace('2026-10', '2026-10-16').workingDaysElapsed).toBe(12);
  });
});
