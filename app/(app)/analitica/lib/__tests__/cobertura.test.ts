import { describe, test, expect } from 'bun:test';
import {
  LAPSED_AFTER_DAYS, NO_SELLER, daysBetweenKeys, classifyCoverage, trailingWindowStartKey,
  averageOverInvoicedMonths, compareDaysSince, filterCobertura, summarizeCobertura, groupBySeller,
} from '../cobertura';

describe('daysBetweenKeys', () => {
  test('counts calendar days across a month boundary', () => {
    expect(daysBetweenKeys(20260930, 20261004)).toBe(4);
    expect(daysBetweenKeys(20261004, 20261004)).toBe(0);
  });
});

describe('classifyCoverage', () => {
  const today = 20261004;
  test('no own and no entity sales is never', () => {
    expect(classifyCoverage(null, null, today)).toEqual({ status: 'never', daysSinceLastSale: null });
  });
  test('no own sales but entity sold is via_matriz with no own days', () => {
    expect(classifyCoverage(null, 20260901, today)).toEqual({ status: 'via_matriz', daysSinceLastSale: null });
  });
  test('exactly 30 days is still active, 31 is lapsed', () => {
    expect(classifyCoverage(20260904, null, today).status).toBe('active');
    expect(classifyCoverage(20260903, null, today).status).toBe('lapsed');
    expect(LAPSED_AFTER_DAYS).toBe(30);
  });
});

describe('trailingWindowStartKey', () => {
  test('is the first day of the month 11 months back', () => {
    expect(trailingWindowStartKey(new Date(Date.UTC(2026, 9, 4)))).toBe(20251101);
    expect(trailingWindowStartKey(new Date(Date.UTC(2026, 0, 15)))).toBe(20250201);
  });
});

describe('averageOverInvoicedMonths', () => {
  test('divides by invoiced months only (Jan, Mar, Apr = 3)', () => {
    const r = averageOverInvoicedMonths([{ units: 30, usd: 300 }, { units: 60, usd: 600 }, { units: 90, usd: 900 }]);
    expect(r).toEqual({ avgUnits: 60, avgUsd: 600, months: 3 });
  });
  test('no invoiced months is null', () => expect(averageOverInvoicedMonths([])).toBeNull());
  test('usd is null when no month has a USD figure', () => {
    expect(averageOverInvoicedMonths([{ units: 10, usd: null }])).toEqual({ avgUnits: 10, avgUsd: null, months: 1 });
  });
});

describe('compareDaysSince', () => {
  const row = (days: number | null, status: 'never' | 'via_matriz' | 'lapsed' | 'active', customerName: string) =>
    ({ daysSinceLastSale: days, status, customerName });
  test('ascending: no data first, then most days down to fewest', () => {
    const rows = [row(5, 'active', 'e'), row(null, 'via_matriz', 'b'), row(90, 'lapsed', 'd'), row(null, 'never', 'a')];
    const sorted = [...rows].sort((x, y) => compareDaysSince(x, y, 'asc')).map(r => r.customerName);
    expect(sorted).toEqual(['a', 'b', 'd', 'e']);
  });
  test('descending is the exact reverse', () => {
    const rows = [row(5, 'active', 'e'), row(null, 'never', 'a'), row(90, 'lapsed', 'd')];
    const sorted = [...rows].sort((x, y) => compareDaysSince(x, y, 'desc')).map(r => r.customerName);
    expect(sorted).toEqual(['e', 'd', 'a']);
  });
});

describe('filter / summarize / group', () => {
  const rows = [
    { sellerCode: 'V1', sellerName: 'Ana', status: 'never' as const },
    { sellerCode: 'V1', sellerName: 'Ana', status: 'active' as const },
    { sellerCode: null, sellerName: null, status: 'lapsed' as const },
    { sellerCode: 'V2', sellerName: 'Bruno', status: 'via_matriz' as const },
  ];
  test('filters by seller, including the no-seller bucket', () => {
    expect(filterCobertura(rows, { sellerCode: 'V1' })).toHaveLength(2);
    expect(filterCobertura(rows, { sellerCode: NO_SELLER })).toHaveLength(1);
    expect(filterCobertura(rows, { status: 'lapsed' })).toHaveLength(1);
    expect(filterCobertura(rows, {})).toHaveLength(4);
  });
  test('summarizes by status', () => {
    expect(summarizeCobertura(rows)).toEqual({ never: 1, viaMatriz: 1, lapsed: 1, active: 1, total: 4 });
  });
  test('groups by seller sorted by name with "Sin vendedor" last', () => {
    const groups = groupBySeller(rows);
    expect(groups.map(g => g.sellerName)).toEqual(['Ana', 'Bruno', 'Sin vendedor']);
    expect(groups[0].rows).toHaveLength(2);
  });
});
