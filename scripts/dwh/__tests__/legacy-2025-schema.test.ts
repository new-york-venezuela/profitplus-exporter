// scripts/dwh/__tests__/legacy-2025-schema.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

// Runs against a dedicated throwaway database, never the real local/shared
// DWH_AlimentosNY -- afterAll drops this database unconditionally, which
// would otherwise wipe a real dev DWH someone else migrated/loaded.
// dwhDatabaseName() reads DW_NAME, so setting it before calling
// runDwhMigrations() routes every migrate-dwh.ts call in this file at the
// throwaway DB instead.
process.env.DW_NAME = `DWH_AlimentosNY_Test_legacy_2025_${Date.now()}`;

function testConfig(database: string): sql.config {
  return {
    server: process.env.DW_SERVER ?? process.env.DB_SERVER!,
    port: parseInt(process.env.DW_PORT ?? process.env.DB_PORT ?? '1433'),
    database,
    user: process.env.DW_USER ?? process.env.DB_USER!,
    password: process.env.DW_PASSWORD ?? process.env.DB_PASSWORD!,
    options: {
      encrypt: (process.env.DW_ENCRYPT ?? process.env.DB_ENCRYPT) === 'true',
      trustServerCertificate: (process.env.DW_TRUST_SERVER_CERT ?? process.env.DB_TRUST_SERVER_CERT) !== 'false',
    },
  };
}

