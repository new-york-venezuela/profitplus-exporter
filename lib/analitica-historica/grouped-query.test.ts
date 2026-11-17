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

describe('cliente grouping follows the casa matriz rule', () => {
  const entidad = buildGroupedQuery(groupSpec('cliente', bucket, 'devolucion', 'entidad'), 'AND 1=1', 'AND 1=1', { top: null });
  const tienda = buildGroupedQuery(groupSpec('cliente', bucket, 'devolucion', 'tienda'), 'AND 1=1', 'AND 1=1', { top: null });

  test('entidad (default) groups every store under its legal entity on both sides', () => {
    expect(groupSpec('cliente', bucket, 'devolucion').sales.key).toBe(groupSpec('cliente', bucket, 'devolucion', 'entidad').sales.key);
    expect(entidad).toContain('c.LegalEntityLegacyKey');
    expect(entidad).toContain('JOIN dim.Dim_LegalEntity_Legacy le');
    expect(entidad.match(/Dim_LegalEntity_Legacy le/g)).toHaveLength(2);
    expect(entidad).toContain('le.LegalEntityName');
  });

  test('a customer with no entity row stays its own group (never dropped)', () => {
    expect(entidad).toContain("'c' + CAST(c.CustomerLegacyKey AS varchar(20))");
  });

  test('tienda groups by the individual customer', () => {
    expect(tienda).not.toContain('Dim_LegalEntity_Legacy');
    expect(tienda).toContain('CAST(c.CustomerLegacyKey AS varchar(20))');
  });
});
