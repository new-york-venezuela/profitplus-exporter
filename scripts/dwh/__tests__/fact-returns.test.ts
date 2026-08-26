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

describe('Fact_Returns', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_Product');
    await pool.request().execute('dwh.Load_Dim_SalesRep');
    await pool.request().execute('dwh.Load_Dim_Warehouse');
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

  test('loads a line for every saDevolucionClienteReng row whose customer and product exist in dimensions', async () => {
    await pool.request().execute('dwh.Load_Fact_Returns');

    const erpCount = await erpPool.request().query(`
      SELECT COUNT(*) AS total
      FROM saDevolucionClienteReng r
      INNER JOIN saDevolucionCliente d ON d.doc_num = r.doc_num
      INNER JOIN saCliente c ON RTRIM(c.co_cli) = RTRIM(d.co_cli)
      INNER JOIN saArticulo a ON RTRIM(a.co_art) = RTRIM(r.co_art)
    `);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Returns`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('Fact_Returns has no cost/margin columns (schema check)', async () => {
    const columns = await pool.request().query(`
      SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_Returns')
    `);
    const names = columns.recordset.map((c: { name: string }) => c.name);
    expect(names).not.toContain('UnitCost');
    expect(names).not.toContain('COGSAmount');
    expect(names).not.toContain('GrossProfitAmount');
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Fact_Returns');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Returns`);

    await pool.request().execute('dwh.Load_Fact_Returns');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Returns`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
