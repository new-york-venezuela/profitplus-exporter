// scripts/dwh/__tests__/dim-date.test.ts
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

describe('Dim_Date', () => {
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

  test('has one row per day covering 2020-01-01 through 2035-12-31', async () => {
    const result = await pool.request().query(`SELECT COUNT(*) AS total FROM dim.Dim_Date`);
    expect(result.recordset[0].total).toBe(5844); // days from 2020-01-01 to 2035-12-31 inclusive
  });

  test('DateKey format and attributes are correct for a known date', async () => {
    const result = await pool.request().query(`
      SELECT DateKey, FullDate, Year, Month, MonthName, Day, DayOfWeek, DayName, IsWeekend, YearMonth
      FROM dim.Dim_Date WHERE DateKey = 20260825
    `);
    const row = result.recordset[0];
    expect(row.Year).toBe(2026);
    expect(row.Month).toBe(8);
    expect(row.Day).toBe(25);
    expect(row.YearMonth).toBe('2026-08');
  });
});
