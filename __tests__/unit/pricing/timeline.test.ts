import { describe, test, expect } from 'bun:test';
import { monthDays, shiftMonth, timelineBars } from '@/lib/pricing/timeline';

const P = (id: number, startsOn: string, endsOn: string) => ({ id, name: `P${id}`, startsOn, endsOn, status: 'active' as const });

describe('monthDays / shiftMonth', () => {
  test('month lengths', () => {
    expect(monthDays('2026-10-01')).toBe(31);
    expect(monthDays('2028-02-01')).toBe(29);
    expect(monthDays('2026-02-01')).toBe(28);
  });
  test('shift across year boundaries', () => {
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01');
    expect(shiftMonth('2026-10-01', 0)).toBe('2026-10-01');
  });
});

describe('timelineBars', () => {
  test('a promotion inside the month', () => {
    const [b] = timelineBars([P(1, '2026-10-05', '2026-10-15')], '2026-10-01');
    expect(b).toMatchObject({ id: 1, startDay: 5, endDay: 15, clippedStart: false, clippedEnd: false, lane: 0 });
  });
  test('clipped at both edges', () => {
    const [a, b] = timelineBars([P(1, '2026-09-20', '2026-10-03'), P(2, '2026-10-28', '2026-11-10')], '2026-10-01');
    expect(a).toMatchObject({ startDay: 1, endDay: 3, clippedStart: true, clippedEnd: false });
    expect(b).toMatchObject({ startDay: 28, endDay: 31, clippedStart: false, clippedEnd: true });
  });
  test('non overlapping promotions are excluded', () => {
    expect(timelineBars([P(1, '2026-09-01', '2026-09-30'), P(2, '2026-11-01', '2026-11-05')], '2026-10-01')).toEqual([]);
  });
  test('leap february', () => {
    const [b] = timelineBars([P(1, '2028-02-10', '2028-03-10')], '2028-02-01');
    expect(b.endDay).toBe(29);
  });
  test('overlaps get increasing lanes and a later bar reuses lane 0', () => {
    const bars = timelineBars([P(3, '2026-10-20', '2026-10-25'), P(2, '2026-10-08', '2026-10-12'), P(1, '2026-10-05', '2026-10-10')], '2026-10-01');
    const lane = (id: number) => bars.find(b => b.id === id)!.lane;
    expect(lane(1)).toBe(0);
    expect(lane(2)).toBe(1);
    expect(lane(3)).toBe(0);
  });
});