describe('0034_legacy_2025_schema migration', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
  }, 60_000);

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('creates Dim_Customer_Legacy with the expected columns', async () => {
    const result = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dim' AND TABLE_NAME = 'Dim_Customer_Legacy'
    `);
    const columns = result.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME);
    expect(columns).toEqual(expect.arrayContaining([
      'CustomerLegacyKey', 'CustomerCode', 'CustomerName', 'ZoneCode', 'SegmentCode', 'LoadedAtUtc',
    ]));
  });

  test('creates Dim_Product_Legacy with the expected columns', async () => {
    const result = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dim' AND TABLE_NAME = 'Dim_Product_Legacy'
    `);
    const columns = result.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME);
    expect(columns).toEqual(expect.arrayContaining([
      'ProductLegacyKey', 'ProductCode', 'ProductName', 'LineCode', 'LineName',
      'SubLineCode', 'SubLineName', 'CategoryCode', 'CategoryName', 'LoadedAtUtc',
    ]));
  });

  test('creates Dim_SalesRep_Legacy with the expected columns', async () => {
    const result = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dim' AND TABLE_NAME = 'Dim_SalesRep_Legacy'
    `);
    const columns = result.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME);
    expect(columns).toEqual(expect.arrayContaining([
      'SalesRepLegacyKey', 'SalesRepCode', 'SalesRepName', 'ZoneCode', 'LoadedAtUtc',
    ]));
  });

  test('creates Fact_Sales_Legacy with FKs to the legacy dimensions, not current ones', async () => {
    const result = await pool.request().query(`
      SELECT
        fk.name AS ConstraintName,
        OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable
      FROM sys.foreign_keys fk
      WHERE fk.parent_object_id = OBJECT_ID('fact.Fact_Sales_Legacy')
    `);
    const referencedTables = result.recordset.map((r: { ReferencedTable: string }) => r.ReferencedTable);
    expect(referencedTables).toEqual(expect.arrayContaining([
      'Dim_Date', 'Dim_Customer_Legacy', 'Dim_Product_Legacy', 'Dim_SalesRep_Legacy',
    ]));
    expect(referencedTables).not.toContain('Dim_Customer');
    expect(referencedTables).not.toContain('Dim_Product');
    expect(referencedTables).not.toContain('Dim_SalesRep');
  });

  test('creates Fact_Returns_Legacy with FKs to the legacy dimensions, not current ones', async () => {
    const result = await pool.request().query(`
      SELECT
        fk.name AS ConstraintName,
        OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable
      FROM sys.foreign_keys fk
      WHERE fk.parent_object_id = OBJECT_ID('fact.Fact_Returns_Legacy')
    `);
    const referencedTables = result.recordset.map((r: { ReferencedTable: string }) => r.ReferencedTable);
    expect(referencedTables).toEqual(expect.arrayContaining([
      'Dim_Date', 'Dim_Customer_Legacy', 'Dim_Product_Legacy', 'Dim_SalesRep_Legacy',
    ]));
    expect(referencedTables).not.toContain('Dim_Customer');
    expect(referencedTables).not.toContain('Dim_Product');
    expect(referencedTables).not.toContain('Dim_SalesRep');
  });

  test('0037 adds the original-factura link columns to Fact_Returns_Legacy', async () => {
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'fact' AND TABLE_NAME = 'Fact_Returns_Legacy'
    `);
    const columns = result.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME);
    expect(columns).toEqual(expect.arrayContaining([
      'OriginalInvoiceNumber', 'OriginalInvoiceLineNumber', 'OriginalInvoiceDateKey', 'HasInvoiceLink',
    ]));
    const hasLink = result.recordset.find((r: { COLUMN_NAME: string }) => r.COLUMN_NAME === 'HasInvoiceLink');
    expect(hasLink.IS_NULLABLE).toBe('NO');
  });

  test('0043 creates Fact_ExchangeRate_Legacy keyed by DateKey', async () => {
    const result = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'fact' AND TABLE_NAME = 'Fact_ExchangeRate_Legacy'
    `);
    const columns = result.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME);
    expect(columns.sort()).toEqual(
      ['DateKey', 'IsCarriedForward', 'LoadedAtUtc', 'RateBuy', 'RateSell'].sort(),
    );
    const pk = await pool.request().query(`
      SELECT kcu.COLUMN_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.TABLE_SCHEMA = 'fact' AND tc.TABLE_NAME = 'Fact_ExchangeRate_Legacy' AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    `);
    expect(pk.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME)).toEqual(['DateKey']);
  });

  test('0044 adds the casa matriz roll-up to the legacy customers', async () => {
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dim' AND TABLE_NAME = 'Dim_Customer_Legacy'
    `);
    expect(cols.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME)).toEqual(
      expect.arrayContaining(['MatrizCode', 'LegalEntityLegacyKey']),
    );
    const ent = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dim' AND TABLE_NAME = 'Dim_LegalEntity_Legacy'
    `);
    expect(ent.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME).sort()).toEqual(
      ['LegalEntityLegacyKey', 'LegalEntityName', 'LoadedAtUtc', 'RootCustomerCode', 'StoreCount'].sort(),
    );
  });

  test('Load_Dim_LegalEntity_Legacy rolls stores up to their casa matriz, with a self-root for orphans and chains', async () => {
    await pool.request().query(`
      DELETE FROM dim.Dim_Customer_Legacy; DELETE FROM dim.Dim_LegalEntity_Legacy;
      INSERT INTO dim.Dim_Customer_Legacy (CustomerCode, CustomerName, MatrizCode) VALUES
        ('A', 'Casa A', NULL), ('B', 'Tienda B', 'A'), ('C', 'Tienda C', 'A'),
        ('D', 'Huérfano', 'ZZZ'), ('E', 'Cadena', 'B'), ('F', 'Propia', 'F');
      EXEC dwh.Load_Dim_LegalEntity_Legacy;
    `);
    const rows = await pool.request().query(`
      SELECT RTRIM(c.CustomerCode) AS Code, RTRIM(le.RootCustomerCode) AS Root, le.StoreCount, le.LegalEntityName
      FROM dim.Dim_Customer_Legacy c
      LEFT JOIN dim.Dim_LegalEntity_Legacy le ON le.LegalEntityLegacyKey = c.LegalEntityLegacyKey
      ORDER BY c.CustomerCode
    `);
    const byCode = Object.fromEntries(rows.recordset.map((r: { Code: string; Root: string | null; StoreCount: number | null; LegalEntityName: string | null }) => [r.Code, r]));
    expect(byCode.A.Root).toBe('A');
    expect(byCode.B.Root).toBe('A');
    expect(byCode.C.Root).toBe('A');
    expect(byCode.A.StoreCount).toBe(3);
    expect(byCode.A.LegalEntityName!.trim()).toBe('Casa A');
    expect(byCode.D.Root).toBe('D');
    expect(byCode.E.Root).toBe('E'); // parent B is itself a child: E stays its own root, never NULL
    expect(byCode.F.Root).toBe('F'); // self-referencing matriz
    for (const r of rows.recordset) expect(r.Root).not.toBeNull();
    // idempotent
    await pool.request().query('EXEC dwh.Load_Dim_LegalEntity_Legacy');
    const again = await pool.request().query('SELECT COUNT(*) AS n FROM dim.Dim_LegalEntity_Legacy');
    expect(again.recordset[0].n).toBe(4);
    await pool.request().query('DELETE FROM dim.Dim_Customer_Legacy; DELETE FROM dim.Dim_LegalEntity_Legacy;');
  });

  test('migration is re-runnable without error', async () => {
    await expect(runDwhMigrations()).resolves.toBeDefined();
  });
});
