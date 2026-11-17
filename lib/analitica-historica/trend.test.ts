import { describe, test, expect } from 'bun:test';
import { histTrendQuery } from './trend';
import { parseTrendBucket } from '@/app/api/dwh/lib/trend-bucket';

const bucket = parseTrendBucket(new URLSearchParams(), 'month:2025-03');
const range = { startKey: 20250301, endKey: 20250331 };

describe('histTrendQuery USD columns', () => {
  const sql = histTrendQuery(bucket, range, 'devolucion');

  test('a bucket whose returns have no rate keeps NULL USD returns (never 0)', () => {
    expect(sql).toContain('CASE WHEN r.Bucket IS NULL THEN 0 ELSE r.ReturnsUsd END AS ReturnsUsd');
    expect(sql).not.toContain('ISNULL(r.ReturnsUsd');
  });

  test('a bucket with only returns has 0 gross USD', () => {
    expect(sql).toContain('CASE WHEN s.Bucket IS NULL THEN 0 ELSE s.SalesGrossUsd END AS SalesGrossUsd');
  });

  test('bySeller adds the bound seller condition to both sides', () => {
    const bySeller = histTrendQuery(bucket, range, 'devolucion', true);
    expect(bySeller.match(/@salesRepKey/g)).toHaveLength(2);
    expect(sql).not.toContain('@salesRepKey');
  });
});
