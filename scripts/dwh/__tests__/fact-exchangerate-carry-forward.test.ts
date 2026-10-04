// scripts/dwh/__tests__/fact-exchangerate-carry-forward.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

// Runs against a dedicated throwaway database (afterAll drops it), never the
// real DWH_AlimentosNY. dwhDatabaseName() reads DW_NAME.
process.env.DW_NAME = `DWH_AlimentosNY_Test_fx_carry_forward_${Date.now()}`;

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

const USD = `(SELECT CurrencyKey FROM dim.Dim_Currency WHERE RTRIM(CurrencyCode) = 'USD')`;

describe('Fact_ExchangeRate carry-forward (0036)', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Fact_ExchangeRate');
  }, 60_000);

  afterAll(async () => {
    await pool?.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      IF EXISTS (SELECT 1 FROM sys.databases WHERE name = '${dwhDatabaseName()}')
      BEGIN
        ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${dwhDatabaseName()}];
      END
    `);
    await masterPool.close();
  });

  test('USD has exactly one row for every calendar day from its first real rate through today', async () => {
    const r = await pool.request().query(`
      DECLARE @TodayKey int = CONVERT(int, FORMAT(CAST(GETDATE() AS date), 'yyyyMMdd'));
      DECLARE @FirstKey int = (SELECT MIN(DateKey) FROM fact.Fact_ExchangeRate WHERE CurrencyKey = ${USD} AND IsCarriedForward = 0);
      SELECT
        (SELECT COUNT(*) FROM dim.Dim_Date WHERE DateKey BETWEEN @FirstKey AND @TodayKey) AS CalendarDays,
        (SELECT COUNT(*) FROM fact.Fact_ExchangeRate WHERE CurrencyKey = ${USD} AND DateKey BETWEEN @FirstKey AND @TodayKey) AS RateDays,
        (SELECT COUNT(*) FROM fact.Fact_ExchangeRate WHERE CurrencyKey = ${USD} AND DateKey < @FirstKey) AS BeforeFirst,
        (SELECT COUNT(*) FROM fact.Fact_ExchangeRate WHERE CurrencyKey = ${USD} AND IsCarriedForward = 1) AS Carried
    `);
    const row = r.recordset[0];
    expect(Number(row.CalendarDays)).toBeGreaterThan(0);
    expect(Number(row.RateDays)).toBe(Number(row.CalendarDays));
    expect(Number(row.BeforeFirst)).toBe(0);
    // The mock saTasa has gaps (weekends, 2026-06-27/29) so something must be carried.
    expect(Number(row.Carried)).toBeGreaterThan(0);
  });

  test('every carried row holds the latest real rate on or before its own day', async () => {
    const r = await pool.request().query(`
      SELECT COUNT(*) AS Mismatches
      FROM fact.Fact_ExchangeRate c
      CROSS APPLY (
        SELECT TOP 1 x.RateSell, x.RateBuy FROM fact.Fact_ExchangeRate x
        WHERE x.CurrencyKey = c.CurrencyKey AND x.IsCarriedForward = 0 AND x.DateKey < c.DateKey
        ORDER BY x.DateKey DESC
      ) lastReal
      WHERE c.IsCarriedForward = 1
        AND (ISNULL(c.RateSell, -1) <> ISNULL(lastReal.RateSell, -1) OR ISNULL(c.RateBuy, -1) <> ISNULL(lastReal.RateBuy, -1))
    `);
    expect(Number(r.recordset[0].Mismatches)).toBe(0);
  });

  test('a known no-rate Saturday (2026-06-27) gets Friday 2026-06-26\'s USD rate when Friday has a real rate', async () => {
    const r = await pool.request().query(`
      SELECT DateKey, RateSell, IsCarriedForward FROM fact.Fact_ExchangeRate
      WHERE CurrencyKey = ${USD} AND DateKey IN (20260626, 20260627)
      ORDER BY DateKey
    `);
    const fri = r.recordset.find((x: { DateKey: number }) => x.DateKey === 20260626);
    const sat = r.recordset.find((x: { DateKey: number }) => x.DateKey === 20260627);
    if (!fri || fri.IsCarriedForward) return; // mock data changed; covered generically above
    expect(sat).toBeDefined();
    expect(sat.IsCarriedForward).toBe(true);
    expect(Number(sat.RateSell)).toBe(Number(fri.RateSell));
  });

  test('re-running the load is idempotent and repairs a tampered/missing carried row', async () => {
    const before = await pool.request().query(`SELECT COUNT(*) AS n FROM fact.Fact_ExchangeRate`);
    const target = (await pool.request().query(`
      SELECT TOP 1 DateKey, CurrencyKey, RateSell FROM fact.Fact_ExchangeRate
      WHERE IsCarriedForward = 1 ORDER BY DateKey DESC
    `)).recordset[0];
    const other = (await pool.request().query(`
      SELECT TOP 1 DateKey, CurrencyKey FROM fact.Fact_ExchangeRate
      WHERE IsCarriedForward = 1 AND NOT (DateKey = ${target.DateKey} AND CurrencyKey = ${target.CurrencyKey})
      ORDER BY DateKey
    `)).recordset[0];
    await pool.request().query(`
      UPDATE fact.Fact_ExchangeRate SET RateSell = 1 WHERE DateKey = ${target.DateKey} AND CurrencyKey = ${target.CurrencyKey};
      DELETE FROM fact.Fact_ExchangeRate WHERE DateKey = ${other.DateKey} AND CurrencyKey = ${other.CurrencyKey};
    `);

    await pool.request().execute('dwh.Load_Fact_ExchangeRate');

    const after = await pool.request().query(`SELECT COUNT(*) AS n FROM fact.Fact_ExchangeRate`);
    expect(Number(after.recordset[0].n)).toBe(Number(before.recordset[0].n));
    const repaired = await pool.request().query(`
      SELECT RateSell FROM fact.Fact_ExchangeRate WHERE DateKey = ${target.DateKey} AND CurrencyKey = ${target.CurrencyKey}
    `);
    expect(Number(repaired.recordset[0].RateSell)).toBe(Number(target.RateSell));
  });

  test('a real saTasa row replaces a carried row for the same day', async () => {
    // Simulate a day that was carried before saTasa got its row: flip a real
    // row to carried with a wrong rate, then reload.
    const real = (await pool.request().query(`
      SELECT TOP 1 DateKey, CurrencyKey, RateSell FROM fact.Fact_ExchangeRate
      WHERE IsCarriedForward = 0 AND CurrencyKey = ${USD} ORDER BY DateKey DESC
    `)).recordset[0];
    await pool.request().query(`
      UPDATE fact.Fact_ExchangeRate SET IsCarriedForward = 1, RateSell = 1
      WHERE DateKey = ${real.DateKey} AND CurrencyKey = ${real.CurrencyKey}
    `);
    await pool.request().execute('dwh.Load_Fact_ExchangeRate');
    const r = await pool.request().query(`
      SELECT RateSell, IsCarriedForward FROM fact.Fact_ExchangeRate
      WHERE DateKey = ${real.DateKey} AND CurrencyKey = ${real.CurrencyKey}
    `);
    expect(r.recordset[0].IsCarriedForward).toBe(false);
    expect(Number(r.recordset[0].RateSell)).toBe(Number(real.RateSell));
  });
});
