import { describe, test, expect } from 'bun:test';
import { isoWeekOf, isoWeeksOfMonth } from '../../../lib/seguimiento/iso-weeks';

describe('isoWeekOf', () => {
  test('Thursday 2026-10-01 is 2026-W40 starting Monday 2026-09-28', () => {
    expect(isoWeekOf('2026-10-01')).toEqual({ yearWeek: '2026-W40', weekStart: '2026-09-28', weekEnd: '2026-10-04', label: 'S40' });
  });
  test('a Sunday belongs to the week that started the Monday before', () => {
    expect(isoWeekOf('2026-10-11')).toMatchObject({ yearWeek: '2026-W41', weekStart: '2026-10-05' });
  });
  test('year boundaries use the year of the Thursday', () => {
    expect(isoWeekOf('2026-01-01')).toMatchObject({ yearWeek: '2026-W01', weekStart: '2025-12-29' });
    expect(isoWeekOf('2024-12-30')).toMatchObject({ yearWeek: '2025-W01' });
    expect(isoWeekOf('2027-01-01')).toMatchObject({ yearWeek: '2026-W53' });
  });
});

describe('isoWeeksOfMonth', () => {
  test('October 2026 spans weeks 40-44 (the workbook weeks)', () => {
    const weeks = isoWeeksOfMonth('2026-10');
    expect(weeks.map(w => w.yearWeek)).toEqual(['2026-W40', '2026-W41', '2026-W42', '2026-W43', '2026-W44']);
    expect(weeks[0].weekStart).toBe('2026-09-28');
    expect(weeks[4].weekEnd).toBe('2026-11-01');
  });
  test('a month starting on Monday does not include the previous week', () => {
    expect(isoWeeksOfMonth('2026-06')[0].weekStart).toBe('2026-06-01');
  });
  test('January 2027 starts in 2026-W53', () => {
    expect(isoWeeksOfMonth('2027-01')[0].yearWeek).toBe('2026-W53');
  });
});
