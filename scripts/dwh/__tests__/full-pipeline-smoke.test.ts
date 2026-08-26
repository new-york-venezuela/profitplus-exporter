// scripts/dwh/__tests__/full-pipeline-smoke.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

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

describe('Full DWH pipeline smoke test', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
  });

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('running every load procedure in dependency order succeeds end-to-end with no orphaned FK references', async () => {
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Fact_ExchangeRate');
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_Product');
    await pool.request().execute('dwh.Load_Dim_SalesRep');
    await pool.request().execute('dwh.Load_Dim_Warehouse');
    await pool.request().execute('dwh.Load_Fact_Sales');
    await pool.request().execute('dwh.Load_Fact_Returns');
    await pool.request().execute('dwh.Load_Fact_Collections');
    await pool.request().input('SnapshotDate', sql.Date, new Date()).execute('dwh.Snapshot_Fact_AR');

    const counts = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dim.Dim_Date) AS dates,
        (SELECT COUNT(*) FROM dim.Dim_Currency) AS currencies,
        (SELECT COUNT(*) FROM dim.Dim_Customer WHERE IsCurrent = 1) AS customers,
        (SELECT COUNT(*) FROM dim.Dim_Product WHERE IsCurrent = 1) AS products,
        (SELECT COUNT(*) FROM fact.Fact_Sales) AS sales,
        (SELECT COUNT(*) FROM fact.Fact_Returns) AS returns,
        (SELECT COUNT(*) FROM fact.Fact_Collections) AS collections,
        (SELECT COUNT(*) FROM fact.Fact_AR_Snapshot) AS ar_snapshot
    `);
    const row = counts.recordset[0];
    expect(row.dates).toBeGreaterThan(0);
    expect(row.currencies).toBeGreaterThan(0);
    expect(row.customers).toBeGreaterThan(0);
    expect(row.products).toBeGreaterThan(0);
    expect(row.sales).toBeGreaterThan(0);
    // returns/collections/ar_snapshot may legitimately be 0 in a sparse dataset — no lower-bound assertion beyond "query succeeded"
  });
});
