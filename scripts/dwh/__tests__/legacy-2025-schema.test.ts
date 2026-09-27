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

  test('migration is re-runnable without error', async () => {
    await expect(runDwhMigrations()).resolves.toBeDefined();
  });
});
