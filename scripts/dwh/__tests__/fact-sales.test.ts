// scripts/dwh/__tests__/fact-sales.test.ts
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

async function loadAllDimensions(pool: sql.ConnectionPool) {
  await pool.request().execute('dwh.Load_Dim_Currency');
  await pool.request().execute('dwh.Load_Dim_Customer');
  await pool.request().execute('dwh.Load_Dim_Product');
  await pool.request().execute('dwh.Load_Dim_SalesRep');
  await pool.request().execute('dwh.Load_Dim_Warehouse');
}

describe('Fact_Sales', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await loadAllDimensions(pool);
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

  test('loads a line for every saFacturaVentaReng row whose customer and product exist in dimensions', async () => {
    await pool.request().execute('dwh.Load_Fact_Sales');

    const erpCount = await erpPool.request().query(`
      SELECT COUNT(*) AS total
      FROM saFacturaVentaReng r
      INNER JOIN saFacturaVenta f ON f.doc_num = r.doc_num
      INNER JOIN saCliente c ON RTRIM(c.co_cli) = RTRIM(f.co_cli)
      INNER JOIN saArticulo a ON RTRIM(a.co_art) = RTRIM(r.co_art)
    `);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Sales`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('cost columns are NULL and CostSourceFlag is NO_COST_DATA for every row (margin deferred)', async () => {
    await pool.request().execute('dwh.Load_Fact_Sales');

    const badRows = await pool.request().query(`
      SELECT COUNT(*) AS total FROM fact.Fact_Sales
      WHERE UnitCost IS NOT NULL OR COGSAmount IS NOT NULL OR GrossProfitAmount IS NOT NULL OR CostSourceFlag <> 'NO_COST_DATA'
    `);
    expect(badRows.recordset[0].total).toBe(0);
  });

  test('NetAmount for a known invoice line matches saFacturaVentaReng.reng_neto exactly', async () => {
    await pool.request().execute('dwh.Load_Fact_Sales');

    const sample = await erpPool.request().query(`
      SELECT TOP 1 r.doc_num, r.reng_num, r.reng_neto
      FROM saFacturaVentaReng r INNER JOIN saFacturaVenta f ON f.doc_num = r.doc_num
      WHERE f.anulado = 0 ORDER BY f.fec_emis DESC
    `);
    const { doc_num, reng_num, reng_neto } = sample.recordset[0];

    const dwhRow = await pool.request()
      .input('inv', sql.Char(20), doc_num)
      .input('line', sql.Int, reng_num)
      .query(`SELECT NetAmount FROM fact.Fact_Sales WHERE InvoiceNumber = @inv AND LineNumber = @line`);

    expect(Number(dwhRow.recordset[0].NetAmount)).toBeCloseTo(Number(reng_neto), 2);
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Fact_Sales');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Sales`);

    await pool.request().execute('dwh.Load_Fact_Sales');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Sales`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
