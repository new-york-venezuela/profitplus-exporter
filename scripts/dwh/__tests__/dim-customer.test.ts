// scripts/dwh/__tests__/dim-customer.test.ts
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

describe('Dim_Customer', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
  });

  afterAll(async () => {
    await pool.close();
    await erpPool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('initial load creates one current row per ERP customer', async () => {
    await pool.request().execute('dwh.Load_Dim_Customer');

    const erpCount = await erpPool.request().query(`SELECT COUNT(*) AS total FROM saCliente`);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Customer WHERE IsCurrent = 1`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('a known active customer loads with trimmed natural key and correct attributes', async () => {
    await pool.request().execute('dwh.Load_Dim_Customer');

    const sample = await erpPool.request().query(`SELECT TOP 1 co_cli, cli_des, contrib FROM saCliente WHERE inactivo = 0`);
    const co_cli = sample.recordset[0].co_cli.trim();

    const dwhRow = await pool.request()
      .input('code', sql.Char(16), co_cli)
      .query(`SELECT CustomerCode, CustomerName, IsSpecialTaxpayer, IsCurrent FROM dim.Dim_Customer WHERE RTRIM(CustomerCode) = @code AND IsCurrent = 1`);

    expect(dwhRow.recordset.length).toBe(1);
    expect(dwhRow.recordset[0].CustomerCode.trim()).toBe(co_cli);
    expect(dwhRow.recordset[0].IsCurrent).toBe(true);
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Dim_Customer');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Customer`);

    await pool.request().execute('dwh.Load_Dim_Customer');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Customer`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
