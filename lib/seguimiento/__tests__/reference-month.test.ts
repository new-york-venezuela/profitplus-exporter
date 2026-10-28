import { describe, expect, test } from 'bun:test';
import { monthPace, resolveReferenceMonth } from '../month-pace';

describe('resolveReferenceMonth', () => {
  test('tracks through yesterday, not today', () => {
    const ref = resolveReferenceMonth('30d', '2026-10-10');
    expect(ref).toEqual({ month: '2026-10', monthStart: '2026-10-01', monthEnd: '2026-10-31', asOf: '2026-10-09' });
  });

  test('on the 1st the new month is shown with nothing elapsed', () => {
    const ref = resolveReferenceMonth('30d', '2026-11-01');
    expect(ref.month).toBe('2026-11');
    expect(ref.asOf).toBe('2026-10-31');
    expect(monthPace(ref.month, ref.asOf).workingDaysElapsed).toBe(0);
  });

  test('current-month range is capped at yesterday', () => {
    expect(resolveReferenceMonth('month:2026-10', '2026-10-10').asOf).toBe('2026-10-09');
  });

  test('past month is unaffected', () => {
    expect(resolveReferenceMonth('month:2026-08', '2026-10-10').asOf).toBe('2026-08-31');
  });
});
