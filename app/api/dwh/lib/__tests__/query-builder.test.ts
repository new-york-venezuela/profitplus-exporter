import { describe, test, expect } from 'bun:test';
import {
  getDimensionSpec, isDimension, isDimensionForFact, isClienteDimension, buildDateWhereClause, jsonWithCache, usdConversionJoin, dualAmountExpr,
  bucketKeyExpr, buildPrevThirtyDayWhereClause, parseReturnsBasis, returnsDateColumn, buildReturnsDateWhereClause, returnsUsdConversionJoin,
  returnsAmountSubqueries,
} from '../query-builder';

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

  test('90d is not a recognized window — it falls through to the 12m default', () => {
    // 90d is not offered in the UI but the function must not throw or
    // silently mishandle a stale/bookmarked URL still carrying it — falling
    // through to the 365-day (12m) default is the safe behavior. (30d is a
    // real window again — see 'buildDateWhereClause 30d' below.)
    expect(buildDateWhereClause('90d', 'fe')).toBe(buildDateWhereClause('12m', 'fe'));
  });

  test('12m and custom:start:end are unchanged', () => {
    expect(buildDateWhereClause('custom:2026-01-01:2026-01-31', 'fe')).toBe(
      'AND fe.DateKey >= 20260101 AND fe.DateKey <= 20260131'
    );
    // 12m resolves relative to "now", so just check the shape/prefix rather
    // than a fixed value.
    expect(buildDateWhereClause('12m', 'fe')).toBe(
      "AND fe.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -365, GETDATE()), 'yyyyMMdd'))"
    );
  });
});

describe('jsonWithCache', () => {
  test('sets Cache-Control: private, max-age=900 on the response', () => {
    const res = jsonWithCache({ ok: true });
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=900');
  });

  test('still serializes the given body as JSON', async () => {
    const res = jsonWithCache({ foo: 'bar', n: 42 });
    const body = await res.json();
    expect(body).toEqual({ foo: 'bar', n: 42 });
  });

  test('preserves a caller-supplied status via init', () => {
    const res = jsonWithCache({ ok: true }, { status: 201 });
    expect(res.status).toBe(201);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=900');
  });
});

describe('usdConversionJoin', () => {
  test('joins Fact_ExchangeRate on the fact alias\'s DateKey by default', () => {
    const sql = usdConversionJoin('fs');
    expect(sql).toContain('LEFT JOIN fact.Fact_ExchangeRate fx');
    expect(sql).toContain('fx.DateKey = fs.DateKey');
    expect(sql).toContain("CurrencyCode) = 'USD'");
  });

  test('accepts a custom date column for tables like Fact_AR_Snapshot', () => {
    const sql = usdConversionJoin('a', 'SnapshotDateKey');
    expect(sql).toContain('fx.DateKey = a.SnapshotDateKey');
  });

  test('accepts an explicit joinAlias for queries needing more than one exchange-rate join in scope', () => {
    const sql = usdConversionJoin('fr', undefined, 'frfx');
    expect(sql).toContain('LEFT JOIN fact.Fact_ExchangeRate frfx');
    expect(sql).toContain('frfx.DateKey = fr.DateKey');
    expect(sql).toContain('frfx.CurrencyKey =');
    expect(sql).not.toContain(' fx.'); // no leftover bare "fx." reference anywhere
    expect(sql).not.toContain('Fact_ExchangeRate fx'); // and the join itself isn't aliased "fx" either
  });
});

