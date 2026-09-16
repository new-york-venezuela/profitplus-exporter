// scripts/dwh/__tests__/fact-collections-due-date.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

// Runs against a dedicated throwaway database, never the real local/shared
// DWH_AlimentosNY -- afterAll drops this database unconditionally, which
// would otherwise wipe a real dev DWH someone else migrated/loaded (this
// happened once during development: a beforeAll failure still ran afterAll's
// DROP DATABASE against the shared DWH_AlimentosNY). dwhDatabaseName() reads
// DW_NAME, so setting it before importing/calling runDwhMigrations() routes
// every migrate-dwh.ts call in this file at the throwaway DB instead.
process.env.DW_NAME = `DWH_AlimentosNY_Test_${Date.now()}`;

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

describe('fact.Fact_Collections.DueDateKey', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    await pool.request().execute('dwh.Load_Dim_Product');
    await pool.request().execute('dwh.Load_Dim_SalesRep');
    await pool.request().execute('dwh.Load_Dim_Warehouse');
    await pool.request().execute('dwh.Load_Fact_Collections');
  }, 60_000); // full migration + dim loads against a fresh DB exceeds bun's 5s default

  afterAll(async () => {
    await pool?.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      IF EXISTS (SELECT 1 FROM sys.databases WHERE name = '${dwhDatabaseName()}')
      BEGIN
        ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${dwhDatabaseName()}];
      END
    `);
    await masterPool.close();
  });

  test('DueDateKey column exists with a FK to Dim_Date', async () => {
    const result = await pool.request().query(`
      SELECT c.name AS ColumnName, fk.name AS ForeignKeyName
      FROM sys.columns c
      LEFT JOIN sys.foreign_key_columns fkc ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
      LEFT JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
      WHERE c.object_id = OBJECT_ID('fact.Fact_Collections') AND c.name = 'DueDateKey'
    `);
    expect(result.recordset.length).toBe(1);
    expect(result.recordset[0].ForeignKeyName).toBe('FK_Fact_Collections_Dim_Date_DueDate');
  });

  test('at least one loaded row resolves a non-NULL DueDateKey when its invoice exists in saDocumentoVenta', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM fact.Fact_Collections WHERE DueDateKey IS NOT NULL
    `);
    // Reference test DB has real overlapping saCobro/saDocumentoVenta rows
    // (same reference dataset every other Fact_Collections test in this
    // suite already relies on) -- if this is ever 0 on a fresh seed, that's
    // a real regression in the join, not flaky test data.
    expect(Number(result.recordset[0].total)).toBeGreaterThan(0);
  });

  test('DueDateKey matches Fact_AR_Snapshot.DueDate for the same invoice (same source column, same value)', async () => {
    await pool.request().query(`EXEC dwh.Snapshot_Fact_AR`);
    const result = await pool.request().query(`
      SELECT TOP 5 fc.InvoiceNumber, fc.DueDateKey, dd.FullDate AS FactCollectionsDueDate, ar.DueDate AS SnapshotDueDate
      FROM fact.Fact_Collections fc
      JOIN dim.Dim_Date dd ON dd.DateKey = fc.DueDateKey
      JOIN fact.Fact_AR_Snapshot ar ON RTRIM(ar.InvoiceNumber) = RTRIM(fc.InvoiceNumber)
      WHERE fc.DueDateKey IS NOT NULL
    `);
    for (const row of result.recordset) {
      expect(new Date(row.FactCollectionsDueDate).toISOString().slice(0, 10)).toBe(
        new Date(row.SnapshotDueDate).toISOString().slice(0, 10)
      );
    }
  });

  test('re-running Load_Fact_Collections is idempotent and does not duplicate rows', async () => {
    const before = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Collections`);
    await pool.request().execute('dwh.Load_Fact_Collections');
    const after = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Collections`);
    expect(Number(after.recordset[0].total)).toBe(Number(before.recordset[0].total));
  });
});
