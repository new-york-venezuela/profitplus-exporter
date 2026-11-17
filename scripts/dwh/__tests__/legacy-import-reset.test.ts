import { describe, test, expect } from 'bun:test';
import { assertNotAlreadyImported, parseImportArgs, resetLegacyTables } from '../../dwh-legacy-2025-import';
import type sql from 'mssql';

function fakePool(counts: Record<string, number>) {
  const issued: string[] = [];
  const pool = {
    request: () => ({
      async query(text: string) {
        issued.push(text);
        const hit = Object.keys(counts).find(t => text.includes(`FROM ${t}`));
        return { recordset: [{ TotalRows: hit ? counts[hit] : 0 }] };
      },
    }),
  } as unknown as sql.ConnectionPool;
  return { pool, issued };
}

describe('parseImportArgs', () => {
  test('no flags', () => {
    expect(parseImportArgs([])).toEqual({ reset: false, confirmDb: null });
  });
  test('--reset with --confirm-db', () => {
    expect(parseImportArgs(['--reset', '--confirm-db', 'DWH_X'])).toEqual({ reset: true, confirmDb: 'DWH_X' });
  });
  test('--reset alone has no confirmation', () => {
    expect(parseImportArgs(['--reset'])).toEqual({ reset: true, confirmDb: null });
  });
});

describe('assertNotAlreadyImported', () => {
  test('passes when every legacy table is empty', async () => {
    await expect(assertNotAlreadyImported(fakePool({}).pool)).resolves.toBeUndefined();
  });

  test('refuses when only the dimensions are loaded (a failed earlier run) and names the reset flag', async () => {
    const { pool } = fakePool({ 'dim.Dim_Customer_Legacy': 120 });
    await expect(assertNotAlreadyImported(pool)).rejects.toThrow(/--reset --confirm-db/);
  });

  test('refuses when sales are loaded', async () => {
    await expect(assertNotAlreadyImported(fakePool({ 'fact.Fact_Sales_Legacy': 5 }).pool)).rejects.toThrow(/Fact_Sales_Legacy/);
  });
});

describe('resetLegacyTables', () => {
  test('empties facts, then rates, then dims (resetting their identities)', async () => {
    const { pool, issued } = fakePool({});
    await resetLegacyTables(pool);
    const joined = issued.join('\n');
    const order = ['Fact_Returns_Legacy', 'Fact_Sales_Legacy', 'Fact_ExchangeRate_Legacy', 'Dim_Customer_Legacy', 'Dim_Product_Legacy', 'Dim_SalesRep_Legacy']
      .map(t => joined.indexOf(t));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(joined).toContain('TRUNCATE TABLE fact.Fact_Sales_Legacy');
    expect(joined).toContain("DBCC CHECKIDENT ('dim.Dim_Customer_Legacy', RESEED, 0)");
    expect(joined).not.toMatch(/TRUNCATE TABLE dim\./);
    expect(joined).not.toMatch(/Fact_Sales\b(?!_Legacy)/);
  });
});