describe('dualAmountExpr', () => {
  test('produces a BS sum and a per-row-converted USD sum, aliased as requested', () => {
    const sql = dualAmountExpr('fs', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd');
    expect(sql).toContain('SUM(fs.NetAmount) AS SalesGrossBs');
    expect(sql).toContain('AS SalesGrossUsd');
    expect(sql).toContain('fs.NetAmount /');
    // The divisor is always fact.Fact_ExchangeRate.RateSell for the row's own
    // date — never the fact table's own DocumentExchangeRate column. Root-caused
    // live (2026-09-28): DocumentExchangeRate (sourced from the ERP document's
    // own `tasa`) is unreliable as a BS→USD divisor — it's set to a literal `1`
    // "no conversion" placeholder for BS-denominated documents (the overwhelming
    // majority), not a real exchange rate, so dividing by it silently reported
    // raw BS amounts as USD.
    expect(sql).toContain('NULLIF(fx.RateSell, 0)');
    expect(sql).not.toContain('DocumentExchangeRate');
  });

  test('division happens inside the SUM, not after it', () => {
    const sql = dualAmountExpr('fp', 'NetAmount', 'Bs', 'Usd');
    // The USD aggregate must be SUM(expr / rate), not SUM(expr) / rate —
    // assert the division is INSIDE the SUM(...) parens by checking the
    // rate divisor appears before the aggregate's closing paren that
    // matches the opening SUM(.
    const usdSumStart = sql.indexOf('SUM(fp.NetAmount /');
    expect(usdSumStart).toBeGreaterThan(-1);
  });

  test('dualAmountExpr accepts a matching joinAlias for its rate reference', () => {
    const sql = dualAmountExpr('fr', 'NetAmount', 'Bs', 'Usd', 'frfx');
    expect(sql).toContain('NULLIF(frfx.RateSell, 0)');
    expect(sql).not.toContain('DocumentExchangeRate');
  });
});

describe('buildDateWhereClause 30d', () => {
  test('filters to the last 30 days including today', () => {
    const sql = buildDateWhereClause('30d', 'fs');
    expect(sql).toContain('fs.DateKey >=');
    expect(sql).toContain('DATEADD(DAY, -29, GETDATE())');
  });
});

describe('bucketKeyExpr', () => {
  test('month groups by YearMonth', () => {
    expect(bucketKeyExpr('month')).toBe('d.YearMonth');
  });

  test('day groups by ISO date', () => {
    expect(bucketKeyExpr('day')).toBe('CONVERT(char(10), d.FullDate, 23)');
  });

  test('week keys are YYYY-Www, Monday-first and DATEFIRST-independent', () => {
    const sql = bucketKeyExpr('week');
    expect(sql).toContain("'-W'");
    expect(sql).toContain("'19000101'"); // 1900-01-01 was a Monday
    expect(sql).not.toContain('DATEPART(WEEKDAY');
    expect(sql).not.toContain('DATEPART(WEEK,');
  });

  test('range is a constant that still references a column (SQL Server rejects pure constants in GROUP BY/ORDER BY)', () => {
    expect(bucketKeyExpr('range')).toBe("CASE WHEN d.DateKey IS NOT NULL THEN 'range' END");
    expect(bucketKeyExpr('range', 'dr')).toContain('dr.DateKey');
  });

  test('honors a custom date alias', () => {
    expect(bucketKeyExpr('month', 'dr')).toBe('dr.YearMonth');
  });
});

describe('buildPrevThirtyDayWhereClause', () => {
  test('is the 30 days immediately before the 30d window, with no overlap', () => {
    const sql = buildPrevThirtyDayWhereClause('prev_fs');
    expect(sql).toContain("prev_fs.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -59, GETDATE()), 'yyyyMMdd'))");
    expect(sql).toContain("prev_fs.DateKey < CONVERT(INT, FORMAT(DATEADD(DAY, -29, GETDATE()), 'yyyyMMdd'))");
  });
});

describe('returns basis helpers', () => {
  test('parseReturnsBasis defaults to factura', () => {
    expect(parseReturnsBasis(null)).toBe('factura');
    expect(parseReturnsBasis('garbage')).toBe('factura');
    expect(parseReturnsBasis('devolucion')).toBe('devolucion');
  });

  test('returnsDateColumn maps the basis to the Fact_Returns column', () => {
    expect(returnsDateColumn('factura')).toBe('OriginalInvoiceDateKey');
    expect(returnsDateColumn('devolucion')).toBe('DateKey');
  });

  test('buildReturnsDateWhereClause windows on the chosen column', () => {
    expect(buildReturnsDateWhereClause('month:2026-06', 'fr', 'factura'))
      .toBe('AND fr.OriginalInvoiceDateKey >= 20260601 AND fr.OriginalInvoiceDateKey <= 20260630');
    expect(buildReturnsDateWhereClause('month:2026-06', 'fr', 'devolucion'))
      .toBe('AND fr.DateKey >= 20260601 AND fr.DateKey <= 20260630');
  });

  test('buildDateWhereClause keeps DateKey as the default column', () => {
    expect(buildDateWhereClause('month:2026-06', 'fs')).toBe('AND fs.DateKey >= 20260601 AND fs.DateKey <= 20260630');
    expect(buildDateWhereClause('30d', 'fr', 'OriginalInvoiceDateKey')).toContain('fr.OriginalInvoiceDateKey >=');
  });

  test('buildPrevThirtyDayWhereClause accepts a column', () => {
    expect(buildPrevThirtyDayWhereClause('fr', 'OriginalInvoiceDateKey')).toContain('fr.OriginalInvoiceDateKey <');
  });

  test('returnsUsdConversionJoin converts at the original factura date', () => {
    expect(returnsUsdConversionJoin('fr2', 'r2fx')).toContain('r2fx.DateKey = fr2.OriginalInvoiceDateKey');
  });

  test('returnsAmountSubqueries emits a BS and a USD scalar subquery with the given scope', () => {
    const sql = returnsAmountSubqueries({ alias: 'fr', fxAlias: 'frfx', where: 'AND fr.SalesRepKey = 7', bsAlias: 'RB', usdAlias: 'RU' });
    expect(sql).toContain(') AS RB');
    expect(sql).toContain(') AS RU');
    expect(sql.match(/AND fr\.SalesRepKey = 7/g)?.length).toBe(2);
    expect(sql).toContain('frfx.DateKey = fr.OriginalInvoiceDateKey');
    expect(sql).toContain('COUNT(fr.NetAmount) = 0 THEN 0');
  });
});
