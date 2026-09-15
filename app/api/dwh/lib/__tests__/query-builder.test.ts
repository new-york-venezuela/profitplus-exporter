import { describe, test, expect } from 'bun:test';
import { getDimensionSpec, isDimension, isDimensionForFact, isClienteDimension, buildDateWhereClause } from '../query-builder';

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

  test('proveedor dimension has correct join and grouping', () => {
    const spec = getDimensionSpec('proveedor');
    expect(spec.joinClause).toContain('Dim_Supplier');
    expect(spec.groupByColumn).toContain('SupplierKey');
    expect(isDimension('proveedor')).toBe(true);
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
    expect(isDimension('proveedor')).toBe(true);
  });

  test('rejects invalid or null values', () => {
    expect(isDimension('mes')).toBe(false);
    expect(isDimension(null)).toBe(false);
    expect(isDimension('')).toBe(false);
  });
});

describe('isDimensionForFact', () => {
  test('accepts producto/vendedor against sales and returns', () => {
    expect(isDimensionForFact('producto', 'sales')).toBe(true);
    expect(isDimensionForFact('producto', 'returns')).toBe(true);
    expect(isDimensionForFact('vendedor', 'sales')).toBe(true);
    expect(isDimensionForFact('vendedor', 'returns')).toBe(true);
  });

  test('accepts cliente_entidad/cliente_tienda against sales, returns, and ar_snapshot', () => {
    expect(isDimensionForFact('cliente_entidad', 'sales')).toBe(true);
    expect(isDimensionForFact('cliente_entidad', 'returns')).toBe(true);
    expect(isDimensionForFact('cliente_entidad', 'ar_snapshot')).toBe(true);
    expect(isDimensionForFact('cliente_tienda', 'ar_snapshot')).toBe(true);
  });

  test('accepts proveedor only against purchases', () => {
    expect(isDimensionForFact('proveedor', 'purchases')).toBe(true);
  });

  test('rejects proveedor against sales, returns, and ar_snapshot (no SupplierKey on those facts)', () => {
    expect(isDimensionForFact('proveedor', 'sales')).toBe(false);
    expect(isDimensionForFact('proveedor', 'returns')).toBe(false);
    expect(isDimensionForFact('proveedor', 'ar_snapshot')).toBe(false);
  });

  test('rejects producto/vendedor/cliente dimensions against purchases (no matching key on Fact_Purchases)', () => {
    expect(isDimensionForFact('producto', 'purchases')).toBe(false);
    expect(isDimensionForFact('vendedor', 'purchases')).toBe(false);
    expect(isDimensionForFact('cliente_entidad', 'purchases')).toBe(false);
    expect(isDimensionForFact('cliente_tienda', 'purchases')).toBe(false);
  });

  test('rejects invalid or null values regardless of fact', () => {
    expect(isDimensionForFact('mes', 'sales')).toBe(false);
    expect(isDimensionForFact(null, 'sales')).toBe(false);
    expect(isDimensionForFact('', 'purchases')).toBe(false);
  });
});

describe('isClienteDimension', () => {
  test('accepts cliente_entidad and cliente_tienda', () => {
    expect(isClienteDimension('cliente_entidad')).toBe(true);
    expect(isClienteDimension('cliente_tienda')).toBe(true);
  });

  test('rejects producto, vendedor, and proveedor, even though they are valid Dimension values', () => {
    expect(isClienteDimension('producto')).toBe(false);
    expect(isClienteDimension('vendedor')).toBe(false);
    expect(isClienteDimension('proveedor')).toBe(false);
  });

  test('rejects invalid or null values', () => {
    expect(isClienteDimension('mes')).toBe(false);
    expect(isClienteDimension(null)).toBe(false);
    expect(isClienteDimension('')).toBe(false);
  });
});

describe('buildDateWhereClause', () => {
  test('month:YYYY-MM resolves to the first and last day of that month', () => {
    const clause = buildDateWhereClause('month:2026-02', 'fe');
    expect(clause).toBe('AND fe.DateKey >= 20260201 AND fe.DateKey <= 20260228');
  });

  test('month:YYYY-MM handles a 31-day month correctly', () => {
    const clause = buildDateWhereClause('month:2026-01', 'fe');
    expect(clause).toBe('AND fe.DateKey >= 20260101 AND fe.DateKey <= 20260131');
  });

  test('month:YYYY-MM handles a leap-year February correctly', () => {
    const clause = buildDateWhereClause('month:2024-02', 'fe');
    expect(clause).toBe('AND fe.DateKey >= 20240201 AND fe.DateKey <= 20240229');
  });

  test('ytd:YYYY for a past year spans the full calendar year', () => {
    const pastYear = new Date().getFullYear() - 1;
    const clause = buildDateWhereClause(`ytd:${pastYear}`, 'fe');
    expect(clause).toBe(`AND fe.DateKey >= ${pastYear}0101 AND fe.DateKey <= ${pastYear}1231`);
  });

  test('ytd:YYYY for the current year spans Jan 1 through today', () => {
    const currentYear = new Date().getFullYear();
    const todayKey = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    const clause = buildDateWhereClause(`ytd:${currentYear}`, 'fe');
    expect(clause).toBe(`AND fe.DateKey >= ${currentYear}0101 AND fe.DateKey <= ${todayKey}`);
  });

  test('30d and 90d are no longer recognized as rolling windows — they fall through to the 12m default', () => {
    // 30d/90d are removed from the UI (analitica-client.tsx) but the function
    // must not throw or silently mishandle a stale/bookmarked URL still
    // carrying one of these values — falling through to the 365-day (12m)
    // default is the safe, unsurprising behavior for a value this function
    // no longer specifically recognizes.
    const clause30 = buildDateWhereClause('30d', 'fe');
    const clause90 = buildDateWhereClause('90d', 'fe');
    const clause12m = buildDateWhereClause('12m', 'fe');
    expect(clause30).toBe(clause12m);
    expect(clause90).toBe(clause12m);
  });

  test('12m and custom:start:end are unchanged', () => {
    expect(buildDateWhereClause('custom:2026-01-01:2026-01-31', 'fe')).toBe(
      'AND fe.DateKey >= 20260101 AND fe.DateKey <= 20260131'
    );
    // 12m resolves relative to "now", so just check the shape/prefix rather
    // than a fixed value.
    expect(buildDateWhereClause('12m', 'fe')).toMatch(/^AND fe\.DateKey >= \d{8}$/);
  });
});
