import { describe, expect, test } from 'bun:test';
import type sql from 'mssql';
import { fetchHistory, fetchLineReturns, fetchWeekAmounts } from '../queries';

function fakePool(rows: Record<string, unknown>[][] = []) {
  const queries: { text: string; inputs: Record<string, unknown> }[] = [];
  let n = 0;
  const pool = {
    request() {
      const inputs: Record<string, unknown> = {};
      const req = {
        input(name: string, _t: unknown, v: unknown) { inputs[name] = v; return req; },
        async query(text: string) { queries.push({ text, inputs }); return { recordset: rows[n++] ?? [] }; },
      };
      return req;
    },
  } as unknown as sql.ConnectionPool;
  return { pool, queries };
}

describe('fetchLineReturns', () => {
  test('windows by original invoice date, converts at the factura rate, joins the current customer', async () => {
    const { pool, queries } = fakePool([[{ CustomerCode: 'C1', LineName: ' Fresco ', Units: 2, ReturnsBs: 10, ReturnsUsd: 1 }]]);
    const out = await fetchLineReturns(pool, '2026-10');
    expect(queries[0].text).toContain('fr.OriginalInvoiceDateKey >= 20261001');
    expect(queries[0].text).toContain('fr.OriginalInvoiceDateKey <= 20261031');
    expect(queries[0].text).toContain('cur.IsCurrent = 1');
    expect(queries[0].text).toContain('fr.IsVoided = 0');
    expect(out).toEqual([{ customerCode: 'C1', line: 'Fresco', units: 2, returns: { bs: 10, usd: 1 } }]);
  });
  test('invalid month throws', async () => {
    await expect(fetchLineReturns(fakePool().pool, '2026-13')).rejects.toThrow();
  });
});

describe('fetchWeekAmounts', () => {
  test('both queries are clipped to the month and grouped by YearWeek; merged per customer-week', async () => {
    const { pool, queries } = fakePool([
      [{ CustomerCode: 'C1', YearWeek: '2026-W40', Units: 5, SalesBs: 100, SalesUsd: 2 }],
      [{ CustomerCode: 'C1', YearWeek: '2026-W40', Units: 1, ReturnsBs: 10, ReturnsUsd: 0.2 }, { CustomerCode: 'C2', YearWeek: '2026-W41', Units: 1, ReturnsBs: 5, ReturnsUsd: null }],
    ]);
    const out = await fetchWeekAmounts(pool, '2026-10');
    expect(queries).toHaveLength(2);
    expect(queries[0].text).toContain('fs.DateKey >= 20261001');
    expect(queries[1].text).toContain('fr.OriginalInvoiceDateKey <= 20261031');
    expect(queries.every(q => q.text.includes('GROUP BY RTRIM(cur.CustomerCode), d.YearWeek') && q.text.includes('cur.IsCurrent = 1'))).toBe(true);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ customerCode: 'C1', units: 5, returnUnits: 1, sales: { bs: 100, usd: 2 }, returns: { bs: 10, usd: 0.2 } });
    expect(out[1]).toMatchObject({ customerCode: 'C2', yearWeek: '2026-W41', returns: { bs: 5, usd: null } });
  });
  test('invalid month throws', async () => {
    await expect(fetchWeekAmounts(fakePool().pool, 'x')).rejects.toThrow();
  });
});

