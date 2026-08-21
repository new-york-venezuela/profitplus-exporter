import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import sql from 'mssql';
import { runMigrations } from '@/scripts/migrate-mssql';

function buildTestConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

let testPool: sql.ConnectionPool;

beforeEach(async () => {
  const pool = await new sql.ConnectionPool(buildTestConfig()).connect();
  await pool.request().query(`
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = '__exporter_migrations' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      DELETE FROM dbo.__exporter_migrations;
    END
  `);
  await pool.close();
});

afterAll(async () => {
  if (testPool?.connected) await testPool.close();
});

describe('mssql migration runner', () => {
  test('applies migration 0001 and creates the tracking table', async () => {
    const applied = await runMigrations();
    expect(applied).toContain('0001_create_migrations_table.sql');

    testPool = await new sql.ConnectionPool(buildTestConfig()).connect();
    const result = await testPool.request().query(
      `SELECT name FROM dbo.__exporter_migrations WHERE name = '0001_create_migrations_table.sql'`
    );
    expect(result.recordset).toHaveLength(1);
  });

  test('running twice is idempotent — second run applies nothing new', async () => {
    await runMigrations();
    const secondRun = await runMigrations();
    expect(secondRun).toEqual([]);
  });
});
