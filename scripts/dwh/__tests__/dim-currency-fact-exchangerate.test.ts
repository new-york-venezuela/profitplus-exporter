// scripts/dwh/__tests__/dim-currency-fact-exchangerate.test.ts
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

describe('Dim_Currency + Fact_ExchangeRate', () => {
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

  test('Load_Dim_Currency flags BSD as a base currency, not VES', async () => {
    await pool.request().execute('dwh.Load_Dim_Currency');

    const baseCurrencies = await pool.request().query(`
      SELECT CurrencyCode FROM dim.Dim_Currency WHERE IsBaseCurrency = 1
    `);
    const codes = baseCurrencies.recordset.map((r: { CurrencyCode: string }) => r.CurrencyCode.trim());
    expect(codes).toContain('BSD');
    expect(codes).not.toContain('VES');
  });

  test('Load_Dim_Currency row count matches saMoneda row count', async () => {
    await pool.request().execute('dwh.Load_Dim_Currency');

    const erpCount = await erpPool.request().query(`SELECT COUNT(*) AS total FROM saMoneda`);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Currency`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('Load_Fact_ExchangeRate loads USD rate history matching saTasa', async () => {
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Fact_ExchangeRate');

    const erpUsdCount = await erpPool.request().query(`SELECT COUNT(*) AS total FROM saTasa WHERE RTRIM(co_mone) = 'USD'`);
    const dwhUsdCount = await pool.request().query(`
      SELECT COUNT(*) AS total
      FROM fact.Fact_ExchangeRate f
      INNER JOIN dim.Dim_Currency c ON c.CurrencyKey = f.CurrencyKey
      WHERE RTRIM(c.CurrencyCode) = 'USD'
    `);
    expect(dwhUsdCount.recordset[0].total).toBe(erpUsdCount.recordset[0].total);
  });
});
