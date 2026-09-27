import sql from 'mssql';
import { getDwhPool } from '@/lib/db/dwh-mssql';

// One-time historical backfill, NOT part of the tracked migrations/
// system (unlike migrations/dwh/*.sql, this never re-runs and has no
// dwh.__dwh_migrations entry) — same "standalone operational script"
// framing as scripts/dwh-backfill.ts. Loads Jan 2025-Feb 2026 sales/
// returns data from the pre-March-2026-cutover Profit Plus server into
// the _Legacy dimension/fact tables created by
// migrations/dwh/0034_legacy_2025_schema.sql. See
// docs/superpowers/specs/2026-09-23-legacy-2025-import-design.md for
// why this can't reuse the existing Load_Dim_*/Load_Fact_* machinery
// (different server, one-time load, unmapped customer/product/rep
// identities across the cutover).
//
// The legacy server is expected to be decommissioned after this script
// runs successfully — LEGACY_DB_* env vars are read ONLY here, never by
// the running app.

export const IMPORT_START_DATE = '2025-01-01';
// 2026 is not a leap year (not divisible by 4) — the actual end boundary
// is Feb 28, not Feb 29. Do not "fix" this to 02-29 without re-checking
// the year.
export const IMPORT_END_DATE = '2026-02-28';

function legacyEnv(name: string): string {
  const value = process.env[`LEGACY_DB_${name}`];
  if (value === undefined) {
    throw new Error(`LEGACY_DB_${name} is not set — required to run the Histórico 2025 import`);
  }
  return value;
}

export function buildLegacyConfig(): sql.config {
  return {
    server: legacyEnv('SERVER'),
    port: parseInt(process.env.LEGACY_DB_PORT ?? '1433'),
    database: legacyEnv('NAME'),
    user: legacyEnv('USER'),
    password: legacyEnv('PASSWORD'),
    options: {
      encrypt: (process.env.LEGACY_DB_ENCRYPT ?? 'false') === 'true',
      trustServerCertificate: (process.env.LEGACY_DB_TRUST_SERVER_CERT ?? 'true') !== 'false',
    },
  };
}

export async function getLegacyPool(): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool(buildLegacyConfig()).connect();
}

export async function assertNotAlreadyImported(dwhPool: sql.ConnectionPool): Promise<void> {
  const result = await dwhPool.request().query(`SELECT COUNT(*) AS RowCount FROM fact.Fact_Sales_Legacy`);
  const rowCount = Number(result.recordset[0].RowCount);
  if (rowCount > 0) {
    throw new Error(
      `fact.Fact_Sales_Legacy already has ${rowCount} row(s) — refusing to run the Histórico 2025 import again. ` +
      `This is a one-time load; if you need to re-import, truncate fact.Fact_Sales_Legacy, fact.Fact_Returns_Legacy, ` +
      `dim.Dim_Customer_Legacy, dim.Dim_Product_Legacy, and dim.Dim_SalesRep_Legacy manually first.`
    );
  }
}

async function main(): Promise<void> {
  const dwhPool = await getDwhPool();
  await assertNotAlreadyImported(dwhPool);

  const legacyPool = await getLegacyPool();
  try {
    // Pre-flight check (manual review, not an automated assertion — see
    // docs/superpowers/specs/2026-09-23-legacy-2025-import-design.md's
    // "Currency conversion" section): confirm the DWH's own
    // fact.Fact_ExchangeRate actually has rows for this date window
    // before relying on it for USD figures in the Histórico tab. A
    // missing rate degrades gracefully (produces NULL/no USD for that
    // row) rather than erroring, but is worth knowing about up front.
    const rateCheck = await dwhPool.request().query(`
      SELECT COUNT(*) AS RowCount FROM fact.Fact_ExchangeRate
      WHERE DateKey BETWEEN 20250101 AND 20260228
    `);
    console.log(`Fact_ExchangeRate rows for the import window: ${rateCheck.recordset[0].RowCount} (0 means USD figures in the Histórico tab will show as unavailable for this whole period)`);

    // Task 4 and Task 5 extend this function with the actual dimension
    // and fact loads, in this order:
    //   1. Dim_Customer_Legacy
    //   2. Dim_Product_Legacy
    //   3. Dim_SalesRep_Legacy
    //   4. Fact_Sales_Legacy
    //   5. Fact_Returns_Legacy
  } finally {
    await legacyPool.close();
  }
}

if (import.meta.main) {
  main()
    .then(() => {
      console.log('✓ Histórico 2025 import completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('✗ Error running the Histórico 2025 import:', error);
      process.exit(1);
    });
}
