import { describe, test, expect } from 'bun:test';
import {
  HIST_START_KEY, HIST_END_KEY, keyToIso, isoToKey,
  resolveHistRange, histRangeWhere, previousRange, histPresetRange,
  histYears, histYearRange, histLastCompleteYear, histYearOfRange, histMonthsOfYear, histStepYear,
  histQuarterRange, histQuartersOfYear, histLastCompleteQuarter,
} from './window';

describe('key helpers', () => {
  test('keyToIso / isoToKey round-trip', () => {
    expect(keyToIso(20240229)).toBe('2024-02-29');
    expect(isoToKey('2024-02-29')).toBe(20240229);
  });
});

describe('resolveHistRange', () => {
  test('a month before the window is empty', () => {
    expect(resolveHistRange('month:2019-12').empty).toBe(true);
  });

  test('a leap-year February ends on the 29th', () => {
    expect(resolveHistRange('month:2024-02')).toEqual({ startKey: 20240201, endKey: 20240229, empty: false });
  });

  test('a custom range entirely after the window is empty', () => {
    expect(resolveHistRange('custom:2099-03-10:2099-03-20').empty).toBe(true);
  });

  test('a reversed custom range is swapped', () => {
    expect(resolveHistRange('custom:2024-03-20:2024-03-10')).toEqual({ startKey: 20240310, endKey: 20240320, empty: false });
  });

  test('a custom range straddling the window start is clamped', () => {
    const r = resolveHistRange('custom:2019-06-01:2020-01-31');
    expect(r.startKey).toBe(HIST_START_KEY);
    expect(r.endKey).toBe(20200131);
  });

  test('ytd of a past year is the whole calendar year', () => {
    expect(resolveHistRange('ytd:2023')).toEqual({ startKey: 20230101, endKey: 20231231, empty: false });
  });

  test('30d is 30 days ending at the window end', () => {
    const r = resolveHistRange('30d');
    expect(r.endKey).toBe(HIST_END_KEY);
    expect(isoToKey(keyToIso(r.startKey))).toBe(r.startKey);
    const days = (Date.parse(keyToIso(r.endKey)) - Date.parse(keyToIso(r.startKey))) / 86_400_000 + 1;
    expect(days).toBe(30);
  });

  test('an unknown value or an impossible date equals the 12m result', () => {
    expect(resolveHistRange('garbage')).toEqual(resolveHistRange('12m'));
    expect(resolveHistRange('custom:2024-13-45:2024-14-01')).toEqual(resolveHistRange('12m'));
  });
});

describe('histRangeWhere', () => {
  test('builds an integer-only AND clause', () => {
    expect(histRangeWhere({ startKey: 20250101, endKey: 20250131 }, 'fsl')).toBe(
      'AND fsl.DateKey >= 20250101 AND fsl.DateKey <= 20250131',
    );
    expect(histRangeWhere({ startKey: 20250101, endKey: 20250131 }, 'frl', 'OriginalInvoiceDateKey')).toBe(
      'AND frl.OriginalInvoiceDateKey >= 20250101 AND frl.OriginalInvoiceDateKey <= 20250131',
    );
  });
});

describe('previousRange', () => {
  test('a range starting at the window start has no previous period', () => {
    expect(previousRange('custom:2020-01-01:2020-01-31')).toBeNull();
  });

  test('a month maps to the previous calendar month', () => {
    expect(previousRange('month:2025-03')).toEqual({ startKey: 20250201, endKey: 20250228 });
    expect(previousRange('month:2025-01')).toEqual({ startKey: 20241201, endKey: 20241231 });
  });

  test('a custom range maps to the equal-length window immediately before', () => {
    expect(previousRange('custom:2025-03-11:2025-03-20')).toEqual({ startKey: 20250301, endKey: 20250310 });
  });

  test('ytd of a past year maps to the whole previous year, null at the window start', () => {
    expect(previousRange('ytd:2023')).toEqual({ startKey: 20220101, endKey: 20221231 });
    expect(previousRange('ytd:2020')).toBeNull();
  });
});

