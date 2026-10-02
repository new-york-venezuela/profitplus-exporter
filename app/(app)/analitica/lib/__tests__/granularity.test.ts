import { describe, test, expect } from 'bun:test';
import {
  rangeSpanDays,
  allowedGranularities,
  defaultGranularity,
  resolveGranularity,
  weekOfYear,
  bucketMode,
  bucketLabel,
  bucketSpan,
  bucketLabels,
  bucketTitle,
} from '../granularity';

const TODAY = new Date(Date.UTC(2026, 9, 1)); // 2026-10-01

describe('rangeSpanDays', () => {
  test('30d spans 30 days', () => {
    expect(rangeSpanDays('30d', TODAY)).toBe(30);
  });

  test('12m spans 365 days (matches the buildDateWhereClause fallback)', () => {
    expect(rangeSpanDays('12m', TODAY)).toBe(365);
  });

  test('month:YYYY-MM spans the calendar month length', () => {
    expect(rangeSpanDays('month:2026-02', TODAY)).toBe(28);
    expect(rangeSpanDays('month:2026-03', TODAY)).toBe(31);
  });

  test('ytd of the current year runs Jan 1 through today inclusive', () => {
    expect(rangeSpanDays('ytd:2026', TODAY)).toBe(274);
  });

  test('ytd of a past year spans the whole year', () => {
    expect(rangeSpanDays('ytd:2025', TODAY)).toBe(365);
    expect(rangeSpanDays('ytd:2024', TODAY)).toBe(366);
  });

  test('custom range is inclusive of both ends', () => {
    expect(rangeSpanDays('custom:2026-01-01:2026-01-31', TODAY)).toBe(31);
    expect(rangeSpanDays('custom:2026-01-01:2026-01-01', TODAY)).toBe(1);
  });

  test('unknown values fall back to 365 like buildDateWhereClause', () => {
    expect(rangeSpanDays('bogus', TODAY)).toBe(365);
  });
});

describe('allowedGranularities / defaultGranularity', () => {
  test('a single month allows day, week and month; defaults to day', () => {
    expect(allowedGranularities('month:2026-09', TODAY)).toEqual(['day', 'week', 'month']);
    expect(defaultGranularity('month:2026-09', TODAY)).toBe('day');
  });

  test('30d allows day, week and month; defaults to day', () => {
    expect(allowedGranularities('30d', TODAY)).toEqual(['day', 'week', 'month']);
    expect(defaultGranularity('30d', TODAY)).toBe('day');
  });

  test('31 days is still "within a month", 32 days is not', () => {
    expect(allowedGranularities('custom:2026-01-01:2026-01-31', TODAY)).toContain('day');
    expect(allowedGranularities('custom:2026-01-01:2026-02-01', TODAY)).not.toContain('day');
  });

  test('over a month and up to three months: week or month, defaults to week', () => {
    const range = 'custom:2026-01-01:2026-04-02'; // 92 days
    expect(rangeSpanDays(range, TODAY)).toBe(92);
    expect(allowedGranularities(range, TODAY)).toEqual(['week', 'month']);
    expect(defaultGranularity(range, TODAY)).toBe('week');
  });

  test('over three months up to a year: week or month, defaults to month', () => {
    const range = 'custom:2026-01-01:2026-04-03'; // 93 days
    expect(allowedGranularities(range, TODAY)).toEqual(['week', 'month']);
    expect(defaultGranularity(range, TODAY)).toBe('month');
    expect(allowedGranularities('12m', TODAY)).toEqual(['week', 'month']);
    expect(defaultGranularity('12m', TODAY)).toBe('month');
  });

  test('over a year only allows month', () => {
    const range = 'custom:2025-01-01:2026-01-02'; // 367 days
    expect(rangeSpanDays(range, TODAY)).toBe(367);
    expect(allowedGranularities(range, TODAY)).toEqual(['month']);
    expect(defaultGranularity(range, TODAY)).toBe('month');
  });

  test('ytd early in the year behaves like a short range', () => {
    const jan20 = new Date(Date.UTC(2026, 0, 20));
    expect(allowedGranularities('ytd:2026', jan20)).toEqual(['day', 'week', 'month']);
    expect(defaultGranularity('ytd:2026', jan20)).toBe('day');
  });
});

describe('resolveGranularity', () => {
  test('returns the requested granularity when allowed', () => {
    expect(resolveGranularity('30d', 'week', TODAY)).toBe('week');
  });

  test('falls back to the default when the request is not allowed for the range', () => {
    expect(resolveGranularity('12m', 'day', TODAY)).toBe('month');
  });

  test('falls back to the default when the request is missing or garbage', () => {
    expect(resolveGranularity('30d', null, TODAY)).toBe('day');
    expect(resolveGranularity('30d', 'fortnight', TODAY)).toBe('day');
  });
});

