import { describe, test, expect } from 'bun:test';
import {
  HIST_START_KEY, HIST_END_KEY, keyToIso, isoToKey,
  resolveHistRange, histRangeWhere, previousRange, histPresetRange,
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

  test('month-prev is the month before it', () => {
    const last = resolveHistRange(histPresetRange('month'));
    const prev = resolveHistRange(histPresetRange('month-prev'));
    expect(prev.endKey).toBeLessThan(last.startKey);
  });

  test('all spans the whole window', () => {
    expect(resolveHistRange(histPresetRange('all'))).toEqual({ startKey: HIST_START_KEY, endKey: HIST_END_KEY, empty: false });
  });

  test('every preset is a concrete custom: or month: value', () => {
    for (const p of ['30d', 'month', 'month-prev', 'year', '12m', 'all'] as const) {
      expect(histPresetRange(p)).toMatch(/^(custom:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}|month:\d{4}-\d{2})$/);
    }
  });
});
