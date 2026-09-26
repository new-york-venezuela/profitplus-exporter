// scripts/dwh/__tests__/0033-dim-date-week.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

// Runs against a dedicated throwaway database, never the real local/shared
// DWH_AlimentosNY -- afterAll drops this database unconditionally, which
// would otherwise wipe a real dev DWH someone else migrated/loaded.
// dwhDatabaseName() reads DW_NAME, so setting it before calling
// runDwhMigrations() routes every migrate-dwh.ts call in this file at the
// throwaway DB instead.
process.env.DW_NAME = `DWH_AlimentosNY_Test_dim_date_week_${Date.now()}`;

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

describe('0033_dim_date_add_week migration', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
  }, 60_000);

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('WeekStartDate is always a Monday for a sample of dates', async () => {
    const result = await pool.request().query(`
      SELECT TOP 50 FullDate, WeekStartDate
      FROM dim.Dim_Date
      WHERE FullDate BETWEEN '2026-01-01' AND '2026-12-31'
      ORDER BY FullDate
    `);
    expect(result.recordset.length).toBe(50);
    for (const row of result.recordset) {
      // WeekStartDate comes back as a JS Date (mssql maps SQL `date` this
      // way); getUTCDay() is DATEFIRST-independent, unlike SQL DATEPART, so
      // this is a clean check that doesn't depend on server session settings.
      // getUTCDay(): 0=Sunday, 1=Monday, ...
      const weekStart: Date = row.WeekStartDate;
      expect(weekStart.getUTCDay()).toBe(1);
    }
  });

  test('ISO week-year boundary: 2025-12-29..2026-01-04 is entirely ISO week 2026-W01', async () => {
    // 2025-12-29 is a Monday; the ISO week 2025-12-29..2026-01-04 is week 1
    // of 2026 even though the first 3 days fall in calendar year 2025 -- the
    // ISO week-year is defined by the year containing that week's Thursday
    // (2026-01-01), not by YEAR(FullDate) of each individual day.
    const result = await pool.request().query(`
      SELECT FullDate, WeekStartDate, YearWeek
      FROM dim.Dim_Date
      WHERE FullDate BETWEEN '2025-12-29' AND '2026-01-04'
      ORDER BY FullDate
    `);
    expect(result.recordset).toHaveLength(7);
    const yearWeeks = new Set(result.recordset.map((r: any) => String(r.YearWeek)));
    expect(yearWeeks.size).toBe(1);
    expect(yearWeeks.has('2026-W01')).toBe(true);

    const weekStarts = new Set(
      result.recordset.map((r: any) => new Date(r.WeekStartDate).toISOString().slice(0, 10)),
    );
    expect(weekStarts.size).toBe(1);
    expect(weekStarts.has('2025-12-29')).toBe(true);
  });

  test('ISO week-year boundary: early January date belonging to prior ISO week-year', async () => {
    // 2027-01-01 is a Friday. Its ISO week runs 2026-12-28 (Mon) through
    // 2027-01-03 (Sun), and that week's Thursday is 2026-12-31 -- so the
    // ISO week-year is 2026, not 2027, even though FullDate's calendar year
    // is already 2027.
    const result = await pool.request().query(`
      SELECT FullDate, WeekStartDate, YearWeek
      FROM dim.Dim_Date
      WHERE FullDate = '2027-01-01'
    `);
    expect(result.recordset).toHaveLength(1);
    const row = result.recordset[0];
    expect(String(row.YearWeek)).toBe('2026-W53');
    expect(new Date(row.WeekStartDate).toISOString().slice(0, 10)).toBe('2026-12-28');
  });

  test('WeekStartDate and YearWeek are NOT NULL for every row', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS NullCount FROM dim.Dim_Date WHERE WeekStartDate IS NULL OR YearWeek IS NULL
    `);
    expect(Number(result.recordset[0].NullCount)).toBe(0);
  });

  test('WeekStartDate and YearWeek columns are declared NOT NULL', async () => {
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dim' AND TABLE_NAME = 'Dim_Date'
        AND COLUMN_NAME IN ('WeekStartDate', 'YearWeek')
    `);
    expect(result.recordset).toHaveLength(2);
    for (const row of result.recordset) {
      expect(row.IS_NULLABLE).toBe('NO');
    }
  });
});
