import { describe, test, expect } from 'bun:test';
import { getDimensionSpec, isDimension } from '../query-builder';

describe('getDimensionSpec', () => {
  test('cliente_entidad groups and labels by legal entity', () => {
    const spec = getDimensionSpec('cliente_entidad');
    expect(spec.joinClause).toContain('Dim_LegalEntity');
    expect(spec.groupByColumn).toContain('LegalEntityKey');
    expect(spec.labelExpr).toContain('LegalEntityName');
  });

  test('cliente_tienda groups and labels by individual customer/store', () => {
    const spec = getDimensionSpec('cliente_tienda');
    expect(spec.joinClause).toContain('Dim_Customer');
    expect(spec.groupByColumn).toContain('CustomerKey');
    expect(spec.labelExpr).toContain('CustomerName');
  });

  test('producto groups and labels by product', () => {
    const spec = getDimensionSpec('producto');
    expect(spec.joinClause).toContain('Dim_Product');
    expect(spec.groupByColumn).toContain('ProductKey');
  });

  test('vendedor groups and labels by sales rep', () => {
    const spec = getDimensionSpec('vendedor');
    expect(spec.joinClause).toContain('Dim_SalesRep');
    expect(spec.groupByColumn).toContain('SalesRepKey');
  });

  test('correlate produces distinct aliases on each side for cliente_entidad', () => {
    const spec = getDimensionSpec('cliente_entidad');
    const { innerJoin, condition } = spec.correlate('fr', 'fs2');
    expect(innerJoin).toContain('fs2_c');
    expect(condition).not.toBe('le.LegalEntityKey = le.LegalEntityKey');
    expect(condition).toContain('fs2_c.LegalEntityKey');
    expect(condition).toContain('fr.CustomerKey');
  });

  test('correlate produces a direct key match for cliente_tienda', () => {
    const spec = getDimensionSpec('cliente_tienda');
    const { condition } = spec.correlate('fr', 'fs2');
    expect(condition).toBe('fs2.CustomerKey = fr.CustomerKey');
  });
});

describe('isDimension', () => {
  test('accepts valid dimension values', () => {
    expect(isDimension('cliente_entidad')).toBe(true);
    expect(isDimension('cliente_tienda')).toBe(true);
    expect(isDimension('producto')).toBe(true);
    expect(isDimension('vendedor')).toBe(true);
  });

  test('rejects invalid or null values', () => {
    expect(isDimension('mes')).toBe(false);
    expect(isDimension(null)).toBe(false);
    expect(isDimension('')).toBe(false);
  });
});