describe('histPresetRange', () => {
  test('month is the last month of the window and round-trips', () => {
    const value = histPresetRange('month');
    expect(value).toMatch(/^month:\d{4}-\d{2}$/);
    expect(resolveHistRange(value).endKey).toBe(HIST_END_KEY);
  });

  test('last-year is the last COMPLETE calendar year, prev-year the one before it', () => {
    const last = resolveHistRange(histPresetRange('last-year'));
    const prev = resolveHistRange(histPresetRange('prev-year'));
    const y = histLastCompleteYear();
    expect(last).toEqual({ startKey: y * 10000 + 101, endKey: y * 10000 + 1231, empty: false });
    expect(prev).toEqual({ startKey: (y - 1) * 10000 + 101, endKey: (y - 1) * 10000 + 1231, empty: false });
  });

  test('all spans the whole window', () => {
    expect(resolveHistRange(histPresetRange('all'))).toEqual({ startKey: HIST_START_KEY, endKey: HIST_END_KEY, empty: false });
  });

  test('every preset is a concrete custom: or month: value', () => {
    for (const p of ['month', 'last-quarter', 'last-year', 'prev-year', '12m', 'all'] as const) {
      expect(histPresetRange(p)).toMatch(/^(custom:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}|month:\d{4}-\d{2})$/);
    }
  });
});

describe('year helpers', () => {
  test('histYears lists every calendar year of the window, newest first', () => {
    const years = histYears();
    expect(years[0]).toBe(Math.floor(HIST_END_KEY / 10000));
    expect(years[years.length - 1]).toBe(Math.floor(HIST_START_KEY / 10000));
    expect([...years].sort((a, b) => b - a)).toEqual(years);
    expect(new Set(years).size).toBe(years.length);
  });

  test('histLastCompleteYear is the year before the window end unless the data ends on Dec 31', () => {
    const endYear = Math.floor(HIST_END_KEY / 10000);
    expect(histLastCompleteYear()).toBe(HIST_END_KEY % 10000 === 1231 ? endYear : endYear - 1);
  });

  test('histYearRange is the whole calendar year, clamped to the window', () => {
    expect(histYearRange(2024)).toBe('custom:2024-01-01:2024-12-31');
    expect(histYearRange(Math.floor(HIST_END_KEY / 10000))).toBe(`custom:${Math.floor(HIST_END_KEY / 10000)}-01-01:${HIST_END_KEY % 10000 === 1231 ? `${Math.floor(HIST_END_KEY / 10000)}-12-31` : `${String(HIST_END_KEY).slice(0, 4)}-${String(HIST_END_KEY).slice(4, 6)}-${String(HIST_END_KEY).slice(6, 8)}`}`);
    expect(histYearRange(2020)).toBe('custom:2020-01-01:2020-12-31');
  });

  test('histYearOfRange: the year a month or a single-year range belongs to, null across years', () => {
    expect(histYearOfRange('month:2024-05')).toBe(2024);
    expect(histYearOfRange('custom:2025-01-01:2025-12-31')).toBe(2025);
    expect(histYearOfRange('custom:2025-03-10:2025-04-02')).toBe(2025);
    expect(histYearOfRange(histPresetRange('12m'))).toBeNull(); // Mar 2025 - Feb 2026 spans two years
    expect(histYearOfRange(histPresetRange('all'))).toBeNull();
    expect(histYearOfRange('garbage')).toBeNull();
  });

  test('histMonthsOfYear lists 12 months and disables the ones outside the window', () => {
    const months = histMonthsOfYear(2024);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ key: '2024-01', month: 1, enabled: true });
    expect(months.every(m => m.enabled)).toBe(true);
    const endYear = Math.floor(HIST_END_KEY / 10000);
    const endMonth = Math.floor((HIST_END_KEY % 10000) / 100);
    const last = histMonthsOfYear(endYear);
    expect(last.filter(m => m.enabled).length).toBe(endMonth);
    expect(last[endMonth - 1].enabled).toBe(true);
    if (endMonth < 12) expect(last[endMonth].enabled).toBe(false);
  });

  test('a year outside the window has no enabled month', () => {
    expect(histMonthsOfYear(2019).some(m => m.enabled)).toBe(false);
  });
});

