import { describe, test, expect } from 'bun:test';
import { getDimensionSpec, isDimension, isClienteDimension } from '../query-builder';

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

  // These correlate() conditions must reference this spec's own joined dimension
  // alias (e.g. `le`, `c`, `p`, `r`) on the outer side, never the fact-table
  // alias (`outerAlias`). The outer query this correlate() is used from is
  // GROUPed BY the dimension alias's key column, not the fact table's — SQL
  // Server rejects a reference to a non-grouped fact-table column inside a
  // nested subquery even when it's join-equal to a grouped dimension column
  // (confirmed against a live SQL Server instance; a version of this file
  // that correlated on `outerAlias.CustomerKey`/`outerAlias.ProductKey`/etc.
  // failed at query time with "invalid in the select list").
  test('correlate produces distinct aliases on each side for cliente_entidad', () => {
    const spec = getDimensionSpec('cliente_entidad');
    const { innerJoin, condition } = spec.correlate('fr', 'fs2');
    expect(innerJoin).toContain('fs2_c');
    expect(condition).not.toBe('le.LegalEntityKey = le.LegalEntityKey');
    expect(condition).toContain('fs2_c.LegalEntityKey');
    expect(condition).toContain('le.LegalEntityKey');
  });

  test('correlate produces a direct key match for cliente_tienda', () => {
    const spec = getDimensionSpec('cliente_tienda');
    const { condition } = spec.correlate('fr', 'fs2');
    expect(condition).toBe('fs2.CustomerKey = c.CustomerKey');
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

describe('isClienteDimension', () => {
  test('accepts cliente_entidad and cliente_tienda', () => {
    expect(isClienteDimension('cliente_entidad')).toBe(true);
    expect(isClienteDimension('cliente_tienda')).toBe(true);
  });

  test('rejects producto and vendedor, even though they are valid Dimension values', () => {
    expect(isClienteDimension('producto')).toBe(false);
    expect(isClienteDimension('vendedor')).toBe(false);
  });

  test('rejects invalid or null values', () => {
    expect(isClienteDimension('mes')).toBe(false);
    expect(isClienteDimension(null)).toBe(false);
    expect(isClienteDimension('')).toBe(false);
  });
});
