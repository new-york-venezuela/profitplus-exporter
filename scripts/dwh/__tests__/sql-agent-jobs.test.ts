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

describe('SQL Agent jobs', () => {
  let msdbPool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    msdbPool = await new sql.ConnectionPool(testConfig('msdb')).connect();
  });

  afterAll(async () => {
    await msdbPool.request().query(`
      IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = 'DWH - Incremental Load')
          EXEC msdb.dbo.sp_delete_job @job_name = N'DWH - Incremental Load';
      IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = 'DWH - Daily AR Snapshot')
          EXEC msdb.dbo.sp_delete_job @job_name = N'DWH - Daily AR Snapshot';
    `);
    await msdbPool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('both jobs exist, disabled, with the correct step count', async () => {
    const jobs = await msdbPool.request().query(`
      SELECT name, enabled FROM msdb.dbo.sysjobs
      WHERE name IN ('DWH - Incremental Load', 'DWH - Daily AR Snapshot')
    `);
    expect(jobs.recordset.length).toBe(2);
    for (const job of jobs.recordset) {
      expect(job.enabled).toBe(0);
    }

    const incrementalSteps = await msdbPool.request().query(`
      SELECT COUNT(*) AS total FROM msdb.dbo.sysjobsteps s
      INNER JOIN msdb.dbo.sysjobs j ON j.job_id = s.job_id
      WHERE j.name = 'DWH - Incremental Load'
    `);
    expect(incrementalSteps.recordset[0].total).toBe(9);

    const snapshotSteps = await msdbPool.request().query(`
      SELECT COUNT(*) AS total FROM msdb.dbo.sysjobsteps s
      INNER JOIN msdb.dbo.sysjobs j ON j.job_id = s.job_id
      WHERE j.name = 'DWH - Daily AR Snapshot'
    `);
    expect(snapshotSteps.recordset[0].total).toBe(1);
  });

  test('Incremental Load job steps run in the documented dependency order', async () => {
    const steps = await msdbPool.request().query(`
      SELECT s.step_id, s.step_name FROM msdb.dbo.sysjobsteps s
      INNER JOIN msdb.dbo.sysjobs j ON j.job_id = s.job_id
      WHERE j.name = 'DWH - Incremental Load'
      ORDER BY s.step_id
    `);
    const names = steps.recordset.map((s: { step_name: string }) => s.step_name);
    expect(names).toEqual([
      'Load_Dim_Currency', 'Load_Fact_ExchangeRate', 'Load_Dim_Customer', 'Load_Dim_Product',
      'Load_Dim_SalesRep', 'Load_Dim_Warehouse', 'Load_Fact_Sales', 'Load_Fact_Returns', 'Load_Fact_Collections',
    ]);
  });
});
