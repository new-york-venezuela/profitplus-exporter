import { describe, test, expect, afterAll } from 'bun:test';
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

describe('migrate-dwh', () => {
  afterAll(async () => {
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      IF EXISTS (SELECT * FROM sys.databases WHERE name = '${dwhDatabaseName()}')
      BEGIN
          ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
          DROP DATABASE [${dwhDatabaseName()}];
      END
    `);
    await masterPool.close();
  });

  test('creates the database and applies all pending migrations idempotently', async () => {
    const firstRun = await runDwhMigrations();
    expect(firstRun.length).toBeGreaterThan(0);
    expect(firstRun).toContain('0001_create_database.sql');
    expect(firstRun).toContain('0002_create_schemas_and_watermark_table.sql');

    const pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    try {
      const watermarkTable = await pool.request().query(`
        SELECT 1 AS found FROM sys.tables
        WHERE name = 'EtlWatermark' AND schema_id = SCHEMA_ID('dwh')
      `);
      expect(watermarkTable.recordset.length).toBe(1);
    } finally {
      await pool.close();
    }

    const secondRun = await runDwhMigrations();
    expect(secondRun).toEqual([]);
  });
});