describe('fetchHistory', () => {
  test('binds root value and exclude codes, never interpolates them, spans 12 months, omits empty ones', async () => {
    const { pool, queries } = fakePool([
      [{ Month: '2026-09', Units: 3, SalesBs: 30, SalesUsd: 3 }],
      [{ Month: '2026-08', Units: 1, ReturnsBs: 5, ReturnsUsd: 1 }],
    ]);
    const out = await fetchHistory(pool, { kind: 'vendedor', value: 'ZZ77' }, '2026-10', ['CODEX1', 'CODEX2']);
    for (const q of queries) {
      expect(q.inputs).toMatchObject({ rootValue: 'ZZ77', code0: 'CODEX1', code1: 'CODEX2' });
      expect(q.text).not.toContain('ZZ77');
      expect(q.text).not.toContain('CODEX');
      expect(q.text).toContain('NOT IN (@code0, @code1)');
      expect(q.text).toContain('cur.IsCurrent = 1');
    }
    expect(queries[0].text).toContain('fs.DateKey >= 20251101');
    expect(queries[1].text).toContain('fr.OriginalInvoiceDateKey >= 20251101');
    expect(queries[1].text).toContain('OriginalInvoiceDateKey');
    expect(out.map(p => p.month)).toEqual(['2026-08', '2026-09']);
    expect(out[0]).toMatchObject({ units: 0, returnUnits: 1, returns: { bs: 5, usd: 1 } });
  });
  test('sales are grouped by month AND product line (bound inputs, current customer); the month total is the sum of its lines', async () => {
    const { pool, queries } = fakePool([
      [
        { Month: '2026-09', LineName: 'Pizza ', Units: 3, SalesBs: 300, SalesUsd: 6 },
        { Month: '2026-09', LineName: 'Pan', Units: 2, SalesBs: 100, SalesUsd: null },
        { Month: '2026-09', LineName: null, Units: 1, SalesBs: 50, SalesUsd: 1 },
        { Month: '2026-09', LineName: '  ', Units: 1, SalesBs: 25, SalesUsd: 0.5 },
        { Month: '2026-10', LineName: 'Pan', Units: 4, SalesBs: 200, SalesUsd: null },
      ],
      [{ Month: '2026-09', Units: 1, ReturnsBs: 10, ReturnsUsd: 0.2 }],
    ]);
    const out = await fetchHistory(pool, { kind: 'grupo', value: 'G01' }, '2026-10', ['CODEX1']);
    const salesSql = queries[0].text;
    expect(salesSql).toContain('JOIN dim.Dim_Product p ON p.ProductKey = fs.ProductKey');
    expect(salesSql).toContain('GROUP BY d.YearMonth, p.LineName');
    expect(salesSql).toContain('cur.IsCurrent = 1');
    expect(salesSql).toContain('NOT IN (@code0)');
    expect(salesSql).not.toContain('G01');
    expect(queries[0].inputs).toMatchObject({ rootValue: 'G01', code0: 'CODEX1' });
    // Returns stay month-level.
    expect(queries[1].text).toContain('GROUP BY d.YearMonth');
    expect(queries[1].text).not.toContain('LineName');

    const sep = out.find(p => p.month === '2026-09')!;
    expect(sep.byLine).toEqual([
      { line: 'Pizza', units: 3, sales: { bs: 300, usd: 6 } },
      { line: 'Pan', units: 2, sales: { bs: 100, usd: null } },
      { line: null, units: 2, sales: { bs: 75, usd: 1.5 } },
    ]);
    expect(sep.sales).toEqual({ bs: 475, usd: 7.5 });
    expect(sep.units).toBe(7);
    expect(sep.returns).toEqual({ bs: 10, usd: 0.2 });
    const oct = out.find(p => p.month === '2026-10')!;
    expect(oct.sales).toEqual({ bs: 200, usd: null });
  });
  test('a month with returns only has an empty byLine and zero sales', async () => {
    const { pool } = fakePool([[], [{ Month: '2026-08', Units: 1, ReturnsBs: 5, ReturnsUsd: 1 }]]);
    const out = await fetchHistory(pool, { kind: 'total' }, '2026-10', []);
    expect(out[0]).toMatchObject({ month: '2026-08', byLine: [], units: 0 });
  });
  test('total scope binds no root value and no exclusion clause when none flagged', async () => {
    const { pool, queries } = fakePool();
    await fetchHistory(pool, { kind: 'total' }, '2026-01', []);
    expect(queries[0].inputs).toEqual({});
    expect(queries[0].text).not.toContain('NOT IN');
    expect(queries[0].text).toContain('fs.DateKey >= 20250201');
  });
  test('sin-* roots filter on NULL instead of binding', async () => {
    const { pool, queries } = fakePool();
    await fetchHistory(pool, { kind: 'vendedor', value: 'sin-vendedor' }, '2026-10', []);
    expect(queries[0].text).toContain('r.SalesRepKey IS NULL');
    expect(queries[0].inputs).toEqual({});
  });
  test('sin-grupo matches a NULL or blank segment code, as rootOf does', async () => {
    const { pool, queries } = fakePool();
    await fetchHistory(pool, { kind: 'grupo', value: 'sin-grupo' }, '2026-10', []);
    expect(queries[0].text).toContain("NULLIF(RTRIM(cur.ErpSegmentCode), '') IS NULL");
    expect(queries[0].inputs).toEqual({});
  });
  test('invalid month throws', async () => {
    await expect(fetchHistory(fakePool().pool, { kind: 'total' }, '2026-1', [])).rejects.toThrow();
  });
});

describe('fetchHistory USD conversion invariant', () => {
  test('USD is summed per row at the rate of the row\'s own invoice date, never one rate per month', async () => {
    const { pool, queries } = fakePool([[], []]);
    await fetchHistory(pool, { kind: 'total' }, '2026-10', []);
    const [salesSql, returnsSql] = queries.map(q => q.text.replace(/\s+/g, ' '));
    expect(salesSql).toContain('LEFT JOIN fact.Fact_ExchangeRate fx ON fx.DateKey = fs.DateKey');
    expect(returnsSql).toContain('LEFT JOIN fact.Fact_ExchangeRate fx ON fx.DateKey = fr.OriginalInvoiceDateKey');
    expect(salesSql).toContain('SUM(fs.NetAmount / NULLIF(fx.RateSell, 0))');
    expect(returnsSql).toContain('SUM(fr.NetAmount / NULLIF(fx.RateSell, 0))');
    // the rate is joined on the fact row's date, not on the month key
    expect(salesSql).not.toMatch(/fx\.DateKey = d\./);
    expect(returnsSql).not.toMatch(/fx\.DateKey = d\./);
  });
});
