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

describe('Fact_AR_Snapshot', () => {
  let pool: sql.ConnectionPool;
  let erpPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    erpPool = await new sql.ConnectionPool(testConfig(process.env.DB_NAME!)).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Dim_Customer');
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

  test('snapshots every open, non-voided document whose customer exists in dimensions', async () => {
    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-25')).execute('dwh.Snapshot_Fact_AR');

    const erpCount = await erpPool.request().query(`
      SELECT COUNT(*) AS total
      FROM saDocumentoVenta d
      INNER JOIN saCliente c ON RTRIM(c.co_cli) = RTRIM(d.co_cli)
      WHERE ISNULL(d.anulado, 0) = 0 AND d.saldo <> 0
    `);
    const dwhCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = 20260825`);
    expect(dwhCount.recordset[0].total).toBe(erpCount.recordset[0].total);
  });

  test('credit notes are flagged IsCreditNote=1 and excluded from normal aging buckets', async () => {
    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-25')).execute('dwh.Snapshot_Fact_AR');

    const creditNoteRows = await pool.request().query(`
      SELECT AgingBucket, IsCreditNote FROM fact.Fact_AR_Snapshot
      WHERE SnapshotDateKey = 20260825 AND IsCreditNote = 1
    `);
    for (const row of creditNoteRows.recordset) {
      expect(row.AgingBucket).toBe('N/A');
    }
  });

  test('re-snapshotting the same date replaces rather than duplicates', async () => {
    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-25')).execute('dwh.Snapshot_Fact_AR');
    const firstCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = 20260825`);

    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-25')).execute('dwh.Snapshot_Fact_AR');
    const secondCount = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = 20260825`);

    expect(secondCount.recordset[0].total).toBe(firstCount.recordset[0].total);
  });

  test('two different snapshot dates coexist independently', async () => {
    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-24')).execute('dwh.Snapshot_Fact_AR');
    await pool.request().input('SnapshotDate', sql.Date, new Date('2026-08-25')).execute('dwh.Snapshot_Fact_AR');

    const bothDates = await pool.request().query(`
      SELECT DISTINCT SnapshotDateKey FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey IN (20260824, 20260825)
    `);
    expect(bothDates.recordset.length).toBe(2);
  });
});
