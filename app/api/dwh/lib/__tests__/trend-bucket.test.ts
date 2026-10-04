import { describe, test, expect } from 'bun:test';
import { parseTrendBucket, bucketFilterClause } from '../trend-bucket';

const TODAY = new Date(Date.UTC(2026, 9, 1));

describe('parseTrendBucket', () => {
  test('defaults to daily for 30d when no granularity is requested', () => {
    const t = parseTrendBucket(new URLSearchParams(), '30d', TODAY);
    expect(t.granularity).toBe('day');
    expect(t.mode).toBe('day');
    expect(t.keyExpr()).toBe('CONVERT(char(10), d.FullDate, 23)');
  });

  test('month inside a one-month range is the single aggregate bucket', () => {
    const t = parseTrendBucket(new URLSearchParams('granularity=month'), '30d', TODAY);
    expect(t.granularity).toBe('month');
    expect(t.mode).toBe('range');
    expect(t.keyExpr()).toContain("'range'");
  });

  test('a disallowed request (day over 12m) falls back to the default', () => {
    const t = parseTrendBucket(new URLSearchParams('granularity=day'), '12m', TODAY);
    expect(t.granularity).toBe('month');
    expect(t.mode).toBe('month');
  });

  test('keyExpr honors a date alias', () => {
    const t = parseTrendBucket(new URLSearchParams('granularity=week'), '30d', TODAY);
    expect(t.keyExpr('dr')).toContain('dr.Year');
    expect(t.keyExpr('dr')).not.toContain('d.Year');
  });
});

describe('bucketFilterClause', () => {
  test('a day bucket filters one DateKey', () => {
    expect(bucketFilterClause('day', '2026-01-09', 'fs')).toBe('AND fs.DateKey >= 20260109 AND fs.DateKey <= 20260109');
  });

  test('a week bucket filters its clipped Monday-Sunday span', () => {
    expect(bucketFilterClause('week', '2026-W02', 'fs')).toBe('AND fs.DateKey >= 20260105 AND fs.DateKey <= 20260111');
  });

  test('a month bucket filters the calendar month', () => {
    expect(bucketFilterClause('month', '2026-02', 'fs')).toBe('AND fs.DateKey >= 20260201 AND fs.DateKey <= 20260228');
  });

  test('the aggregate range bucket adds no extra filter', () => {
    expect(bucketFilterClause('range', 'range', 'fs')).toBe('');
  });

  test('a malformed key returns null so the route can answer 400', () => {
    expect(bucketFilterClause('week', "2026-W02'; DROP TABLE x;--", 'fs')).toBeNull();
    expect(bucketFilterClause('day', 'nope', 'fs')).toBeNull();
  });
});

describe('bucketFilterClause on another date column', () => {
  test('filters Fact_Returns by OriginalInvoiceDateKey when asked', () => {
    expect(bucketFilterClause('month', '2026-06', 'fr2', 'OriginalInvoiceDateKey'))
      .toBe('AND fr2.OriginalInvoiceDateKey >= 20260601 AND fr2.OriginalInvoiceDateKey <= 20260630');
  });
});
