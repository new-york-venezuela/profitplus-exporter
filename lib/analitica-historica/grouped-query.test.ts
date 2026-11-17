import { describe, test, expect } from 'bun:test';
import { buildGroupedQuery, groupSpec } from './grouped-query';
import { parseTrendBucket } from '@/app/api/dwh/lib/trend-bucket';

const bucket = parseTrendBucket(new URLSearchParams(), 'month:2025-03');
const sql = buildGroupedQuery(groupSpec('cliente', bucket, 'devolucion'), 'AND 1=1', 'AND 1=1', { top: null });

describe('buildGroupedQuery USD columns', () => {
  test('returns that exist but have no exchange rate keep a NULL USD (never 0)', () => {
    expect(sql).toContain('CASE WHEN r.GroupKey IS NULL THEN 0 ELSE r.ReturnsUsd END AS ReturnsUsd');
    expect(sql).not.toContain('ISNULL(r.ReturnsUsd');
  });

  test('a group with only returns has 0 gross USD (so its net USD is -returns, not "Sin datos")', () => {
    expect(sql).toContain('CASE WHEN s.GroupKey IS NULL THEN 0 ELSE s.SalesGrossUsd END AS SalesGrossUsd');
  });
});