describe('weekOfYear', () => {
  test('Jan 1 2026 (a Thursday) is week 1', () => {
    expect(weekOfYear('2026-01-01')).toEqual({ year: 2026, week: 1, start: '2026-01-01', end: '2026-01-04' });
  });

  test('Jan 9 2026 is week 2 (Mon Jan 5 - Sun Jan 11)', () => {
    expect(weekOfYear('2026-01-09')).toEqual({ year: 2026, week: 2, start: '2026-01-05', end: '2026-01-11' });
  });

  test('Mon Jan 5 starts week 2 and Sun Jan 4 still belongs to week 1', () => {
    expect(weekOfYear('2026-01-05').week).toBe(2);
    expect(weekOfYear('2026-01-04').week).toBe(1);
  });

  test('weeks are split at the year boundary', () => {
    const dec31 = weekOfYear('2025-12-31');
    expect(dec31.year).toBe(2025);
    expect(dec31.start).toBe('2025-12-29');
    expect(dec31.end).toBe('2025-12-31'); // clipped to the year
    expect(dec31.week).toBe(53);
  });

  test('a year that starts on Monday has full week 1', () => {
    expect(weekOfYear('2024-01-01')).toEqual({ year: 2024, week: 1, start: '2024-01-01', end: '2024-01-07' });
  });
});

describe('bucketMode', () => {
  test('month within a one-month range collapses to a single aggregate bucket', () => {
    expect(bucketMode('30d', 'month', TODAY)).toBe('range');
    expect(bucketMode('month:2026-09', 'month', TODAY)).toBe('range');
  });

  test('month over a longer range is calendar months', () => {
    expect(bucketMode('12m', 'month', TODAY)).toBe('month');
  });

  test('day and week pass through', () => {
    expect(bucketMode('30d', 'day', TODAY)).toBe('day');
    expect(bucketMode('30d', 'week', TODAY)).toBe('week');
  });
});

describe('bucketLabel', () => {
  test('day shows day and short month', () => {
    expect(bucketLabel('day', '2026-01-09')).toBe('9 Ene');
  });

  test('week shows S<number>', () => {
    expect(bucketLabel('week', '2026-W02')).toBe('S2');
  });

  test('week adds a 2-digit year when the range spans several years', () => {
    expect(bucketLabel('week', '2025-W53', { multiYear: true })).toBe("S53 '25");
  });

  test('month shows short month and 2-digit year', () => {
    expect(bucketLabel('month', '2026-01')).toBe('Ene 26');
  });

  test('range is a fixed total label', () => {
    expect(bucketLabel('range', 'range')).toBe('Total del período');
  });
});

describe('bucketSpan', () => {
  test('day is a single date', () => {
    expect(bucketSpan('day', '2026-01-09')).toEqual({ start: '2026-01-09', end: '2026-01-09' });
  });

  test('week resolves to its Monday-Sunday dates clipped to the year', () => {
    expect(bucketSpan('week', '2026-W01')).toEqual({ start: '2026-01-01', end: '2026-01-04' });
    expect(bucketSpan('week', '2026-W02')).toEqual({ start: '2026-01-05', end: '2026-01-11' });
    expect(bucketSpan('week', '2025-W53')).toEqual({ start: '2025-12-29', end: '2025-12-31' });
  });

  test('month spans the calendar month', () => {
    expect(bucketSpan('month', '2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  test('range has no span of its own', () => {
    expect(bucketSpan('range', 'range')).toBeNull();
  });

  test('malformed keys return null', () => {
    expect(bucketSpan('week', '2026-W99')).toBeNull();
    expect(bucketSpan('day', 'nope')).toBeNull();
  });
});

describe('bucketLabels', () => {
  test('labels week keys without a year when all keys share a year', () => {
    expect(bucketLabels('week', ['2026-W01', '2026-W02'])).toEqual(['S1', 'S2']);
  });

  test('adds the year to week labels once keys span several years', () => {
    expect(bucketLabels('week', ['2025-W53', '2026-W01'])).toEqual(["S53 '25", "S1 '26"]);
  });
});

describe('bucketTitle', () => {
  test('week title carries the number and the dates', () => {
    expect(bucketTitle('week', '2026-W02')).toBe('Semana 2 · 5–11 ene 2026');
  });

  test('partial first week shows its clipped dates', () => {
    expect(bucketTitle('week', '2026-W01')).toBe('Semana 1 · 1–4 ene 2026');
  });

  test('day title is the full date', () => {
    expect(bucketTitle('day', '2026-01-09')).toBe('9 ene 2026');
  });

  test('month title is the full month and year', () => {
    expect(bucketTitle('month', '2026-02')).toBe('feb 2026');
  });

  test('week crossing a month boundary shows both months', () => {
    expect(bucketTitle('week', '2026-W06')).toBe('Semana 6 · 2–8 feb 2026');
    expect(bucketTitle('week', '2026-W05')).toBe('Semana 5 · 26 ene–1 feb 2026');
  });

  test('range title is the fixed label', () => {
    expect(bucketTitle('range', 'range')).toBe('Total del período');
  });
});
