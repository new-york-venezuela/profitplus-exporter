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

// Straight loads from the legacy server — no cross-referencing against
// the current-era Dim_Customer/Dim_Product/Dim_SalesRep (see spec's "Why
// fully independent product/sales-rep matching" section: codes may have
// changed at the cutover for any of these three, not just customers, and
// there's no way to verify which without live access to the old server).
// Each is a plain INSERT (not a MERGE/upsert) since this is a one-time
// load into an empty table, guarded by assertNotAlreadyImported.

export async function loadDimCustomerLegacy(legacyPool: sql.ConnectionPool, dwhPool: sql.ConnectionPool): Promise<number> {
  const result = await legacyPool.request().query(`
    SELECT RTRIM(co_cli) AS CustomerCode, cli_des AS CustomerName, co_zon AS ZoneCode, co_seg AS SegmentCode
    FROM dbo.saCliente
  `);

  let count = 0;
  for (const row of result.recordset as { CustomerCode: string; CustomerName: string | null; ZoneCode: string | null; SegmentCode: string | null }[]) {
    await dwhPool.request()
      .input('code', sql.Char(16), row.CustomerCode)
      .input('name', sql.VarChar(120), row.CustomerName)
      .input('zone', sql.Char(6), row.ZoneCode)
      .input('segment', sql.Char(6), row.SegmentCode)
      .query(`
        INSERT INTO dim.Dim_Customer_Legacy (CustomerCode, CustomerName, ZoneCode, SegmentCode)
        VALUES (@code, @name, @zone, @segment)
      `);
    count++;
  }
  return count;
}

export async function loadDimProductLegacy(legacyPool: sql.ConnectionPool, dwhPool: sql.ConnectionPool): Promise<number> {
  const result = await legacyPool.request().query(`
    SELECT
      RTRIM(a.co_art) AS ProductCode, a.art_des AS ProductName,
      RTRIM(a.co_lin) AS LineCode, l.lin_des AS LineName,
      RTRIM(a.co_subl) AS SubLineCode, sl.subl_des AS SubLineName,
      RTRIM(a.co_cat) AS CategoryCode, c.cat_des AS CategoryName
    FROM dbo.saArticulo a
    LEFT JOIN dbo.saLineaArticulo l ON RTRIM(l.co_lin) = RTRIM(a.co_lin)
    LEFT JOIN dbo.saSubLinea sl ON RTRIM(sl.co_lin) = RTRIM(a.co_lin) AND RTRIM(sl.co_subl) = RTRIM(a.co_subl)
    LEFT JOIN dbo.saCatArticulo c ON RTRIM(c.co_cat) = RTRIM(a.co_cat)
  `);

  let count = 0;
  for (const row of result.recordset as {
    ProductCode: string; ProductName: string | null;
    LineCode: string | null; LineName: string | null;
    SubLineCode: string | null; SubLineName: string | null;
    CategoryCode: string | null; CategoryName: string | null;
  }[]) {
    await dwhPool.request()
      .input('code', sql.Char(30), row.ProductCode)
      .input('name', sql.VarChar(120), row.ProductName)
      .input('lineCode', sql.Char(6), row.LineCode)
      .input('lineName', sql.VarChar(60), row.LineName)
      .input('subLineCode', sql.Char(6), row.SubLineCode)
      .input('subLineName', sql.VarChar(60), row.SubLineName)
      .input('categoryCode', sql.Char(6), row.CategoryCode)
      .input('categoryName', sql.VarChar(60), row.CategoryName)
      .query(`
        INSERT INTO dim.Dim_Product_Legacy (
          ProductCode, ProductName, LineCode, LineName, SubLineCode, SubLineName, CategoryCode, CategoryName
        )
        VALUES (@code, @name, @lineCode, @lineName, @subLineCode, @subLineName, @categoryCode, @categoryName)
      `);
    count++;
  }
  return count;
}

export async function loadDimSalesRepLegacy(legacyPool: sql.ConnectionPool, dwhPool: sql.ConnectionPool): Promise<number> {
  const result = await legacyPool.request().query(`
    SELECT RTRIM(co_ven) AS SalesRepCode, ven_des AS SalesRepName, co_zon AS ZoneCode
    FROM dbo.saVendedor
  `);

  let count = 0;
  for (const row of result.recordset as { SalesRepCode: string; SalesRepName: string | null; ZoneCode: string | null }[]) {
    await dwhPool.request()
      .input('code', sql.Char(6), row.SalesRepCode)
      .input('name', sql.VarChar(60), row.SalesRepName)
      .input('zone', sql.Char(6), row.ZoneCode)
      .query(`
        INSERT INTO dim.Dim_SalesRep_Legacy (SalesRepCode, SalesRepName, ZoneCode)
        VALUES (@code, @name, @zone)
      `);
    count++;
  }
  return count;
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

    const customerCount = await loadDimCustomerLegacy(legacyPool, dwhPool);
    console.log(`✓ Dim_Customer_Legacy: ${customerCount} rows loaded`);

    const productCount = await loadDimProductLegacy(legacyPool, dwhPool);
    console.log(`✓ Dim_Product_Legacy: ${productCount} rows loaded`);

    const salesRepCount = await loadDimSalesRepLegacy(legacyPool, dwhPool);
    console.log(`✓ Dim_SalesRep_Legacy: ${salesRepCount} rows loaded`);

    // Task 5 adds the two fact-table loads here, after the dimensions
    // above are fully populated (the fact loads resolve their FKs by
    // code against these same tables).
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
