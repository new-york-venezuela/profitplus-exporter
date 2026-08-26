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

describe('Fact_Collections', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_SalesRep');
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

  test('loads a line for every saCobroDocReng row whose customer exists in dimensions', async () => {
    await pool.request().execute('dwh.Load_Fact_Collections');

    const erpCount = await erpPool.request().query(`
      SELECT COUNT(*) AS total
      FROM saCobroDocReng r
      INNER JOIN saCobro c ON c.cob_num = r.cob_num
      INNER JOIN saCliente cl ON RTRIM(cl.co_cli) = RTRIM(c.co_cli)
    `);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Collections`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('retention amounts for a known collection line match saCobroDocReng exactly', async () => {
    await pool.request().execute('dwh.Load_Fact_Collections');

    const sample = await erpPool.request().query(`
      SELECT TOP 1 r.cob_num, r.reng_num, r.mont_cob, r.monto_retencion_iva
      FROM saCobroDocReng r INNER JOIN saCobro c ON c.cob_num = r.cob_num
      WHERE c.anulado = 0 AND r.monto_retencion_iva > 0
    `);
    if (sample.recordset.length === 0) return; // no IVA-retention collections in this dataset — skip assertion

    const { cob_num, reng_num, mont_cob, monto_retencion_iva } = sample.recordset[0];
    const dwhRow = await pool.request()
      .input('receipt', sql.Char(20), cob_num)
      .input('line', sql.Int, reng_num)
      .query(`SELECT AmountCollected, RetentionIVAAmount FROM fact.Fact_Collections WHERE ReceiptNumber = @receipt AND LineNumber = @line`);

    expect(Number(dwhRow.recordset[0].AmountCollected)).toBeCloseTo(Number(mont_cob), 2);
    expect(Number(dwhRow.recordset[0].RetentionIVAAmount)).toBeCloseTo(Number(monto_retencion_iva), 2);
  });

  test('re-running the load is idempotent when nothing changed', async () => {
    await pool.request().execute('dwh.Load_Fact_Collections');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Collections`);

    await pool.request().execute('dwh.Load_Fact_Collections');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Collections`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });
});