describe('quarters', () => {
  test('histQuarterRange is three calendar months, clamped to the window', () => {
    expect(histQuarterRange(2025, 2)).toBe('custom:2025-04-01:2025-06-30');
    expect(histQuarterRange(2024, 1)).toBe('custom:2024-01-01:2024-03-31');
    expect(histQuarterRange(2024, 4)).toBe('custom:2024-10-01:2024-12-31');
  });

  test('histQuartersOfYear lists T1..T4 and disables the ones with no data', () => {
    const q = histQuartersOfYear(2024);
    expect(q.map(x => x.key)).toEqual(['2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4']);
    expect(q.every(x => x.enabled)).toBe(true);
    const endYear = Math.floor(HIST_END_KEY / 10000);
    const endQuarter = Math.ceil(Math.floor((HIST_END_KEY % 10000) / 100) / 3);
    const last = histQuartersOfYear(endYear);
    expect(last.filter(x => x.enabled).length).toBe(endQuarter);
    expect(histQuartersOfYear(2019).some(x => x.enabled)).toBe(false);
  });

  test('histLastCompleteQuarter is the latest quarter fully covered by the data', () => {
    const { year, quarter } = histLastCompleteQuarter();
    const r = resolveHistRange(histQuarterRange(year, quarter));
    const qEnd = year * 10000 + quarter * 300 + (quarter === 1 || quarter === 4 ? 31 : 30);
    expect(r.endKey).toBe(qEnd);
    expect(r.endKey).toBeLessThanOrEqual(HIST_END_KEY);
    // the next quarter is not complete
    const next = quarter === 4 ? { y: year + 1, q: 1 } : { y: year, q: quarter + 1 };
    const nr = resolveHistRange(histQuarterRange(next.y, next.q));
    expect(nr.empty || nr.endKey < next.y * 10000 + next.q * 300).toBe(true);
  });

  test('the last-quarter preset is that quarter', () => {
    const { year, quarter } = histLastCompleteQuarter();
    expect(histPresetRange('last-quarter')).toBe(histQuarterRange(year, quarter));
  });
});

describe('histStepYear (same period, adjacent year)', () => {
  const newest = histYears()[0];
  const oldest = histYears()[histYears().length - 1];

  test('a whole year steps to the adjacent whole year', () => {
    expect(histStepYear(histYearRange(2024), -1)).toBe(histYearRange(2023));
    expect(histStepYear(histYearRange(2024), 1)).toBe(histYearRange(2025));
  });

  test('a month keeps its month in the adjacent year', () => {
    expect(histStepYear('month:2024-05', -1)).toBe('month:2023-05');
    expect(histStepYear('month:2023-05', 1)).toBe('month:2024-05');
  });

  test('a month with no data in the target year falls back to that whole year', () => {
    const endMonth = Math.floor((HIST_END_KEY % 10000) / 100);
    if (endMonth < 12) expect(histStepYear(`month:${newest - 1}-12`, 1)).toBe(histYearRange(newest));
  });

  test('a quarter or any range inside a year keeps its dates in the adjacent year', () => {
    expect(histStepYear(histQuarterRange(2024, 2), -1)).toBe(histQuarterRange(2023, 2));
    expect(histStepYear('custom:2023-03-10:2023-04-02', 1)).toBe('custom:2024-03-10:2024-04-02');
  });

  test('a leap day lands on the last day of February of a non-leap year', () => {
    expect(histStepYear('custom:2024-02-20:2024-02-29', 1)).toBe('custom:2025-02-20:2025-02-28');
  });

  test('a range spanning years shifts by exactly one year (rolling 12 months compare with the previous 12)', () => {
    const r12 = resolveHistRange(histPresetRange('12m'));
    const back = histStepYear(histPresetRange('12m'), -1)!;
    const rb = resolveHistRange(back);
    expect(rb.startKey).toBe(r12.startKey - 10000);
    expect(rb.endKey).toBe(r12.endKey - 10000);
  });

  test('stepping outside the data is null', () => {
    expect(histStepYear(histYearRange(oldest), -1)).toBeNull();
    expect(histStepYear(histYearRange(newest), 1)).toBeNull();
    expect(histStepYear(histPresetRange('12m'), 1)).toBeNull();
    expect(histStepYear(histPresetRange('all'), -1)).toBeNull();
    expect(histStepYear(histPresetRange('all'), 1)).toBeNull();
    expect(histStepYear(histQuarterRange(oldest, 1), -1)).toBeNull();
  });
});
