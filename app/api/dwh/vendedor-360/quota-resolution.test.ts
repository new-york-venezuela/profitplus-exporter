import { describe, test, expect } from 'bun:test';
import { resolveQuotaSum } from './quota-resolution';

describe('resolveQuotaSum', () => {
  test('sums quota values across all requested months when every month has a row', () => {
    const result = resolveQuotaSum(
      [{ periodMonth: '2026-09', quotaValue: 1000 }, { periodMonth: '2026-10', quotaValue: 1200 }],
      ['2026-09', '2026-10'],
    );
    expect(result).toEqual({ total: 2200, isPartial: false });
  });

  test('flags the range as partial when a requested month has no row at all', () => {
    const result = resolveQuotaSum(
      [{ periodMonth: '2026-09', quotaValue: 1000 }],
      ['2026-09', '2026-10'],
    );
    expect(result).toEqual({ total: 1000, isPartial: true });
  });

  test('flags the range as partial when a row exists but its quota value is null', () => {
    const result = resolveQuotaSum(
      [{ periodMonth: '2026-09', quotaValue: 1000 }, { periodMonth: '2026-10', quotaValue: null }],
      ['2026-09', '2026-10'],
    );
    expect(result).toEqual({ total: 1000, isPartial: true });
  });

  test('returns a null total (not 0) when no month in range has a quota set at all', () => {
    const result = resolveQuotaSum([], ['2026-09']);
    expect(result).toEqual({ total: null, isPartial: true });
  });

  test('is not partial for a single fully-set month', () => {
    const result = resolveQuotaSum([{ periodMonth: '2026-09', quotaValue: 500 }], ['2026-09']);
    expect(result).toEqual({ total: 500, isPartial: false });
  });
});
